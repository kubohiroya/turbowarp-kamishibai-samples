import {readFile} from 'node:fs/promises';
import path from 'node:path';

import {describe, expect, it} from 'vitest';
import {parse} from 'yaml';

import {
  checkSubmission,
  composeParticipants,
  parseSubmission,
} from '../resources/tekona-workshop/assistant/compose-participants.js';
import {sampleSubmission} from '../scripts/build-tekona.ts';

const sourcePath = path.join(import.meta.dirname, '../stories/tekona/tekona.k4.yml');

function submission(changes: Record<string, string>) {
  let text = sampleSubmission;
  for (const [from, to] of Object.entries(changes)) text = text.replace(from, to);
  return parseSubmission(text);
}

describe('tekona participant composition', () => {
  it('reads the handout submission format', () => {
    const parsed = parseSubmission(sampleSubmission);
    expect(parsed).toMatchObject({nn: '01', name: '入江の漁師', moved: true});
    expect(checkSubmission(parsed)).toEqual([]);
    expect(submission({'席番号：01': '席番号：７'}).nn).toBe('07');
    expect(submission({'：ゆれた': '：ゆれなかった'}).moved).toBe(false);
  });

  it('reports missing fields and invalid model links', () => {
    const problems = checkSubmission(parseSubmission('席番号：3\nモデルのリンク：http://example.com/'));
    expect(problems.some((problem) => problem.includes('求婚の言葉'))).toBe(true);
    expect(problems.some((problem) => problem.includes('モデルのリンク'))).toBe(true);
    expect(checkSubmission(submission({'求婚の言葉：': '求婚の言葉："'}))).not.toEqual([]);
  });

  it('inserts participants in seat order before quarrel, with quoted texts', async () => {
    const source = await readFile(sourcePath, 'utf8');
    const composed = composeParticipants(source, [
      submission({'席番号：01': '席番号：12', '：ゆれた': '：ゆれなかった', '入江の漁師': '歌の名手: 若者'}),
      submission({}),
    ]);
    const story = parse(composed);
    const scenes = Object.keys(story.scenes);
    expect(scenes.slice(scenes.indexOf('proposals'), scenes.indexOf('quarrel') + 1))
      .toEqual(['proposals', 'suitor-01', 'suitor-12', 'quarrel']);
    expect(story.assets.Pose12.source.url).toBe('https://teachablemachine.withgoogle.com/models/WORKSHOP-REHEARSAL-01/');
    const twelve = story.scenes['suitor-12'];
    expect(twelve.recognitionModel).toBe('Pose12');
    expect(twelve.actions.some((action: Record<string, unknown>) => 'Tekona.think' in action)).toBe(false);
    expect(twelve.actions).toContainEqual({
      'Narration.setText': {text: 'リハーサルさんの求婚者「歌の名手: 若者」', style: 'narration'},
    });
    expect(story.scenes['suitor-01'].actions.some((action: Record<string, unknown>) => 'Tekona.think' in action))
      .toBe(true);
  });

  it('rejects duplicate seats', async () => {
    const source = await readFile(sourcePath, 'utf8');
    expect(() => composeParticipants(source, [submission({}), submission({})])).toThrow('重複');
  });
});

describe('tekona block workshop slots', () => {
  it('pre-registers disabled slots in seat order with per-seat model links', async () => {
    const {composeSlots} = await import('../resources/tekona-workshop/assistant/compose-participants.js');
    const source = await readFile(sourcePath, 'utf8');
    const sample = 'https://teachablemachine.withgoogle.com/models/SAMPLE/';
    const own = 'https://teachablemachine.withgoogle.com/models/SEAT-02/';
    const story = parse(composeSlots(source, 3, {modelUrl: sample, modelUrls: {'02': own}}));
    const scenes = Object.keys(story.scenes);
    expect(scenes.slice(scenes.indexOf('proposals'), scenes.indexOf('quarrel') + 1))
      .toEqual(['proposals', 'suitor-01', 'suitor-02', 'suitor-03', 'quarrel']);
    expect(story.assets.Pose01.source.url).toBe(sample);
    expect(story.assets.Pose02.source.url).toBe(own);
    const slot = story.scenes['suitor-03'];
    expect(slot.recognitionModel).toBe('Pose03');
    expect(slot.actions).toHaveLength(1);
    expect(slot.actions[0].if.condition).toBe(false);
    expect(JSON.stringify(slot.actions[0].if.then)).toContain('（求婚の言葉）');
    expect(() => composeSlots(source, 3, {modelUrl: sample, modelUrls: {'04': own}})).toThrow('枠');
  });
});
