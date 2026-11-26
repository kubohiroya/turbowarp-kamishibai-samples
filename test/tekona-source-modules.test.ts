import {readFile} from 'node:fs/promises';

import {describe, expect, it} from 'vitest';
import {parse} from 'yaml';

import {tekonaSourceModules} from '../scripts/tekona-source-modules.ts';
import {composeSlots, placeholderModelUrl} from '../resources/tekona-workshop/assistant/compose-participants.js';

const source = await readFile(new URL('../stories/tekona/tekona.k4.yml', import.meta.url), 'utf8');

describe('Tekona internal scene documents', () => {
  for (const slots of [0, 20]) {
    it(`retains scene order, false pose guards and definitions with ${slots} participant slots`, () => {
      const input = slots ? composeSlots(source, slots, {modelUrl: placeholderModelUrl}) : source;
      const original = parse(input);
      const files = tekonaSourceModules(input);
      const root = parse(files['tekona.k4.yml']);
      expect(Object.keys(files)).toHaveLength(23 + slots);
      expect(root.scenes).toBeUndefined();
      expect(root.include).toEqual(Object.keys(original.scenes).map((scene) => `${scene}.k4.yml`));
      const scenes = Object.fromEntries(root.include.flatMap((file: string) => {
        const module = parse(files[file]);
        expect(Object.keys(module)).toEqual(['scenes']);
        expect(Object.keys(module.scenes)).toHaveLength(1);
        return Object.entries(module.scenes);
      }));
      const {include: _, ...definitions} = root;
      expect({...definitions, scenes}).toEqual(original);
      expect(scenes.sato).toEqual(original.scenes.sato);
      expect((scenes.sato as any).actions.filter((a: any) => a.invalidate).map((a: any) => a.invalidate.condition))
        .toEqual([false, false]);
    });
  }
});
