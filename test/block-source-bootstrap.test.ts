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

const frozen =
  "Object.defineProperty(scoped, 'extensions', {value: extensions});";
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

/** Exercise the official bundle scope with the actual per-component extension proxy. */
function registerThroughBundleProxy(source: string): string[] {
  const marker = '  const createComponentScratch = ';
  assert.equal(
    source.split(marker).length,
    2,
    'The official bundle must contain one scope factory.',
  );
  const start = source.indexOf(marker);
  const end = source.indexOf('  const loadComponent = ', start);
  assert(
    end > start,
    'The official bundle scope factory must precede component loading.',
  );
  const registrations: string[] = [];
  runInNewContext(
    `const createComponentGui = () => undefined;
    ${source.slice(start, end)}
    const scoped = createComponentScratch('runtime', accept);
    const componentExtensions = Object.create(scoped.extensions);
    Object.defineProperty(componentExtensions, 'register', {value(extension){
      scoped.extensions.register(extension);
    }});
    const componentScratch = new Proxy(scoped, {
      get(target, property) {
        return property === 'extensions' ? componentExtensions : Reflect.get(target, property, target);
      }
    });
    componentScratch.extensions.register({getInfo(){return {
      blocks: [{opcode: 'embeddedYamlRoot'}, {opcode: 'embeddedYaml'}, {opcode: 'wait'}]
    };}});`,
    {
      Scratch: {
        extensions: {
          register() {
            throw new Error('Component scope was bypassed.');
          },
        },
      },
      accept(extension: {getInfo(): {blocks: {opcode: string}[]}}) {
        registrations.push(
          ...extension.getInfo().blocks.map((block) => block.opcode),
        );
      },
    },
    {timeout: 2000},
  );
  return registrations;
}

for (const story of ['urashima', 'tutorial']) {
  test(`${story} uses the official bundle proxy and hides retired authoring blocks`, async () => {
    const source = await runtimeSource(story);
    const appRoot =
      process.env.TURBOWARP_KAMISHIBAI_APP_ROOT ??
      path.resolve(import.meta.dirname, '../../turbowarp-kamishibai-app');
    assert.equal(
      source,
      await readFile(
        path.join(
          appRoot,
          'dist/builder/generated/dsl4-narrative-playback-runtime-extension.js',
        ),
        'utf8',
      ),
      'Migrated samples must retain the exact official runtime rather than a local wrapper.',
    );
    assert.deepEqual(registerThroughBundleProxy(source), [
      'embeddedYamlRoot',
      'embeddedYaml',
      'wait',
    ]);
    const broken = source.replace(
      "if (property === 'extensions') return extensions;",
      '',
    );
    assert.notEqual(broken, source);
    assert.throws(
      () => registerThroughBundleProxy(broken),
      /Component scope was bypassed/u,
    );

    const file = fileURLToPath(
      new URL(`../stories/${story}/${story}-blocks-4.0.sb3`, import.meta.url),
    );
    const project = JSON.parse(
      strFromU8(unzipSync(await readFile(file))['project.json']!),
    );
    const authoring = Buffer.from(
      project.extensionURLs.kubohiroyakamishibaiauthoring4.split(',')[1],
      'base64',
    ).toString('utf8');
    const blocks: {opcode: string; hideFromPalette?: boolean}[] = [];
    runInNewContext(
      authoring,
      {
        Scratch: {
          extensions: {
            register(extension: {getInfo(): {blocks: typeof blocks}}) {
              blocks.push(...extension.getInfo().blocks);
            },
          },
        },
      },
      {timeout: 2000},
    );
    for (const opcode of ['kamishibai', 'kamishibaiConfig', 'includeBlocks']) {
      const definitions = blocks.filter((block) => block.opcode === opcode);
      assert.equal(
        definitions.length,
        1,
        `Legacy ${opcode} must remain readable.`,
      );
      assert.equal(
        definitions[0]!.hideFromPalette,
        true,
        `Legacy ${opcode} must not be offered.`,
      );
    }
    assert(!blocks.some((block) => block.opcode === 'whenDsl4Source'));
  });
}

test('accepts upstream configurable wrappers and refuses absent or duplicated wrappers', () => {
  assertBlockSourceRuntimeWrapper(configurable);
  assert.throws(
    () => assertBlockSourceRuntimeWrapper(frozen),
    /BLOCK_SOURCE_WRAPPER_DRIFT/,
  );
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
