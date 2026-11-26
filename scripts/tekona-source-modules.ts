import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import path from 'node:path';

import {parse, stringify} from 'yaml';

import type {ScratchProject} from './scratch.ts';

/** Keep the editable source graph identical to the published include format used by Urashima. */
export function tekonaSourceModules(source: string, entryPath = 'tekona.k4.yml'): Record<string, string> {
  const document = parse(source);
  assert(document.scenes && !document.include, 'Tekona input must be the composed authoring source.');
  const {scenes, ...definitions} = document;
  const entries = Object.entries(scenes);
  assert(entries.length > 0);
  for (const [scene] of entries) assert(/^[a-z][a-z0-9-]*$/u.test(scene), 'Unsafe scene filename.');
  return {
    [entryPath]: stringify({...definitions, include: entries.map(([scene]) => `${scene}.k4.yml`)}, {lineWidth: 0}),
    ...Object.fromEntries(entries.map(([scene, body]) => [
      `${scene}.k4.yml`, stringify({scenes: {[scene]: body}}, {lineWidth: 0}),
    ])),
  };
}

export async function writeTekonaSourceModules(directory: string, source: string): Promise<void> {
  await mkdir(directory, {recursive: true});
  for (const [filename, text] of Object.entries(tekonaSourceModules(source)))
    await writeFile(path.join(directory, filename), text);
}

/** Count dedicated OFF sections that retain a pose block as their body. */
export function countDisabledPoseBlocks(project: ScratchProject): number {
  let count = 0;
  for (const target of project.targets) {
    for (const block of Object.values(target.blocks)) {
      if (!block.opcode.endsWith('_poseSteps') || !block.parent) continue;
      const parent = target.blocks[block.parent];
      if (parent?.opcode.endsWith('_useSection') && parent.fields?.ENABLED?.[0] === 'off') count++;
    }
  }
  return count;
}
