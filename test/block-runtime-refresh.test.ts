import {assertEmbeddedYamlBlockSource} from '../scripts/migrate-embedded-yaml.ts';
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

test('every published block project keeps title controls below Player startup and editor overlays', async () => {
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
    assert.match(source, /\.element\.style\.zIndex="0"/u, path);
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

test('every newly generated block project has an explicit independent root and a named script document', async () => {
  const paths = [
    'urashima/urashima-blocks-4.0.sb3',
    'tutorial/tutorial-blocks-4.0.sb3',
    'my-urashima/my-urashima-blocks-4.0.sb3',
    ...[2, 3, 4].map((count) => `my-urashima/my-urashima-${count}-poses-blocks-4.0.sb3`),
    'audio-playback/audio-blocks-4.0.sb3',
    'three-visits/three-visits-blocks-4.0.sb3',
  ];
  for (const path of paths) {
    const bytes = await readFile(new URL(`../stories/${path}`, import.meta.url));
    const project = JSON.parse(strFromU8(unzipSync(bytes)['project.json']!));
    assertEmbeddedYamlBlockSource(project);
    const component = project.extensionStorage.kubohiroyakamishibai4.components.kubohiroyakamishibairuntime4;
    assert(component.sourceDocuments, `${path}: the source graph must retain each named document.`);
    assert.equal(component.sourceDocuments.formatVersion, 1, path);
    assert(Object.keys(component.sourceDocuments.files).length > 0, path);
    const runtime = Buffer.from(project.extensionURLs.kubohiroyakamishibai4.split(',')[1], 'base64').toString();
    assert(runtime.includes('embeddedYamlRoot'), path);
  }
});
