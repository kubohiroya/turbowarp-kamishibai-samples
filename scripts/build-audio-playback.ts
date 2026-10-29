import {simplifyPublishedDsl4Blocks} from './simplify-published-dsl4-blocks.ts';
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

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const storyRoot = path.join(projectRoot, 'stories/audio-playback');
const sourceFiles = ['main.k4.yml', 'tone.wav', 'instructions.svg'];
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

/** Build every audio surface from the same published base, CLI and source payload. */
export async function buildAudioPlayback({
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
  const temporary = await mkdtemp(path.join(tmpdir(), 'kamishibai-audio-sample-'));
  const run = (args: string[]) =>
    execFileSync(process.execPath, [builder.cli, ...args], {
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
    });
  try {
    const yamlName = 'audio-4.0.sb3';
    const blocksName = 'audio-blocks-4.0.sb3';
    run(['validate-dsl4', '--input', path.join(storyRoot, 'main.k4.yml')]);
    run([
      'build-dsl4',
      '--base',
      appBasePath(),
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
    const webConfig: WebConfig = {
      enabled: true,
      inputProfile: 'dsl4-offline',
      outputDirectory: 'web-4.0',
      outputFilename: 'index.html',
      maxOutputBytes: 64 * 1024 * 1024,
      scriptMode: 'embedded',
      assets: 'embedded-project',
      audioUnlock: {enabled: true},
      packager: {
        package: '@turbowarp/packager',
        version: '3.13.0',
        options: {
          target: 'html',
          autoplay: true,
          app: {windowTitle: '音声再生サンプル | TurboWarp紙芝居'},
          cloudVariables: {mode: 'disabled'},
        },
      },
      allowedOnlineDependencies: [],
      runtimeCapabilities: [{capability: 'audio', purpose: '合成音の再生'}],
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
        'Audio sample artifacts are stale; run update:audio-playback.',
      );
    }
    if (outputDirectory) {
      await mkdir(outputDirectory, {recursive: true});
      for (const name of [...staticFiles, 'dsl4-artifacts.lock.json']) {
        await mkdir(path.dirname(path.join(outputDirectory, name)), {recursive: true});
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
  const lock = await buildAudioPlayback({
    writeLock: process.argv.includes('--write-lock'),
  });
  console.log(`Verified audio playback sample ${lock.builder.version}.`);
}
