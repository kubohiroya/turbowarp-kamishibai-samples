import {simplifyPublishedDsl4Blocks} from './simplify-published-dsl4-blocks.ts';
import {strFromU8, strToU8, unzipSync, zipSync} from 'fflate';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {copyFile, mkdir, mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

import {appBasePath, appRuntimeIdentity, readAppRelease} from './app-dependency.ts';
import {resolveBlockAuthoringBuilder} from './block-authoring-builder.ts';
import {buildPackagedWeb} from './build-packaged-web.ts';
import type {WebConfig} from './story-config.ts';
import {buildEditableBlockSource} from './build-dsl4-block-source.ts';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const storyRoot = path.join(projectRoot, 'stories/three-visits');
const sourceFiles = ['main.k4.yml', 'narrator.svg', 'instructions.svg'];
const staticFiles = [
  ...sourceFiles,
  'README.md',
  'LICENSES.md',
  'card-scenes.gif',
  'card-scenes/01.webp',
  'card-scenes/02.webp',
  'card-scenes/03.webp',
  'card-scenes/04.webp',
];

async function record(root: string, filename: string) {
  const bytes = await readFile(path.join(root, filename));
  return {
    path: filename,
    size: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  };
}

/** Add the story's actor to the verified base; retain all official runtime and menu bytes. */
export async function createThreeVisitsActorBase(base: Uint8Array) {
  const archive = unzipSync(base);
  const project = JSON.parse(strFromU8(archive['project.json']!));
  assert(!project.targets.some((target: {name: string}) => target.name === 'Narrator'));
  const costume = await readFile(path.join(storyRoot, 'narrator.svg'));
  const assetId = createHash('md5').update(costume).digest('hex');
  const md5ext = `${assetId}.svg`;
  archive[md5ext] = costume;
  project.targets.push({
    isStage: false,
    name: 'Narrator',
    variables: {},
    lists: {},
    broadcasts: {},
    blocks: {},
    comments: {},
    currentCostume: 0,
    costumes: [
      {
        name: 'NarratorIdle',
        assetId,
        md5ext,
        dataFormat: 'svg',
        rotationCenterX: 50,
        rotationCenterY: 75,
      },
    ],
    sounds: [],
    volume: 100,
    layerOrder: 1,
    visible: true,
    x: 0,
    y: -40,
    size: 70,
    direction: 90,
    draggable: false,
    rotationStyle: 'all around',
  });
  archive['project.json'] = strToU8(JSON.stringify(project));
  // ZIP encodes local calendar fields, so construct the same local midnight in every timezone.
  return zipSync(archive, {mtime: new Date(1980, 0, 1)});
}

/** Build every narrative surface from the same published base, CLI and source payload. */
export async function buildThreeVisits({
  writeLock = false,
  outputDirectory,
}: {
  writeLock?: boolean;
  outputDirectory?: string;
} = {}) {
  const release = await readAppRelease();
  const builder = await resolveBlockAuthoringBuilder();
  const packageJson = JSON.parse(await readFile(path.join(builder.root, 'package.json'), 'utf8'));
  assert.equal(packageJson.version, release.version);
  const base = await readFile(appBasePath());
  assert.equal(base.length, release.artifact.size);
  assert.equal(createHash('sha256').update(base).digest('hex'), release.artifact.sha256);
  const temporary = await mkdtemp(path.join(tmpdir(), 'kamishibai-three-visits-'));
  const run = (args: string[]) =>
    execFileSync(process.execPath, [builder.cli, ...args], {
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
    });
  try {
    const actorBasePath = path.join(temporary, 'actor-base.sb3');
    await writeFile(actorBasePath, await createThreeVisitsActorBase(base));
    const yamlName = 'three-visits-4.0.sb3';
    const blocksName = 'three-visits-blocks-4.0.sb3';
    run(['validate-dsl4', '--input', path.join(storyRoot, 'main.k4.yml')]);
    run([
      'build-dsl4',
      '--embedded-source-documents',
      '--base',
      actorBasePath,
      '--project-root',
      storyRoot,
      '--source',
      'main.k4.yml',
      '--output',
      path.join(temporary, yamlName),
      '--control-profile',
      'production',
      '--channel',
      'bundled',
      '--replace-existing',
    ]);
    run([
      'author-block-dsl',
      '--base',
      path.join(temporary, yamlName),
      '--input',
      path.join(storyRoot, 'main.k4.yml'),
      '--output',
      path.join(temporary, blocksName),
      ...builder.authorOptions,
    ]);
    await simplifyPublishedDsl4Blocks(path.join(temporary, blocksName), builder.root, builder.identity.sourceSections ?? false, storyRoot);
    const editable = await buildEditableBlockSource(
      path.join(temporary, blocksName),
      path.join(temporary, 'block-source'),
      await readFile(path.join(temporary, yamlName)),
      builder.refreshRuntime,
      builder.root,
      'main.k4.yml',
    );
    await writeFile(path.join(temporary, blocksName), editable);
    const webConfig: WebConfig = {
      enabled: true,
      inputProfile: 'dsl4-offline',
      outputDirectory: 'web-4.0',
      outputFilename: 'index.html',
      maxOutputBytes: 64 * 1024 * 1024,
      scriptMode: 'embedded',
      assets: 'embedded-project',
      audioUnlock: {enabled: false},
      packager: {
        package: '@turbowarp/packager',
        version: '3.13.0',
        options: {
          target: 'html',
          autoplay: true,
          app: {windowTitle: '三人の訪問 | TurboWarp紙芝居'},
          cloudVariables: {mode: 'disabled'},
        },
      },
      allowedOnlineDependencies: [],
      runtimeCapabilities: [],
    };
    const web = await buildPackagedWeb({
      inputSb3Path: path.join(temporary, yamlName),
      outputSampleDirectory: temporary,
      rawWebConfig: webConfig,
    });
    const blocksWeb = await buildPackagedWeb({
      inputSb3Path: path.join(temporary, blocksName),
      outputSampleDirectory: temporary,
      rawWebConfig: {...webConfig, outputDirectory: 'web-blocks-4.0'},
    });
    const lock = {
      formatVersion: 1,
      runtime: appRuntimeIdentity(release),
      builder: {
        package: packageJson.name,
        version: packageJson.version,
        commit: release.commit,
      },
      sources: await Promise.all(sourceFiles.map((name) => record(storyRoot, name))),
      outputs: {
        yaml: await record(temporary, yamlName),
        blocks: await record(temporary, blocksName),
      },
      web,
      blocksWeb,
    };
    const lockPath = path.join(storyRoot, 'dsl4-artifacts.lock.json');
    if (writeLock) {
      await copyFile(path.join(temporary, yamlName), path.join(storyRoot, yamlName));
      await copyFile(path.join(temporary, blocksName), path.join(storyRoot, blocksName));
      await writeFile(lockPath, JSON.stringify(lock, null, 2) + '\n');
    } else {
      assert.deepEqual(
        lock,
        JSON.parse(await readFile(lockPath, 'utf8')),
        'Three visits sample artifacts are stale; run update:three-visits.',
      );
    }
    if (outputDirectory) {
      await mkdir(outputDirectory, {recursive: true});
      for (const name of [...staticFiles, 'dsl4-artifacts.lock.json']) {
        await mkdir(path.dirname(path.join(outputDirectory, name)), {
          recursive: true,
        });
        await copyFile(path.join(storyRoot, name), path.join(outputDirectory, name));
      }
      for (const name of [
        yamlName,
        blocksName,
        'web-4.0/index.html',
        'web-blocks-4.0/index.html',
      ]) {
        await mkdir(path.dirname(path.join(outputDirectory, name)), {
          recursive: true,
        });
        await copyFile(path.join(temporary, name), path.join(outputDirectory, name));
      }
    }
    return lock;
  } finally {
    await rm(temporary, {recursive: true, force: true});
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const lock = await buildThreeVisits({
    writeLock: process.argv.includes('--write-lock'),
  });
  console.log(`Verified three visits sample ${lock.builder.version}.`);
}
