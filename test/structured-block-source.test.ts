import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

import {createDeterministicSb3, importSb3} from '@kubohiroya/sb3-toolchain';
import {strFromU8, unzipSync} from 'fflate';
import {test} from 'vitest';
import {parse, stringify} from 'yaml';

import type {ScratchProject} from '../scripts/scratch.ts';
import {verifyStructuredBlockSource} from '../scripts/verify-structured-block-source.ts';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const storyPath = path.join(projectRoot, 'stories/urashima/urashima.k4.yml');
const blocksPath = path.join(projectRoot, 'stories/urashima/urashima-blocks-4.0.sb3');
const sourceText = await readFile(storyPath, 'utf8');
const archive = unzipSync(new Uint8Array(await readFile(blocksPath)));
const project = JSON.parse(strFromU8(archive['project.json']!)) as ScratchProject;

test('Urashima exposes all scenes and commands as connected editable blocks', () => {
  verifyStructuredBlockSource(project, sourceText);
});

test('tutorial embeds the eight definition forms and pose/say/think forms', async () => {
  const bytes = unzipSync(new Uint8Array(await readFile(
    path.join(projectRoot, 'stories/tutorial/tutorial-blocks-4.0.sb3'),
  )));
  verifyStructuredBlockSource(
    JSON.parse(strFromU8(bytes['project.json']!)) as ScratchProject,
    await readFile(path.join(projectRoot, 'stories/tutorial/story.kamishibai.yaml'), 'utf8'),
  );
});

test('rejects a named Stage script that cannot act as the playback root', () => {
  const named = structuredClone(project);
  const hat = Object.values(named.targets.find((target) => target.isStage)!.blocks).find(
    (block) => block.opcode === 'kubohiroyakamishibaiauthoring4_kamishibai',
  )!;
  hat.inputs!.LABEL = [1, [10, 'chapter']];
  assert.throws(() => verifyStructuredBlockSource(named, sourceText), /root script name must be empty/);
});

test('rejects an embedded authoring extension without definition forms', () => {
  const old = structuredClone(project);
  old.extensionURLs!.kubohiroyakamishibaiauthoring4 =
    'data:text/javascript;base64,' + Buffer.from('Scratch.extensions.register({});').toString('base64');
  assert.throws(() => verifyStructuredBlockSource(old, sourceText), /all eight definition forms/);
});

test('rejects a pose form registered against the wrong argument', () => {
  const broken = structuredClone(project);
  const url = broken.extensionURLs!.kubohiroyakamishibaiauthoring4!;
  const source = Buffer.from(url.split(',')[1]!, 'base64').toString('utf8');
  assert(source.includes('STEPS'), 'The authoring extension must contain the pose steps form.');
  broken.extensionURLs!.kubohiroyakamishibaiauthoring4 =
    'data:text/javascript;base64,' + Buffer.from(source.replaceAll('STEPS', 'VALUE')).toString('base64');
  assert.throws(() => verifyStructuredBlockSource(broken, sourceText), /pose must edit STEPS/);
});

for (const command of ['say', 'think']) {
  test(`rejects a ${command} form registered against the wrong argument`, () => {
    const broken = structuredClone(project);
    const url = broken.extensionURLs!.kubohiroyakamishibaiauthoring4!;
    const source = Buffer.from(url.split(',')[1]!, 'base64').toString('utf8');
    const declaration = new RegExp(`("editorId":"action-${command}-spec"[^}]*"argument":)"SPEC"`);
    assert(declaration.test(source), `The authoring extension must contain the ${command} SPEC form.`);
    broken.extensionURLs!.kubohiroyakamishibaiauthoring4 =
      'data:text/javascript;base64,' + Buffer.from(source.replace(declaration, '$1"VALUE"')).toString('base64');
    assert.throws(() => verifyStructuredBlockSource(broken, sourceText), /say\/think must edit SPEC/);
  });
}

