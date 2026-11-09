import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {copyFile, mkdir, mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

import {createDeterministicSb3, importSb3} from '@kubohiroya/sb3-toolchain';
import {parse, stringify} from 'yaml';

import {appBasePath, appRuntimeIdentity, readAppRelease} from './app-dependency.ts';
import {resolveBlockAuthoringBuilder} from './block-authoring-builder.ts';
import {buildEditableBlockSource} from './build-dsl4-block-source.ts';
import {simplifyPublishedDsl4Blocks} from './simplify-published-dsl4-blocks.ts';
import {
  checkSubmission,
  composeParticipants,
  composeSlots,
  parseSubmission,
} from '../resources/tekona-workshop/assistant/compose-participants.js';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const storyRoot = path.join(projectRoot, 'stories/tekona');
const composeModule = 'resources/tekona-workshop/assistant/compose-participants.js';
const composeTemplate = 'resources/tekona-workshop/assistant/compose.template.html';
/** The assistant page, opened directly from a folder, so the module is inlined as a classic script. */
export const composePage = 'resources/tekona-workshop/assistant/compose.html';

export async function renderComposePage(): Promise<string> {
  const module = await readFile(path.join(projectRoot, composeModule), 'utf8');
  const classic = module.replace(/^export (?=(?:async )?function |const )/gmu, '');
  assert(!/^\s*(?:export|import)\b/mu.test(classic), 'The compose module must inline as a classic script.');
  const template = await readFile(path.join(projectRoot, composeTemplate), 'utf8');
  assert.equal(template.split('/*COMPOSE_PARTICIPANTS*/').length, 2);
  return template.replace('/*COMPOSE_PARTICIPANTS*/', () => classic.trimEnd());
}
const sourceName = 'tekona.k4.yml';
const projectAssetsName = 'project-assets-dsl4.yml';
/** Workshop SB3: story sprites, costumes and sounds only; the YAML is opened from the menu. */
export const tekonaWorkshopOutput = 'tekona-workshop-4.0.sb3';
/** The half-finished story embedded for direct playback. */
export const tekonaYamlOutput = 'tekona-4.0.sb3';
/** The half-finished story as script blocks, for reading and editing the existing scenes. */
export const tekonaBlocksOutput = 'tekona-blocks-4.0.sb3';
/** Block-script workshop SB3: participant slots with placeholder assets, replaced in the editor. */
export const tekonaBlockWorkshopOutput = 'tekona-workshop-blocks-4.0.sb3';
const workshopConfigName = 'workshop.config.json';

interface WorkshopConfig {
  formatVersion: 1;
  blockWorkshop: {
    slots: number;
    sampleModelUrl: string;
    /** Optional pre-uploaded model per seat ("01": URL); other seats use the sample model. */
    slotModelUrls?: Record<string, string>;
    slotCostumes: {stand: string; pose: string};
  };
}

/** Seat numbers 01…NN of the block-script workshop slots. */
export function slotSeats(count: number): string[] {
  return Array.from({length: count}, (_, index) => String(index + 1).padStart(2, '0'));
}

/** A board submission in the handout format, used to check that the template still composes. */
export const sampleSubmission = `席番号：01
作者の名前（紙芝居に出してよい名前）：リハーサル
求婚者の名前：入江の漁師
決めポーズの説明：網を投げるように、両うでを斜め上へ！
求婚の言葉：この入江でいちばんの魚を、毎朝とどけよう！
手児奈のことわりの言葉：お魚はうれしいけれど、心はさしあげられません。
ことわられたときのひとこと：……魚は逃げても、またとれるさ。
手児奈の心はゆれた？（ゆれた／ゆれなかった）：ゆれた
モデルのリンク：https://teachablemachine.withgoogle.com/models/WORKSHOP-REHEARSAL-01/`;

async function record(root: string, filename: string) {
  const bytes = await readFile(path.join(root, filename));
  return {
    path: filename,
    size: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  };
}

/** Build the workshop, YAML and block-script SB3 from the pinned published App release. */
export async function buildTekona({writeLock = false}: {writeLock?: boolean} = {}) {
  const release = await readAppRelease();
  const builder = await resolveBlockAuthoringBuilder();
  const packageJson = JSON.parse(await readFile(path.join(builder.root, 'package.json'), 'utf8'));
  assert.equal(packageJson.version, release.version);
  const base = await readFile(appBasePath());
  assert.equal(base.length, release.artifact.size);
  assert.equal(createHash('sha256').update(base).digest('hex'), release.artifact.sha256);
  const temporary = await mkdtemp(path.join(tmpdir(), 'kamishibai-tekona-'));
  const run = (args: string[]) =>
    execFileSync(process.execPath, [builder.cli, ...args], {
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
    });
  const build = (projectDirectory: string, base: string, output: string) =>
    run([
      'build-dsl4', '--embedded-source-documents',
      '--base', base,
      '--project-root', projectDirectory,
      '--source', sourceName,
      '--output', output,
      '--control-profile', 'production',
      '--channel', 'bundled',
      '--replace-existing',
    ]);
  try {
    const imported = path.join(temporary, 'base-source');
    await importSb3({inputPath: appBasePath(), outputDirectory: imported});
    const workshop = await createDeterministicSb3(imported, {
      allowedAssetRoots: [
        path.join(storyRoot, 'assets'),
        path.join(projectRoot, 'stories/urashima/assets'),
      ],
      projectAssetsPath: path.join(storyRoot, projectAssetsName),
    });
    const workshopPath = path.join(temporary, tekonaWorkshopOutput);
    await writeFile(workshopPath, workshop.archive);

    const sourcePath = path.join(storyRoot, sourceName);
    const source = await readFile(sourcePath, 'utf8');
    run(['validate-dsl4', '--input', sourcePath]);
    const yamlPath = path.join(temporary, tekonaYamlOutput);
    build(storyRoot, workshopPath, yamlPath);

    // The participant template must still compose into a valid story.
    const submission = parseSubmission(sampleSubmission);
    assert.deepEqual(checkSubmission(submission), []);
    const composedPath = path.join(temporary, 'composed.k4.yml');
    await writeFile(composedPath, composeParticipants(source, [submission]));
    run(['validate-dsl4', '--input', composedPath]);

    // Block sources do not carry YAML comments; author them from the comment-free document.
    const authoringRoot = path.join(temporary, 'authoring');
    await mkdir(authoringRoot, {recursive: true});
    await writeFile(path.join(authoringRoot, sourceName), stringify(parse(source), {lineWidth: 0}));
    const authoringBasePath = path.join(temporary, 'authoring-base.sb3');
    build(authoringRoot, workshopPath, authoringBasePath);
    const authoredPath = path.join(temporary, 'authored-blocks.sb3');
    run([
      'author-block-dsl',
      '--base', authoringBasePath,
      '--input', path.join(authoringRoot, sourceName),
      '--output', authoredPath,
      ...builder.authorOptions,
    ]);
    await simplifyPublishedDsl4Blocks(
      authoredPath, builder.root, builder.identity.sourceSections ?? false, storyRoot,
    );
    const blocksPath = path.join(temporary, tekonaBlocksOutput);
    await writeFile(blocksPath, await buildEditableBlockSource(
      authoredPath,
      path.join(temporary, 'block-source'),
      await readFile(authoringBasePath),
      builder.refreshRuntime,
      builder.root,
      sourceName,
    ));
    const exported = path.join(temporary, 'exported');
    run(['export-block-dsl', '--input', blocksPath, '--output-dir', exported, '--name', 'tekona']);
    assert.deepEqual(
      Object.keys(parse(await readFile(path.join(exported, sourceName), 'utf8')).scenes),
      Object.keys(parse(source).scenes),
      'The block scenes must match the half-finished source.',
    );

    // Block-script workshop: pre-registered slots whose placeholder assets are replaced later.
    const config = JSON.parse(await readFile(path.join(storyRoot, workshopConfigName), 'utf8')) as WorkshopConfig;
    assert.equal(config.formatVersion, 1);
    const {slots, sampleModelUrl, slotCostumes} = config.blockWorkshop;
    const manifest = parse(await readFile(path.join(storyRoot, projectAssetsName), 'utf8'));
    // The slot manifest is written elsewhere, so resolve every file from the story directory.
    const fromSlotManifest = (file: string) => path.relative(temporary, path.resolve(storyRoot, file));
    for (const asset of Object.values(manifest.assets) as {file: string}[])
      asset.file = fromSlotManifest(asset.file);
    for (const nn of slotSeats(slots)) {
      for (const kind of ['stand', 'pose'] as const) {
        assert(!manifest.assets[`s${nn}-${kind}`], `Slot costume s${nn}-${kind} is already declared.`);
        manifest.assets[`s${nn}-${kind}`] = {
          ...manifest.assets[`newcomer-${kind}`],
          file: fromSlotManifest(slotCostumes[kind]),
        };
      }
    }
    const slotManifestPath = path.join(temporary, 'slot-project-assets.yml');
    await writeFile(slotManifestPath, stringify(manifest));
    const slotBase = await createDeterministicSb3(imported, {
      allowedAssetRoots: [
        path.join(storyRoot, 'assets'),
        path.join(projectRoot, 'stories/urashima/assets'),
      ],
      projectAssetsPath: slotManifestPath,
    });
    const slotBasePath = path.join(temporary, 'slot-base.sb3');
    await writeFile(slotBasePath, slotBase.archive);
    const slotRoot = path.join(temporary, 'slots');
    await mkdir(slotRoot, {recursive: true});
    const slotSource = stringify(parse(composeSlots(source, slots, {
      modelUrl: sampleModelUrl,
      modelUrls: config.blockWorkshop.slotModelUrls ?? {},
    })), {lineWidth: 0});
    await writeFile(path.join(slotRoot, sourceName), slotSource);
    run(['validate-dsl4', '--input', path.join(slotRoot, sourceName)]);
    const slotYamlPath = path.join(temporary, 'slot-story.sb3');
    build(slotRoot, slotBasePath, slotYamlPath);
    const slotAuthoredPath = path.join(temporary, 'slot-authored.sb3');
    run([
      'author-block-dsl',
      '--base', slotYamlPath,
      '--input', path.join(slotRoot, sourceName),
      '--output', slotAuthoredPath,
      ...builder.authorOptions,
    ]);
    await simplifyPublishedDsl4Blocks(
      slotAuthoredPath, builder.root, builder.identity.sourceSections ?? false, storyRoot,
    );
    const blockWorkshopPath = path.join(temporary, tekonaBlockWorkshopOutput);
    await writeFile(blockWorkshopPath, await buildEditableBlockSource(
      slotAuthoredPath,
      path.join(temporary, 'slot-block-source'),
      await readFile(slotYamlPath),
      builder.refreshRuntime,
      builder.root,
      sourceName,
    ));
    const slotExported = path.join(temporary, 'slot-exported');
    run(['export-block-dsl', '--input', blockWorkshopPath, '--output-dir', slotExported, '--name', 'tekona']);
    const slotScenes = Object.keys(parse(await readFile(path.join(slotExported, sourceName), 'utf8')).scenes);
    assert.deepEqual(
      slotScenes.slice(slotScenes.indexOf('proposals'), slotScenes.indexOf('quarrel') + 1),
      ['proposals', ...slotSeats(slots).map((nn) => `suitor-${nn}`), 'quarrel'],
      'The block workshop slots must stay between proposals and quarrel.',
    );

    const lock = {
      formatVersion: 1,
      runtime: appRuntimeIdentity(release),
      builder: {
        package: packageJson.name,
        version: packageJson.version,
        commit: release.commit,
      },
      sources: [
        ...(await Promise.all([sourceName, projectAssetsName].map((name) => record(storyRoot, name)))),
        await record(projectRoot, composeModule),
        await record(projectRoot, composeTemplate),
        await record(storyRoot, workshopConfigName),
      ],
      outputs: {
        workshop: await record(temporary, tekonaWorkshopOutput),
        yaml: await record(temporary, tekonaYamlOutput),
        blocks: await record(temporary, tekonaBlocksOutput),
        blockWorkshop: await record(temporary, tekonaBlockWorkshopOutput),
      },
    };
    const lockPath = path.join(storyRoot, 'dsl4-artifacts.lock.json');
    const page = await renderComposePage();
    if (writeLock) {
      await writeFile(path.join(projectRoot, composePage), page);
      for (const name of [tekonaWorkshopOutput, tekonaYamlOutput, tekonaBlocksOutput, tekonaBlockWorkshopOutput])
        await copyFile(path.join(temporary, name), path.join(storyRoot, name));
      await writeFile(lockPath, JSON.stringify(lock, null, 2) + '\n');
    } else {
      assert.deepEqual(
        lock,
        JSON.parse(await readFile(lockPath, 'utf8')),
        'Tekona workshop artifacts are stale; run update:tekona.',
      );
      assert.equal(await readFile(path.join(projectRoot, composePage), 'utf8'), page,
        'The assistant compose page is stale; run update:tekona.');
    }
    return lock;
  } finally {
    await rm(temporary, {recursive: true, force: true});
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const lock = await buildTekona({writeLock: process.argv.includes('--write-lock')});
  console.log(`Built tekona workshop artifacts with ${lock.builder.version}.`);
}
