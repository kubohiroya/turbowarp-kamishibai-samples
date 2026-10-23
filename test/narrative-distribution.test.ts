import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {test} from 'vitest';
import {strFromU8, unzipSync} from 'fflate';
import {appBasePath} from '../scripts/app-dependency.ts';
import {createThreeVisitsActorBase} from '../scripts/build-three-visits.ts';
import {verifyStructuredBlockSource} from '../scripts/verify-structured-block-source.ts';
import type {ScratchProject} from '../scripts/scratch.ts';

test('story actor preparation preserves official runtime and localized title/menu assets deterministically', async () => {
  const original = await readFile(appBasePath());
  const first = await createThreeVisitsActorBase(original);
  assert.deepEqual(first, await createThreeVisitsActorBase(original));
  const before = unzipSync(original);
  const after = unzipSync(first);
  const a = JSON.parse(strFromU8(before['project.json']!)) as ScratchProject;
  const b = JSON.parse(strFromU8(after['project.json']!)) as ScratchProject;
  assert.deepEqual(b.extensionURLs, a.extensionURLs);
  assert.deepEqual(b.extensionStorage, a.extensionStorage);
  assert.deepEqual(b.targets[0], a.targets[0]);
  for (const costume of a.targets[0]!.costumes) assert.deepEqual(after[costume.md5ext!], before[costume.md5ext!]);
  assert.equal(b.targets.filter((target) => target.name === 'Narrator').length, 1);
});

test('three visits retain both conditional arms and reject a detached else arm', async () => {
  const archive = unzipSync(await readFile(new URL('../stories/three-visits/three-visits-blocks-4.0.sb3', import.meta.url)));
  const project = JSON.parse(strFromU8(archive['project.json']!)) as ScratchProject;
  const source = await readFile(new URL('../stories/three-visits/main.k4.yml', import.meta.url), 'utf8');
  verifyStructuredBlockSource(project, source);
  const condition = Object.values(project.targets.find((target) => target.isStage)!.blocks).find((block) => block.opcode.endsWith('_narrativeIf'))!;
  delete condition.inputs!.SUBSTACK2;
  assert.throws(() => verifyStructuredBlockSource(project, source), /every command/);
});