test('rejects a published project with its source section block hidden', () => {
  const hidden = structuredClone(project);
  const url = hidden.extensionURLs!.kubohiroyakamishibaiauthoring4!;
  const source = Buffer.from(url.split(',')[1]!, 'base64').toString('utf8');
  const visible = '"opcode":"useSection","blockType":"command","branchCount":1,"hideFromPalette":false';
  assert(source.includes(visible));
  hidden.extensionURLs!.kubohiroyakamishibaiauthoring4 =
    'data:text/javascript;base64,' +
    Buffer.from(source.replace(visible, visible.replace(':false', ':true'))).toString('base64');
  assert.throws(() => verifyStructuredBlockSource(hidden, sourceText), /Source section palette visibility/);
});

test('rejects the old two-block YAML declaration even when its source is correct', () => {
  const old = structuredClone(project);
  old.targets[0]!.blocks = {
    hat: {
      opcode: 'kubohiroyakamishibai4_kubohiroyakamishibairuntime4__whenDsl4Source',
      next: 'yaml',
      topLevel: true,
    },
    yaml: {
      opcode: 'kubohiroyakamishibai4_kubohiroyakamishibairuntime4__dsl4SourceFromYamlJson',
      parent: 'hat',
      inputs: {FRAGMENT: [1, [10, sourceText]]},
    },
  };
  assert.throws(() => verifyStructuredBlockSource(old, sourceText), /retired YAML string/);
});

test('rejects a scene with its visible command stack disconnected', () => {
  const broken = structuredClone(project);
  const scene = Object.values(broken.targets[0]!.blocks).find(
    (block) => block.opcode === 'kubohiroyakamishibaiauthoring4_scene',
  )!;
  delete scene.inputs!.SUBSTACK;
  assert.throws(
    () => verifyStructuredBlockSource(broken, sourceText),
    /every command in script order/,
  );
});

test('an edited wait block exports its new value without changing the remaining story', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'urashima-block-edit-'));
  try {
    const sourceDirectory = path.join(directory, 'source');
    await importSb3({
      inputPath: blocksPath,
      outputDirectory: sourceDirectory,
    });
    const projectPath = path.join(sourceDirectory, 'project.source.json');
    const edited = JSON.parse(await readFile(projectPath, 'utf8')) as ScratchProject;
    const wait = Object.values(edited.targets[0]!.blocks).find(
      (block) => block.opcode === 'kubohiroyakamishibai4_kubohiroyakamishibairuntime4__wait',
    )!;
    wait.inputs!.SECONDS = [1, [4, 2.75]];
    await writeFile(projectPath, `${JSON.stringify(edited)}\n`);
    const rebuilt = await createDeterministicSb3(sourceDirectory);
    const editedPath = path.join(directory, 'edited.sb3');
    await writeFile(editedPath, rebuilt.archive);
    const builderRoot = path.resolve(
      process.env.TURBOWARP_KAMISHIBAI_BLOCK_AUTHORING_ROOT ??
        process.env.TURBOWARP_KAMISHIBAI_APP_ROOT ??
        path.join(projectRoot, '../turbowarp-kamishibai-app'),
    );
    const result = spawnSync(
      process.execPath,
      [
        path.join(builderRoot, 'bin/turbowarp-kamishibai.mjs'),
        'export-block-dsl',
        '--input',
        editedPath,
        '--output-dir',
        directory,
        '--name',
        'edited',
      ],
      {encoding: 'utf8'},
    );
    assert.equal(result.status, 0, `${result.stdout}${result.stderr}`);
    const expected = parse(sourceText);
    const firstWait = expected.scenes.opening.find(
      (action: Record<string, unknown>) => 'wait' in action,
    );
    assert(firstWait, 'The opening scene must demonstrate an editable wait.');
    firstWait.wait = 2.75;
    const expectedPath = path.join(directory, 'expected.k4.yml');
    await writeFile(expectedPath, stringify(expected));
    const canonical = (input: string) => {
      const validated = spawnSync(
        process.execPath,
        [
          path.join(builderRoot, 'bin/turbowarp-kamishibai.mjs'),
          'validate-dsl4',
          '--input',
          input,
          '--format',
          'canonical-json',
        ],
        {encoding: 'utf8'},
      );
      assert.equal(validated.status, 0, `${validated.stdout}${validated.stderr}`);
      return validated.stdout;
    };
    assert.equal(canonical(path.join(directory, 'edited.k4.yml')), canonical(expectedPath));
  } finally {
    await rm(directory, {recursive: true, force: true});
  }
});
