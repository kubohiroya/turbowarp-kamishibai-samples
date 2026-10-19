import assert from 'node:assert/strict';
import {mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {runInNewContext} from 'node:vm';
import {fileURLToPath} from 'node:url';

import {strFromU8, strToU8, unzipSync, zipSync} from 'fflate';
import {test} from 'vitest';

import {
  assertBlockSourceRuntimeWrapper,
  buildEditableBlockSource,
} from '../scripts/build-dsl4-block-source.ts';
import type {ScratchProject} from '../scripts/scratch.ts';

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
            registrations.push(
              ...extension.getInfo().blocks.map((block) => block.opcode),
            );
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
    assertBlockSourceRuntimeWrapper(source);
    assert.deepEqual(registerThroughBundleProxy(source), ['wait']);
    const broken = source.replace(
      /Object\.defineProperty\(scoped, 'extensions', \{[^}]*\}\);/u,
      frozen,
    );
    assert.throws(
      () => registerThroughBundleProxy(broken),
      /read-only and non-configurable/,
    );
    assert.throws(
      () => assertBlockSourceRuntimeWrapper(broken),
      /BLOCK_SOURCE_WRAPPER_DRIFT/,
    );
  });
}

test('accepts upstream configurable wrappers and refuses absent or duplicated wrappers', () => {
  assertBlockSourceRuntimeWrapper(configurable);
  assertBlockSourceRuntimeWrapper(
    "Object.defineProperty(scoped, 'extensions', {configurable: true, value: extensions});",
  );
  assert.throws(() => assertBlockSourceRuntimeWrapper(''), /BLOCK_SOURCE_WRAPPER_DRIFT/);
  assert.throws(
    () => assertBlockSourceRuntimeWrapper(configurable + configurable),
    /BLOCK_SOURCE_WRAPPER_DRIFT/,
  );
});

test('carries embedded file assets into the editable project without replacing its menu or blocks', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'block-source-assets-'));
  const projectFromArchive = (bytes: Uint8Array): ScratchProject =>
    JSON.parse(strFromU8(unzipSync(bytes)['project.json']!)) as ScratchProject;
  const component = (project: ScratchProject) =>
    project.extensionStorage!.kubohiroyakamishibai4!.components!
      .kubohiroyakamishibairuntime4!;
  const archive = (project: ScratchProject) =>
    zipSync({'project.json': strToU8(JSON.stringify(project))});
  const original: ScratchProject = {
    targets: [
      {
        isStage: true,
        name: 'Stage',
        variables: {},
        lists: {},
        broadcasts: {},
        blocks: {
          root: {
            opcode: 'kubohiroyakamishibaiauthoring4_kamishibai',
            topLevel: true,
            parent: null,
            next: null,
            inputs: {VERSION: [1, [10, '4.0']], LABEL: [1, [10, '']]},
          },
        },
        costumes: [],
        sounds: [],
      },
    ],
    extensions: ['kubohiroyakamishibai4'],
    extensionURLs: {
      kubohiroyakamishibai4:
        'data:text/javascript;base64,' +
        Buffer.from(
          `(function(Scratch){
          const scoped = Object.create(Scratch);
          const extensions = Object.create(Scratch.extensions);
          ${configurable}
        })(Scratch);`,
        ).toString('base64'),
    },
    extensionStorage: {
      kubohiroyakamishibai4: {
        components: {
          kubohiroyakamishibairuntime4: {
            application: {mode: 'menu'},
            source: {displayName: 'stub', sourceId: 'stub', text: 'menu stub'},
            artifact: {controlProfile: 'production', stub: true},
            assets: {manifest: {assets: []}, files: []},
          },
        },
      },
    },
  };
  const built = structuredClone(original);
  component(built).application = {mode: 'story'};
  component(built).source.text = 'built story source';
  component(built).artifact = {controlProfile: 'production', stub: false};
  component(built).assets = {
    manifest: {assets: [{id: 'Cover', source: {type: 'file', file: 'cover.svg'}}]},
    files: [{path: 'cover.svg', data: Buffer.from('<svg/>').toString('base64')}],
  };
  try {
    const inputPath = path.join(directory, 'blocks.sb3');
    await writeFile(inputPath, archive(original));
    assert.notDeepEqual(component(original).assets, component(built).assets);
    const output = projectFromArchive(
      await buildEditableBlockSource(
        inputPath,
        path.join(directory, 'source'),
        archive(built),
      ),
    );
    assert.deepEqual(component(output).assets, component(built).assets);
    assert.equal(component(output).application?.mode, 'menu');
    assert.deepEqual(component(output).source, component(original).source);
    assert.deepEqual(component(output).artifact, component(original).artifact);
    assert.deepEqual(output.targets, original.targets);
  } finally {
    await rm(directory, {recursive: true, force: true});
  }
});
