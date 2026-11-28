import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {describe, expect, it} from 'vitest';
import {parse} from 'yaml';

const root = new URL('../', import.meta.url);
const read = (name: string) => readFile(new URL(name, root), 'utf8');
const require = createRequire(import.meta.url);
const {layers} = require('../resources/tekona-workshop/art-versions/v4-detailed-acting/generator/ambient.cjs');

describe('Tekona ambient presentation', () => {
  it('extracts complete nested layers without taking their neighbouring scenery', () => {
    const svg = '<g><path/><g data-ambient="reeds" data-pivot-x="20" data-pivot-y="360"><g><path/></g></g><circle/></g>';
    const result = layers(svg);
    expect(result).toHaveLength(1);
    expect(result[0].pivot).toEqual([20, 360]);
    expect(result[0].svg).toBe('<g data-ambient="reeds" data-pivot-x="20" data-pivot-y="360"><g><path/></g></g>');
    expect(() => layers('<g>')).toThrow('Unclosed');
  });

  it('starts seamless native reed loops and clears both layers at each stage change', async () => {
    const story = parse(await read('stories/tekona/tekona.k4.yml'));
    const manifest = parse(await read('stories/tekona/project-assets-dsl4.yml'));
    const index = JSON.parse(await read('stories/tekona/assets/ambient/index.json'));
    const aliases: Record<string, string> = {Aki:'aki', Hama:'hama', Haru:'haru', InletSunset:'inlet-sunset', Kame:'kame', MamaWell:'mama-well', Natsu:'natsu', Ryo:'ryo', TitleCardWind:'title-card', Tsugihashi:'tsugihashi', Uma:'uma', Yoake:'yoake', Yugure:'yugure'};
    for (const scene of Object.values(story.scenes) as any[]) {
      const actions: any[] = Array.isArray(scene) ? scene : scene.actions;
      for (let i = 0; i < actions.length; i++) if (actions[i].stage) {
        const prefix = actions.slice(Math.max(0, i - 12), i);
        for (const actor of ['Reeds1', 'Storm']) {
          expect(prefix.some(a => a[actor+'.show']?.skin === (actor === 'Storm' ? 'StormBlank' : 'WindBlank'))).toBe(true);
          expect(prefix.some(a => a[actor+'.hide'])).toBe(true);
        }
        const nextStage = actions.findIndex((a, j) => j > i && a.stage);
        const segment = actions.slice(i, nextStage < 0 ? undefined : nextStage);
        const name = aliases[actions[i].stage];
        if (name && index[name].reeds.length) {
          const loop = segment.find(a => a['Reeds1.loop'])?.['Reeds1.loop'];
          expect(loop?.steps).toHaveLength(16);
          for (const step of loop.steps) {
            const asset = manifest.assets[step.skin];
            expect(asset.target).toBe('Reeds1');
            const svg = await read('stories/tekona/'+asset.file);
            expect(svg).toContain('skewX(');
            expect(svg).not.toContain('<animate');
          }
        }
        if (name && index[name].birds) {
          const tracks = segment.flatMap(a => a['AmbientBirds.animate'] ? [a['AmbientBirds.animate']] : []);
          expect(tracks.some(a => a.to.x === 18 && a.easing === 'easeInOut')).toBe(true);
          expect(tracks.some(a => a.to.y === 6 && a.easing === 'easeInOut')).toBe(true);
          expect(await read('stories/tekona/'+manifest.assets[actions[i].stage].file)).not.toContain('data-ambient="birds"');
        }
      }
    }
    const storm = story.scenes.quarrel.find((a: any) => a['Storm.loop'])['Storm.loop'].steps;
    expect(storm).toHaveLength(16);
    const frames = await Promise.all(storm.map((s: any) => read('stories/tekona/'+manifest.assets[s.skin].file)));
    expect(new Set(frames).size).toBe(16);
    expect(frames.filter(s => s.includes('M350 46'))).toHaveLength(2);
  });
});
