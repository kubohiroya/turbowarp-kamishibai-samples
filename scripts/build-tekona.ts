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
import {buildPackagedWeb} from './build-packaged-web.ts';
import type {WebConfig} from './story-config.ts';
import {assertSameBytes} from './same-bytes.ts';
import {requireFresh} from './artifact-freshness.ts';
import {readExportedDsl4Source, simplifyPublishedDsl4Blocks} from './simplify-published-dsl4-blocks.ts';
import {writeTekonaSourceModules} from './tekona-source-modules.ts';
import {strFromU8, unzipSync} from 'fflate';
import {
  checkSubmission,
  composeParticipants,
  composeSlots,
  costumeNames,
  parseSubmission,
  placeholderModelUrl,
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
/** The prepared suitors' scenes, in story order; participants follow the last one. */
export const preparedScenes = ['ryoshi', 'sato', 'utabito', 'hataori', 'gunji', 'kokufu', 'sakimori', 'miyako'];
const lastPreparedScene = preparedScenes.at(-1)!;

interface WorkshopConfig {
  formatVersion: 1;
  blockWorkshop: {
    slots: number;
    sampleModelUrl: string;
    /** Optional pre-uploaded model per seat ("01": URL); other seats use the sample model. */
    slotModelUrls?: Record<string, string>;
    slotCostumes: {stand: string; kime: string; rejected: string};
  };
}

/** Seat numbers 01…NN of the block-script workshop slots. */
export function slotSeats(count: number): string[] {
  return Array.from({length: count}, (_, index) => String(index + 1).padStart(2, '0'));
}

/** A board submission in the handout format, used to check that the template still composes. */
export const sampleSubmission = `席番号：01
作者の名前（紙芝居に表示してよい名前）：リハーサル
求婚者の名前：入江の漁師
決めポーズの説明：網を投げるように、両うでを斜め上へ！
落胆のポーズの説明：両手で頭をかかえて、うなだれる……。
求婚の言葉：この入江でいちばんの魚を、毎朝とどけよう！
手児奈の断りの言葉：お魚はうれしいけれど、心はさしあげられません。
断られたときの一言：……魚は逃げても、またとれるさ。
手児奈の心は揺れたか（揺れた／揺れなかった）：揺れた
モデルのリンク：${placeholderModelUrl}`;

async function record(root: string, filename: string) {
  const bytes = await readFile(path.join(root, filename));
  return {
    path: filename,
    size: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  };
}

interface TekonaPreview {
  appRoot: string;
  basePath: string;
  outputDirectory: string;
}

/** Published builds use the pin; an explicit local preview writes only to .tmp. */
export async function buildTekona({writeLock = false, outputDirectory, preview}: {
  writeLock?: boolean; outputDirectory?: string; preview?: TekonaPreview;
} = {}) {
  const release = await readAppRelease();
  const builder = preview ? {
    root: path.resolve(preview.appRoot),
    cli: path.join(path.resolve(preview.appRoot), 'bin/turbowarp-kamishibai.mjs'),
    identity: {sourceSections: true},
    authorOptions: ['--block-sections', 'true'],
    refreshRuntime: undefined,
  } : await resolveBlockAuthoringBuilder();
  const packageJson = JSON.parse(await readFile(path.join(builder.root, 'package.json'), 'utf8'));
  if (!preview) assert.equal(packageJson.version, release.version);
  const basePath = preview ? path.resolve(preview.basePath) : appBasePath(release.version);
  const destination = preview ? path.resolve(preview.outputDirectory) : storyRoot;
  if (preview) {
    assert(destination.startsWith(path.join(projectRoot, '.tmp') + path.sep), 'Preview output must stay under .tmp.');
    assert(writeLock, 'A local preview must explicitly write its separate outputs.');
    await mkdir(destination, {recursive: true});
  }
  const base = await readFile(basePath);
  if (!preview) {
    assert.equal(base.length, release.artifact.size);
    assert.equal(createHash('sha256').update(base).digest('hex'), release.artifact.sha256);
  }
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
    await importSb3({inputPath: basePath, outputDirectory: imported});
    const allowedAssetRoots = [
      path.join(storyRoot, 'assets'),
      path.join(projectRoot, 'stories/urashima/assets'),
    ];
    // The story without participants: Tekona, the prepared suitors and the narration.
    const storyBase = await createDeterministicSb3(imported, {
      allowedAssetRoots,
      projectAssetsPath: path.join(storyRoot, projectAssetsName),
    });
    const storyBasePath = path.join(temporary, 'story-base.sb3');
    await writeFile(storyBasePath, storyBase.archive);

    // Workshop base: one sprite SuitorNN per seat, with placeholder costumes stand/kime/rejected.
    const config = JSON.parse(await readFile(path.join(storyRoot, workshopConfigName), 'utf8')) as WorkshopConfig;
    assert.equal(config.formatVersion, 1);
    const {slots, sampleModelUrl, slotCostumes} = config.blockWorkshop;
    const manifest = parse(await readFile(path.join(storyRoot, projectAssetsName), 'utf8'));
    // The slot manifest is written elsewhere, so resolve every file from the story directory.
    const fromSlotManifest = (file: string) => path.relative(temporary, path.resolve(storyRoot, file));
    for (const asset of Object.values(manifest.assets) as {file: string}[])
      asset.file = fromSlotManifest(asset.file);
    const narration = manifest.sprites.Narration;
    delete manifest.sprites.Narration;
    let layer = Math.max(...Object.values(manifest.sprites as Record<string, {layerOrder: number}>)
      .map(({layerOrder}) => layerOrder));
    for (const nn of slotSeats(slots)) {
      assert(!manifest.sprites[`Suitor${nn}`], `Slot sprite Suitor${nn} is already declared.`);
      manifest.sprites[`Suitor${nn}`] = {...manifest.sprites.Sato, layerOrder: ++layer};
      for (const costume of costumeNames) {
        assert(!manifest.assets[`s${nn}-${costume}`], `Slot costume s${nn}-${costume} is already declared.`);
        manifest.assets[`s${nn}-${costume}`] = {
          ...manifest.assets[`sato-${costume}`],
          target: `Suitor${nn}`,
          name: costume,
          file: fromSlotManifest(slotCostumes[costume as keyof typeof slotCostumes]),
        };
      }
    }
    manifest.sprites.Narration = {...narration, layerOrder: ++layer};
    const slotManifestPath = path.join(temporary, 'slot-project-assets.yml');
    await writeFile(slotManifestPath, stringify(manifest));
    const workshop = await createDeterministicSb3(imported, {allowedAssetRoots, projectAssetsPath: slotManifestPath});
    const workshopPath = path.join(temporary, tekonaWorkshopOutput);
    await writeFile(workshopPath, workshop.archive);

    const sourcePath = path.join(storyRoot, sourceName);
    const source = await readFile(sourcePath, 'utf8');
    run(['validate-dsl4', '--input', sourcePath]);
    const authoringRoot = path.join(temporary, 'authoring');
    await writeTekonaSourceModules(authoringRoot, source);
    const yamlPath = path.join(temporary, tekonaYamlOutput);
    build(authoringRoot, storyBasePath, yamlPath);

    // The participant template must still compose into a valid story.
    const submission = parseSubmission(sampleSubmission);
    assert.deepEqual(checkSubmission(submission), []);
    const composedPath = path.join(temporary, 'composed.k4.yml');
    await writeFile(composedPath, composeParticipants(source, [submission]));
    run(['validate-dsl4', '--input', composedPath]);

    // Author one named internal document per scene, retaining false guards in the actual YAML.
    const authoringBasePath = yamlPath;
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
    const exportResult = run(['export-block-dsl', '--input', blocksPath, '--output-dir', exported, '--name', 'tekona', '--format', 'json']);
    assert.deepEqual(
      Object.keys(parse(await readExportedDsl4Source(exportResult, builder.root,
        JSON.parse(strFromU8(unzipSync(await readFile(blocksPath))['project.json']!)))).scenes),
      Object.keys(parse(source).scenes),
      'The block scenes must match the half-finished source.',
    );

    // Block-script workshop: pre-registered slots whose placeholder assets are replaced later.
    const slotBasePath = workshopPath;
    const slotRoot = path.join(temporary, 'slots');
    const slotSource = composeSlots(source, slots, {
      modelUrl: sampleModelUrl,
      modelUrls: config.blockWorkshop.slotModelUrls ?? {},
    });
    await writeTekonaSourceModules(slotRoot, slotSource);
    const slotValidationPath = path.join(temporary, 'slot-validation.k4.yml');
    await writeFile(slotValidationPath, slotSource);
    run(['validate-dsl4', '--input', slotValidationPath]);
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
    const slotExportResult = run(['export-block-dsl', '--input', blockWorkshopPath, '--output-dir', slotExported, '--name', 'tekona', '--format', 'json']);
    const slotScenes = Object.keys(parse(await readExportedDsl4Source(slotExportResult, builder.root,
      JSON.parse(strFromU8(unzipSync(await readFile(blockWorkshopPath))['project.json']!)))).scenes);
    assert.deepEqual(
      slotScenes.slice(slotScenes.indexOf(lastPreparedScene), slotScenes.indexOf('quarrel') + 1),
      [lastPreparedScene, ...slotSeats(slots).map((nn) => `suitor-${nn}`), 'quarrel'],
      'The block workshop slots must stay between the prepared suitors and quarrel.',
    );

    const lock = {
      formatVersion: 1,
      runtime: preview ? {
        unpublished: true,
        version: packageJson.version,
        basedOn: appRuntimeIdentity(release),
        baseSize: base.length,
        baseSha256: createHash('sha256').update(base).digest('hex'),
      } : appRuntimeIdentity(release),
      builder: {
        package: packageJson.name,
        version: packageJson.version,
        commit: preview ? execFileSync('git', ['rev-parse', 'HEAD'], {cwd: builder.root, encoding: 'utf8'}).trim() : release.commit,
        ...(preview ? {unpublished: true, sourceFiles: await Promise.all([
          'package.json', 'schema/dsl-4-narrative-control.schema.json', 'schema/dsl-4-editor.schema.json',
          'src/dsl4/narrative-control.ts', 'src/dsl4/structured-block-source-codec.ts',
          'src/dsl4/definition-references.ts',
        ].map((name) => record(builder.root, name)))} : {}),
      },
      sources: [
        ...(await Promise.all([sourceName, projectAssetsName].map((name) => record(storyRoot, name)))),
        await record(projectRoot, composeModule),
        await record(projectRoot, composeTemplate),
        await record(storyRoot, workshopConfigName),
        await record(projectRoot, 'scripts/tekona-source-modules.ts'),
      ],
      outputs: {
        workshop: await record(temporary, tekonaWorkshopOutput),
        yaml: await record(temporary, tekonaYamlOutput),
        blocks: await record(temporary, tekonaBlocksOutput),
        blockWorkshop: await record(temporary, tekonaBlockWorkshopOutput),
      },
    };
    // オフラインで遊ぶ向けのWeb版。台本・素材・実行基盤をすべてHTMLへ埋め込む。
    // ワークショップ用のSB3は参加者が編集するためのものなので、Web版は作らない。
    const webConfig: WebConfig = {
      enabled: true,
      inputProfile: 'dsl4-offline',
      outputDirectory: 'web-4.0',
      outputFilename: 'index.html',
      maxOutputBytes: 64 * 1024 * 1024,
      scriptMode: 'embedded',
      assets: 'embedded',
      audioUnlock: {enabled: true},
      packager: {
        package: '@turbowarp/packager',
        version: '3.13.0',
        options: {
          target: 'html',
          autoplay: true,
          app: {windowTitle: '手児奈 ― 真間の井の求婚者たち | TurboWarp紙芝居'},
          cloudVariables: {mode: 'disabled'},
        },
      },
      allowedOnlineDependencies: [],
      runtimeCapabilities: [],
    };
    const web = await buildPackagedWeb({
      inputSb3Path: path.join(temporary, tekonaYamlOutput),
      outputSampleDirectory: temporary,
      rawWebConfig: webConfig,
    });
    assert.equal(web.enabled, true, 'The tekona Web artifact must be built.');
    (lock as Record<string, unknown>).web = web;
    const outputNames = [
      tekonaWorkshopOutput,
      tekonaYamlOutput,
      tekonaBlocksOutput,
      tekonaBlockWorkshopOutput,
    ];
    const lockPath = path.join(destination, 'dsl4-artifacts.lock.json');
    const page = await renderComposePage();
    if (writeLock) {
      await writeFile(preview ? path.join(destination, 'compose.html') : path.join(projectRoot, composePage), page);
      for (const name of outputNames)
        await copyFile(path.join(temporary, name), path.join(destination, name));
      await mkdir(path.join(destination, 'web-4.0'), {recursive: true});
      await copyFile(path.join(temporary, 'web-4.0/index.html'), path.join(destination, 'web-4.0/index.html'));
      await writeFile(lockPath, JSON.stringify(lock, null, 2) + '\n');
    } else {
      await requireFresh(async () =>
        assert.deepEqual(
          lock,
          JSON.parse(await readFile(lockPath, 'utf8')),
          'Tekona workshop artifacts are stale; run update:tekona.',
        ),
      );
      await requireFresh(async () =>
        assert.equal(await readFile(path.join(projectRoot, composePage), 'utf8'), page,
          'The assistant compose page is stale; run update:tekona.'));
      // The lock comparison above covers what this build produced. The files beside the story are
      // a separate thing: they are what sb3:publish uploads and what the site and the checks read,
      // and only --write-lock ever wrote them. They went two App generations stale without anything
      // noticing, so compare them too.
      for (const name of outputNames) {
        await requireFresh(async () =>
          assertSameBytes(
            await readFile(path.join(storyRoot, name)),
            await readFile(path.join(temporary, name)),
            `${name} is stale; run pnpm update:tekona.`,
          ),
        );
      }
    }
    if (outputDirectory && !preview) {
      await mkdir(outputDirectory, {recursive: true});
      const copy = async (from: string, name: string) => {
        await mkdir(path.dirname(path.join(outputDirectory, name)), {recursive: true});
        await copyFile(path.join(from, name), path.join(outputDirectory, name));
      };
      for (const name of [
        'README.md',
        'LICENSES.md',
        sourceName,
        projectAssetsName,
        workshopConfigName,
        'dsl4-artifacts.lock.json',
        'assets/title-card.svg',
        'card-scenes.gif',
        'card-scenes/01.webp',
        'card-scenes/02.webp',
        'card-scenes/03.webp',
        'card-scenes/04.webp',
      ]) await copy(storyRoot, name);
      for (const name of [
        tekonaYamlOutput,
        tekonaBlocksOutput,
        tekonaWorkshopOutput,
        tekonaBlockWorkshopOutput,
        'web-4.0/index.html',
      ]) await copy(temporary, name);
    }
    return lock;
  } finally {
    await rm(temporary, {recursive: true, force: true});
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const value = (name: string) => process.argv[process.argv.indexOf(name) + 1];
  const preview = process.argv.includes('--preview-app') ? {
    appRoot: value('--preview-app'), basePath: value('--preview-base'), outputDirectory: value('--output-dir'),
  } : undefined;
  if (preview) for (const name of ['--preview-app', '--preview-base', '--output-dir'])
    assert(process.argv.includes(name) && value(name) && !value(name).startsWith('--'), `Missing ${name}.`);
  const lock = await buildTekona({writeLock: process.argv.includes('--write-lock'), preview});
  console.log(`Built tekona ${preview ? 'unpublished local preview' : 'workshop artifacts'} with ${lock.builder.version}.`);
}
