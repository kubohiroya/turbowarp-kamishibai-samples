import assert from 'node:assert/strict';
import {readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';

import {createDeterministicSb3, importSb3} from '@kubohiroya/sb3-toolchain';

const frozenExtensions = "Object.defineProperty(scoped, 'extensions', {value: extensions});";
const configurableExtensions =
  "Object.defineProperty(scoped, 'extensions', {value: extensions, configurable: true});";

/** Keep the authoring wrapper compatible with the bundle's per-component Scratch proxy. */
export function patchBlockSourceRuntimeWrapper(source: string): string {
  assert.equal(
    source.split(frozenExtensions).length - 1,
    1,
    'BLOCK_SOURCE_WRAPPER_DRIFT: the pinned authoring wrapper must occur exactly once.',
  );
  return source.replace(frozenExtensions, configurableExtensions);
}

/** Edit imported extension source and rebuild through the official toolchain. */
export async function buildEditableBlockSource(
  inputPath: string,
  sourceDirectory: string,
): Promise<Buffer> {
  await importSb3({inputPath, outputDirectory: sourceDirectory});
  const runtimePath = path.join(sourceDirectory, 'extensions/kubohiroyakamishibai4.js');
  const runtime = await readFile(runtimePath, 'utf8');
  await writeFile(runtimePath, patchBlockSourceRuntimeWrapper(runtime));
  const first = await createDeterministicSb3(sourceDirectory);
  const second = await createDeterministicSb3(sourceDirectory);
  assert.deepEqual(Buffer.from(first.archive), Buffer.from(second.archive));
  return Buffer.from(first.archive);
}
