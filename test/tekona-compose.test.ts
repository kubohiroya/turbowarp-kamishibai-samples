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
    expect(submission({'：揺れた': '：揺れなかった'}).moved).toBe(false);
  });

  it('reads every field of the board template in the participant handout', async () => {
    const handout = await readFile(path.join(import.meta.dirname, '../resources/tekona-workshop/tekona-workshop.md'), 'utf8');
    const template = /```text\n(席番号：NN\n[\s\S]*?)```/u.exec(handout)?.[1];
    expect(template).toBeDefined();
    const filled = template!.split('\n').filter(Boolean).map((line, index) =>
      line.startsWith('席番号') ? '席番号：07'
        : line.startsWith('モデルのリンク') ? line.replace(/：.*$/u, '：https://teachablemachine.withgoogle.com/models/abc/')
          : line.startsWith('手児奈の心') ? `${line}揺れなかった` : `${line}値${index}`);
    const parsed = parseSubmission(filled.join('\n'));
    expect(checkSubmission(parsed)).toEqual([]);
    expect(parsed).toMatchObject({nn: '07', moved: false, model: 'https://teachablemachine.withgoogle.com/models/abc/'});
    expect(parsed.rejectedHint).toBeDefined();
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
      submission({'席番号：01': '席番号：12', '：揺れた': '：揺れなかった', '入江の漁師': '歌の名手: 若者'}),
      submission({}),
    ]);
    const story = parse(composed);
    const scenes = Object.keys(story.scenes);
    expect(scenes.slice(scenes.indexOf('miyako'), scenes.indexOf('quarrel') + 1))
      .toEqual(['miyako', 'suitor-01', 'suitor-12', 'quarrel']);
    // Every suitor: its own sprite, costumes stand/kime/rejected, and poses kime then rejected.
    expect(story.actors.Suitor12).toBe('s12-stand');
    for (const costume of ['stand', 'kime', 'rejected'])
      expect(story.assets[`s12-${costume}`]).toEqual({kind: 'costume', target: 'Suitor12', name: costume});
    const poses = story.scenes['suitor-12'].actions.filter((action: Record<string, unknown>) => 'Suitor12.pose' in action)
      .map((action: Record<string, any>) => action['Suitor12.pose'].steps[0]);
    expect(poses).toEqual([
      {pose: 'kime', skin: 's12-kime', sound: 'Goal Cheer'},
      {pose: 'rejected', skin: 's12-rejected', sound: 'Crowd Gasp'},
    ]);
    const shows = story.scenes['suitor-12'].actions.filter((action: Record<string, unknown>) => 'Tekona.show' in action || 'Suitor12.show' in action);
    expect(shows.map((action: Record<string, any>) => (action['Tekona.show'] ?? action['Suitor12.show']).x)).toEqual([-150, 140]);
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
  it('lists the edits of a slot with the texts the slot shows', async () => {
    const {blockEdits, composeSlots} = await import('../resources/tekona-workshop/assistant/compose-participants.js');
    const source = await readFile(sourcePath, 'utf8');
    const unmoved = submission({'席番号：01': '席番号：03', '：揺れた': '：揺れなかった'});
    const edits = blockEdits(source, unmoved);
    expect(edits.map((edit) => edit.kind)).toEqual(['text', 'text', 'text', 'remove', 'text', 'text', 'text', 'enable']);
    expect(edits[0]).toMatchObject({label: 'ナレーションの文', current: '（作者の名前）さんの求婚者「（求婚者の名前）」',
      replacement: 'リハーサルさんの求婚者「入江の漁師」'});
    expect(edits.at(-1)).toMatchObject({label: '場面 suitor-03 のいちばん外側の「もし」', current: 'false', replacement: 'true'});
    // Every "current" text is exactly a text of the generated slot, so the assistant can find it.
    const slot = JSON.stringify(parse(composeSlots(source, 3, {modelUrl: 'https://teachablemachine.withgoogle.com/models/SAMPLE/'}))
      .scenes['suitor-03']);
    for (const edit of edits.filter((edit) => edit.kind !== 'enable')) expect(slot).toContain(`"${edit.current}"`);
    expect(blockEdits(source, submission({})).some((edit) => edit.kind === 'remove')).toBe(false);
  });

  it('does not require a model link in the block-script version', () => {
    const withoutModel = parseSubmission(sampleSubmission.replace(/^モデルのリンク：.*$/mu, ''));
    expect(checkSubmission(withoutModel)).not.toEqual([]);
    expect(checkSubmission(withoutModel, {requireModel: false})).toEqual([]);
    expect(checkSubmission({...withoutModel, model: 'http://example.com/'}, {requireModel: false})).not.toEqual([]);
  });

  it('pre-registers disabled slots in seat order with per-seat model links', async () => {
    const {composeSlots} = await import('../resources/tekona-workshop/assistant/compose-participants.js');
    const source = await readFile(sourcePath, 'utf8');
    const sample = 'https://teachablemachine.withgoogle.com/models/SAMPLE/';
    const own = 'https://teachablemachine.withgoogle.com/models/SEAT-02/';
    const story = parse(composeSlots(source, 3, {modelUrl: sample, modelUrls: {'02': own}}));
    const scenes = Object.keys(story.scenes);
    expect(scenes.slice(scenes.indexOf('miyako'), scenes.indexOf('quarrel') + 1))
      .toEqual(['miyako', 'suitor-01', 'suitor-02', 'suitor-03', 'quarrel']);
    expect(story.actors.Suitor03).toBe('s03-stand');
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
