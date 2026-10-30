import assert from 'node:assert/strict';
import {readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';

import {createDeterministicSb3, importSb3} from '@kubohiroya/sb3-toolchain';
import {strFromU8, unzipSync} from 'fflate';

import {alignDsl4BlockAssetBundle} from './simplify-published-dsl4-blocks.ts';
import {migrateEditableBlockSource} from './migrate-embedded-yaml.ts';

import type {ScratchProject} from './scratch.ts';

/** Verify the upstream wrapper permits the bundle's per-component Scratch proxy. */
export function assertBlockSourceRuntimeWrapper(source: string): void {
  const descriptors = source.match(
    /Object\.defineProperty\(scoped, 'extensions', \{[^}]*\}\);/gu,
  );
  assert.equal(
    descriptors?.length,
    1,
    'BLOCK_SOURCE_WRAPPER_DRIFT: the pinned authoring wrapper must occur exactly once.',
  );
  assert.match(
    descriptors[0]!,
    /\{(?=[^}]*\bconfigurable: true)(?=[^}]*\bvalue: extensions)[^}]*\}/u,
    'BLOCK_SOURCE_WRAPPER_DRIFT: the upstream authoring wrapper must be configurable.',
  );
}

/** Materialize the story assets, then migrate editable declarations with the pinned App. */
export async function buildEditableBlockSource(
  inputPath: string,
  sourceDirectory: string,
  storyArchive: Uint8Array,
  refreshRuntime?: (sourceDirectory: string) => Promise<void>,
  appRoot?: string,
  entryFile = 'story.k4.yml',
): Promise<Buffer> {
  await importSb3({inputPath, outputDirectory: sourceDirectory});
  const runtimePath = path.join(sourceDirectory, 'extensions/kubohiroyakamishibai4.js');
  const runtime = await readFile(runtimePath, 'utf8');
  assertBlockSourceRuntimeWrapper(runtime);
  await refreshRuntime?.(sourceDirectory);
  const projectPath = path.join(sourceDirectory, 'project.source.json');
  const project = JSON.parse(await readFile(projectPath, 'utf8')) as ScratchProject;
  const story = JSON.parse(
    strFromU8(unzipSync(storyArchive)['project.json']!),
  ) as ScratchProject;
  const component =
    project.extensionStorage?.kubohiroyakamishibai4?.components
      ?.kubohiroyakamishibairuntime4;
  const storyComponent =
    story.extensionStorage?.kubohiroyakamishibai4?.components
      ?.kubohiroyakamishibairuntime4;
  assert(component, 'The editable block source must contain its menu runtime component.');
  assert(
    storyComponent?.assets,
    'The built story must contain its embedded asset bundle.',
  );
  component.assets = appRoot
    ? await alignDsl4BlockAssetBundle(project, storyComponent.assets, appRoot)
    : structuredClone(storyComponent.assets);
  await writeFile(projectPath, `${JSON.stringify(project)}\n`);
  const first = await createDeterministicSb3(sourceDirectory);
  const second = await createDeterministicSb3(sourceDirectory);
  assert.deepEqual(Buffer.from(first.archive), Buffer.from(second.archive));
  return appRoot
    ? migrateEditableBlockSource(first.archive, {appRoot, entryFile})
    : Buffer.from(first.archive);
}
