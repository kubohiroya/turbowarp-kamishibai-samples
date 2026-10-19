import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {test} from 'vitest';
import {strFromU8, unzipSync} from 'fflate';

import {replaceBlockSourceRuntime} from '../scripts/block-authoring-builder.ts';

const wrapper = (bundle: string) =>
  `(function(Scratch){
    Object.defineProperty(scoped, 'extensions', {configurable: true, value: extensions});
    ${bundle}
  })(Scratch);`;

test('refreshes only the embedded bundle and refuses unknown or duplicate base content', () => {
  const base = 'Scratch.extensions.register(oldRuntime);';
  const replacement = 'Scratch.extensions.register(newRuntime);';
  assert.equal(replaceBlockSourceRuntime(wrapper(base), base, replacement), wrapper(replacement));
  assert.throws(() => replaceBlockSourceRuntime(wrapper(''), base, replacement), /RUNTIME_DRIFT/);
  assert.throws(
    () => replaceBlockSourceRuntime(wrapper(base + base), base, replacement),
    /RUNTIME_DRIFT/,
  );
  assert.throws(() => replaceBlockSourceRuntime(base, base, replacement), /WRAPPER_DRIFT/);
});

test('every published block project includes title controls below editor modal backdrops', async () => {
  const paths = [
    'urashima/urashima-blocks-4.0.sb3',
    'tutorial/tutorial-blocks-4.0.sb3',
    'my-urashima/my-urashima-blocks-4.0.sb3',
    ...[2, 3, 4].map((count) => `my-urashima/my-urashima-${count}-poses-blocks-4.0.sb3`),
  ];
  for (const path of paths) {
    const bytes = await readFile(new URL(`../stories/${path}`, import.meta.url));
    const project = JSON.parse(strFromU8(unzipSync(bytes)['project.json']!));
    const source = Buffer.from(
      project.extensionURLs.kubohiroyakamishibai4.split(',')[1],
      'base64',
    ).toString();
    assert.match(source, /\.element\.style\.zIndex="50"/u, path);
  }
});

test('refreshes relocated metadata and an exact body while preserving the wrapper', () => {
  const header = '// Name: Story\n// Version: old\n';
  const nextHeader = '// Name: Story\n// Version: new\n';
  const body = 'Scratch.extensions.register(oldRuntime);';
  const nextBody = 'Scratch.extensions.register(newRuntime);';
  const source = header + wrapper(body);
  assert.equal(
    replaceBlockSourceRuntime(source, header + body, nextHeader + nextBody),
    nextHeader + wrapper(nextBody),
  );
  assert.throws(
    () =>
      replaceBlockSourceRuntime(
        source.replace('Version: old', 'Version: unknown'),
        header + body,
        nextHeader + nextBody,
      ),
    /RUNTIME_DRIFT/,
  );
  assert.throws(
    () =>
      replaceBlockSourceRuntime(
        header + wrapper(body + body),
        header + body,
        nextHeader + nextBody,
      ),
    /RUNTIME_DRIFT/,
  );
  assert.throws(
    () => replaceBlockSourceRuntime(source, header, nextHeader + nextBody),
    /RUNTIME_DRIFT/,
  );
});

test('every published block project separates config and embeds its runtime reader', async () => {
  const paths = [
    'urashima/urashima-blocks-4.0.sb3',
    'tutorial/tutorial-blocks-4.0.sb3',
    'my-urashima/my-urashima-blocks-4.0.sb3',
    ...[2, 3, 4].map((count) => `my-urashima/my-urashima-${count}-poses-blocks-4.0.sb3`),
  ];
  for (const path of paths) {
    const bytes = await readFile(new URL(`../stories/${path}`, import.meta.url));
    const project = JSON.parse(strFromU8(unzipSync(bytes)['project.json']!));
    const stage = project.targets.find((target: {isStage: boolean}) => target.isStage);
    const hats = Object.values(stage.blocks).filter(
      (block: any) => block.opcode === 'kubohiroyakamishibaiauthoring4_kamishibaiConfig',
    ) as {inputs: {LABEL: unknown}; topLevel: boolean; parent: unknown}[];
    assert.equal(hats.length, 1, path);
    assert.deepEqual(hats[0]!.inputs.LABEL, [1, [10, '']], path);
    assert.equal(hats[0]!.topLevel, true, path);
    assert.equal(hats[0]!.parent, null, path);
    const runtime = Buffer.from(
      project.extensionURLs.kubohiroyakamishibai4.split(',')[1],
      'base64',
    ).toString();
    assert(runtime.includes('kamishibaiConfig'), path);
    assert(runtime.includes('Configuration label is duplicated'), path);
  }
});
