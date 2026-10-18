import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {fileURLToPath} from 'node:url';

import {strFromU8, unzipSync} from 'fflate';
import {test} from 'vitest';

import {patchBlockSourceRuntimeWrapper} from '../scripts/build-dsl4-block-source.ts';

const frozen = "Object.defineProperty(scoped, 'extensions', {value: extensions});";
const configurable =
  "Object.defineProperty(scoped, 'extensions', {value: extensions, configurable: true});";

async function runtimeSource(story: string): Promise<string> {
  const file = fileURLToPath(
    new URL(`../stories/${story}/${story}-blocks-4.0.sb3`, import.meta.url),
  );
  const archive = unzipSync(new Uint8Array(await readFile(file)));
  const project = JSON.parse(strFromU8(archive['project.json']!));
  return Buffer.from(
    project.extensionURLs.kubohiroyakamishibai4.split(',')[1],
    'base64',
  ).toString();
}

/** Exercise the emitted wrapper with the bundle's actual per-component proxy contract. */
function registerThroughBundleProxy(source: string): string[] {
  const inner = source.indexOf('    (function(Scratch){\n');
  assert(inner > 0, 'The generated authoring wrapper must contain its bundled runtime.');
  const registrations: string[] = [];
  runInNewContext(
    `${source.slice(0, inner)}
    (function(Scratch){
      const componentExtensions = Object.create(Scratch.extensions);
      Object.defineProperty(componentExtensions, 'register', {value(extension){
        Scratch.extensions.register(extension);
      }});
      const componentScratch = new Proxy(Scratch, {
        get(target, property) {
          if (property === 'extensions') return componentExtensions;
          return Reflect.get(target, property, target);
        }
      });
      componentScratch.extensions.register({getInfo(){return {
        id: 'runtime', blocks: [{opcode: 'whenDsl4Source'}, {opcode: 'wait'}]
      };}});
    })(scoped);
  })(Scratch);`,
    {
      Scratch: {
        extensions: {
          register(extension: {getInfo(): {blocks: {opcode: string}[]}}) {
            registrations.push(...extension.getInfo().blocks.map((block) => block.opcode));
          },
        },
      },
    },
  );
  return registrations;
}

for (const story of ['urashima', 'tutorial']) {
  test(`${story} authoring wrapper permits bundle registration and filters retired blocks`, async () => {
    const source = await runtimeSource(story);
    assert.equal(source.split(configurable).length - 1, 1);
    assert.deepEqual(registerThroughBundleProxy(source), ['wait']);
    const broken = source.replace(configurable, frozen);
    assert.throws(() => registerThroughBundleProxy(broken), /read-only and non-configurable/);
    assert.equal(patchBlockSourceRuntimeWrapper(broken), source);
  });
}

test('refuses an absent or duplicated pinned authoring wrapper', () => {
  assert.throws(() => patchBlockSourceRuntimeWrapper(''), /BLOCK_SOURCE_WRAPPER_DRIFT/);
  assert.throws(
    () => patchBlockSourceRuntimeWrapper(frozen + frozen),
    /BLOCK_SOURCE_WRAPPER_DRIFT/,
  );
});
