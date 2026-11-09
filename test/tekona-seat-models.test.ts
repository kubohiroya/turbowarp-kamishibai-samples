import {strFromU8, strToU8, unzipSync, zipSync} from 'fflate';
import {describe, expect, it} from 'vitest';

import {freshProject, seatModel, seatProblems} from '../scripts/tekona-seat-models.ts';

function project(labels: string[], name?: string) {
  const manifest = {type: 'pose', version: '2.4.14', appdata: {
    ...(name ? {publishResults: {tensorflowjs: {name, token: 'secret'}}} : {}), trainEpochs: 50}};
  const entries: Record<string, Uint8Array> = {'manifest.json': strToU8(JSON.stringify(manifest))};
  for (const label of labels) entries[`${label}-!-0.jpg`] = new Uint8Array([0xff, 0xd8]);
  return zipSync(entries);
}

describe('tekona seat models', () => {
  it('reads the model link and labels of an uploaded seat project', () => {
    const model = seatModel('seat-07.tm', project(['stand', 'kime', 'rejected'], 'Ab_c-1'));
    expect(model).toMatchObject({seat: '07', url: 'https://teachablemachine.withgoogle.com/models/Ab_c-1/'});
    expect(seatProblems([model], 20)).toEqual([]);
  });

  it('removes the upload identity for a fresh copy and keeps the samples', () => {
    const fresh = unzipSync(freshProject(project(['stand', 'kime', 'rejected'], 'Ab_c-1')));
    const manifest = JSON.parse(strFromU8(fresh['manifest.json']!));
    expect(manifest.appdata.publishResults).toBeUndefined();
    expect(manifest.appdata.trainEpochs).toBe(50);
    expect(Object.keys(fresh)).toContain('kime-!-0.jpg');
    expect(() => freshProject(project(['stand', 'kime']))).toThrow('rejected');
  });

  it('reports missing uploads, wrong labels, shared links and seats without slots', () => {
    const problems = seatProblems([
      seatModel('seat-01.tm', project(['stand', 'kime', 'rejected'])),
      seatModel('seat-02.tm', project(['stand', 'pose1', 'rejected'], 'Same')),
      seatModel('seat-21.tm', project(['stand', 'kime', 'rejected'], 'Same')),
    ], 20);
    expect(problems.join('\n')).toMatch(/seat-01\.tm: not uploaded/u);
    expect(problems.join('\n')).toMatch(/seat-02\.tm: class "kime" has no samples/u);
    expect(problems.join('\n')).toMatch(/unexpected class "pose1"/u);
    expect(problems.join('\n')).toMatch(/seat-21\.tm: seat 21 has no slot/u);
    expect(problems.join('\n')).toMatch(/same model link/u);
    expect(() => seatModel('project.tm', project(['stand', 'kime', 'rejected']))).toThrow('seat-NN.tm');
  });
});
