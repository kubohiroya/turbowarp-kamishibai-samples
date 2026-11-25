import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

import {createDeterministicSb3, importSb3} from '@kubohiroya/sb3-toolchain';
import {strFromU8, unzipSync} from 'fflate';
import {parse} from 'yaml';

import {readBlockProjectExtensions} from './block-project-extensions.ts';
import type {Dsl4ArtifactLock, Dsl4Story} from './dsl4.ts';
import type {ScratchProject} from './scratch.ts';
import {ensureUrashimaDsl4Inputs} from './update-urashima-dsl4-inputs.ts';
import {verifyEndCreditCheerDelay} from './verify-end-credit.ts';
import {assertSameBytes} from './same-bytes.ts';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const storyDirectory = path.join(projectRoot, 'stories/urashima');

function sha256(contents: Uint8Array | string): string {
  return createHash('sha256').update(contents).digest('hex');
}

export async function verifyUrashimaDsl4(): Promise<Dsl4ArtifactLock> {
  const inputs = await ensureUrashimaDsl4Inputs();
  const [artifactLock, sourceBytes] = await Promise.all([
    readFile(path.join(storyDirectory, 'dsl4-artifacts.lock.json'), 'utf8').then(
      (contents) => JSON.parse(contents) as Dsl4ArtifactLock,
    ),
    readFile(path.join(storyDirectory, 'urashima.k4.yml')),
  ]);
  assert.equal(artifactLock.formatVersion, 1);
  assert.equal(artifactLock.sb3Toolchain.version, '0.28.0');
  assert.equal(sourceBytes.length, artifactLock.source.size);
  assert.equal(sha256(sourceBytes), artifactLock.source.sha256);

  const story = parse(sourceBytes.toString('utf8'), {uniqueKeys: true}) as Dsl4Story;
  const assetEntries = Object.entries(story.assets ?? {});
  assert.equal(assetEntries.length, 49);
  /**
   * The three Teachable Machine pose models are the only assets named by address, and the address
   * is this repository's own GitHub Pages site. Embedding them wrote 17.7 MB of weights into
   * project.json as base64 and made the work's SB3 28 MB, of which the script and blocks were
   * under 30 KB. Naming them leaves the bytes in stories/urashima/pose-models, which build-site.ts
   * publishes with the rest of the story directory, so the URL below serves exactly the files
   * dsl4-inputs.lock.json pins.
   *
   * The address has to stay on that site. The models' upstream hosts are a Teachable Machine
   * share link and a dated path on a university server, and a work whose playback depends on
   * either stops working when they change; this check refused `delivery: remote` outright until
   * the bytes were served from here. A bare remote source carries no integrity the runtime can
   * verify, so the loop below pins them the one way that is checkable offline: the published
   * directory is this repository's, and its bytes match the lock.
   */
  const poseModelBaseUrl =
    'https://kubohiroya.github.io/turbowarp-kamishibai-samples/stories/urashima/pose-models/';
  const remoteAssets = assetEntries.filter(
    ([, asset]) => asset.delivery === 'remote' || asset.source !== undefined,
  );
  assert.deepEqual(
    remoteAssets.map(([id]) => id),
    ['PoseModel1', 'PoseModel2', 'PoseModel3'],
  );
  for (const [id, asset] of remoteAssets) {
    assert.equal(asset.delivery, 'remote', id);
    assert.equal(asset.file, undefined, id);
    assert.equal(asset.kind, 'recognitionModel', id);
    const url = asset.source?.url;
    assert(
      typeof url === 'string' && url.startsWith(poseModelBaseUrl),
      `${id} must be delivered from ${poseModelBaseUrl}`,
    );
    const directory = url.slice(poseModelBaseUrl.length);
    assert.match(directory, /^[\w-]+\/$/u, id);
    const model = inputs.lock.poseModels.find((candidate) => candidate.name === id);
    assert(model, `${id} must be recorded in dsl4-inputs.lock.json`);
    assert.equal(`${model.output}/`, `pose-models/${directory}`, id);
    for (const file of model.files) {
      const contents: Buffer = await readFile(path.join(storyDirectory, model.output, file.path));
      assert.equal(contents.length, file.size, `${id}/${file.path}`);
      assert.equal(sha256(contents), file.sha256, `${id}/${file.path}`);
    }
  }
  const remoteIds = new Set(remoteAssets.map(([id]) => id));
  const embeddedAssets = assetEntries.filter(([id]) => !remoteIds.has(id));
  assert.equal(embeddedAssets.length, 46);
  assert(
    embeddedAssets.every(
      ([, asset]) =>
        typeof asset.file === 'string' &&
        asset.file.length > 0 &&
        asset.delivery === undefined &&
        asset.source === undefined,
    ),
  );

  const outputPath = path.join(storyDirectory, artifactLock.output.path);
  const outputBytes = await readFile(outputPath);
  assert.equal(outputBytes.length, artifactLock.output.size);
  assert.equal(sha256(outputBytes), artifactLock.output.sha256);
  const archive = unzipSync(new Uint8Array(outputBytes));
  assert.equal(Object.keys(archive).length, artifactLock.output.archiveEntryCount);
  const project = JSON.parse(strFromU8(archive['project.json'] as Uint8Array)) as ScratchProject;
  assert.deepEqual(project.extensions, ['kubohiroyakamishibai4']);
  const runtimeUrl = project.extensionURLs?.kubohiroyakamishibai4;
  assert(runtimeUrl, 'The embedded DSL 4.0 runtime extension URL is missing.');
  assert(runtimeUrl.startsWith('data:text/javascript;base64,'));
  assert.equal(project.turboWarpPlus, undefined, 'The Packager input must use the standard carrier.');
  const expectedTargets = [
    'Stage',
    'Urashima',
    'Turtle',
    'Princess',
    'Fish',
    'Narration',
  ];
  assert.deepEqual(
    project.targets.map((target) => target.name),
    expectedTargets,
  );

  const blocks = artifactLock.blocksOutput;
  assert(blocks);
  const blockBytes = await readFile(path.join(storyDirectory, blocks.path));
  assert.equal(blockBytes.length, blocks.size);
  assert.equal(sha256(blockBytes), blocks.sha256);
  const blockArchive = unzipSync(blockBytes);
  assert.equal(Object.keys(blockArchive).length, blocks.archiveEntryCount);
  const blockProject = JSON.parse(strFromU8(blockArchive['project.json']!)) as ScratchProject;
  const blockExtensions = readBlockProjectExtensions(blockProject, blockArchive);
  assert.deepEqual([...blockExtensions.keys()].sort(), [
    'kubohiroyakamishibai4',
    'kubohiroyakamishibaiauthoring4',
  ]);
  for (const [id, extension] of blockExtensions) {
    assert.equal(extension.format, 'embedded-file', id);
    assert.equal(extension.spec?.execution, 'unsandboxed', id);
    assert.equal(blockProject.extensionURLs?.[id], undefined, id);
  }
  const stage = project.targets.find((target) => target.isStage);
  assert.equal(stage?.blocks?.titleFlag?.opcode, 'event_whenflagclicked');
  assert.equal(stage?.blocks?.titleFlag?.next, 'titleFlagShow');
  assert.equal(
    stage?.blocks?.titleFlagShow?.opcode,
    'kubohiroyakamishibai4_kubohiroyakamishibairuntime4__showTitle',
  );
  const extensionSource = Buffer.from(
    runtimeUrl.slice('data:text/javascript;base64,'.length),
    'base64',
  ).toString('utf8');
  const reloadIconMatch = extensionSource.match(
    /reload:"data:image\/svg\+xml;base64,([^"]+)"/u,
  );
  assert(reloadIconMatch, 'Embedded DSL 4.0 runtime reload icon is missing.');
  const reloadIcon = Buffer.from(reloadIconMatch[1] as string, 'base64').toString('utf8');
  assert.equal(
    (reloadIcon.match(/<path\b/gu) ?? []).length,
    1,
    'Reload icon must use one continuous outline path.',
  );
  assert(
    reloadIcon.includes(
      'd="M43.5 19.4 38.2 7.1 36.2 9.4A19 19 0 1 0 42.4 28.6L36.6 27.1A13 13 0 1 1 32.4 14L30.4 16.3Z"',
    ),
    'Reload icon must use the balanced rc.6 arrowhead outline.',
  );
  assert(extensionSource.includes('dsl4SpeechAdvanceTypewriter:!0'));
  assert(extensionSource.includes('data-dsl4-runtime-error'));
  // From App 4.0.4 the runtime no longer bundles TF.js and Teachable Machine Pose: it loads the
  // Teachable Machine runtime from the App site when pose recognition starts. The components it
  // uses are named in its composed notices instead of carrying their full notice text.
  const composedNotices = extensionSource.match(
    /\/\*!\n \* Kamishibai DSL 4\.0 Runtime — composed source notices\n([\s\S]*?)\n \*\//u,
  );
  assert(composedNotices, 'The DSL 4.0 runtime composed source notices are missing.');
  const tmVersion = (composedNotices[1] as string).match(
    /Teachable Machine — Hiroya Kubo — MPL-2\.0 — @kubohiroya\/turbowarp-teachable-machine@(\d+\.\d+\.\d+)\n/u,
  )?.[1];
  assert(tmVersion, 'The composed notices must name the Teachable Machine version.');
  for (const component of [
    /Teachable Machine Pose — Google LLC — Apache-2\.0 — @teachablemachine\/pose@/u,
    /TensorFlow\.js — Google LLC — Apache-2\.0 — @tensorflow\/tfjs@/u,
    /PoseNet MobileNetV1 model — TensorFlow Authors — Apache-2\.0 — @tensorflow-models\/posenet@/u,
  ]) {
    assert.match(composedNotices[1] as string, component);
  }
  assert(
    extensionSource.includes(
      `site:{version:"${tmVersion}",runtimeUrl:"https://kubohiroya.github.io/turbowarp-kamishibai-app/teachable-machine/${tmVersion}/runtime.js",integrity:"sha384-`,
    ),
    'The runtime must load the noticed Teachable Machine version from the App site with SRI.',
  );
  assert(extensionSource.includes('Webcam'));
  assert(extensionSource.includes('loadFromFiles'));
  for (const actor of ['Urashima', 'Turtle', 'Princess', 'Fish', 'Narration']) {
    const target = project.targets.find((candidate) => candidate.name === actor);
    assert(target && !target.isStage && target.costumes.length === 1);
  }

  const component =
    project.extensionStorage?.kubohiroyakamishibai4?.components
      ?.kubohiroyakamishibairuntime4;
  assert(component, 'Embedded DSL 4.0 runtime component is missing.');
  assert.equal(component.source.displayName, 'urashima.k4.yml');
  assert.equal(component.source.sourceId, 'main');
  assert.equal(component.artifact.controlProfile, 'production');
  assert.equal(component.assets.manifest.assets.length, 49);
  // 46 embedded media payloads. The nine pose model files are no longer among them: the models
  // are delivered from this repository's Pages site (see poseModelBaseUrl above).
  assert.equal(component.assets.files.length, 46);
  const composed = parse(component.source.text, {uniqueKeys: true}) as Dsl4Story;
  verifyEndCreditCheerDelay(composed);
  const {include} = parse(sourceBytes.toString('utf8')) as {include: string[]};
  const documents = component.sourceDocuments as {entryPath: string; files: Record<string, {source: string}>};
  assert.equal(documents.entryPath, artifactLock.source.path);
  assert.deepEqual(Object.keys(documents.files).sort(), [documents.entryPath, ...include].sort());
  assert.equal(documents.files[documents.entryPath]?.source, sourceBytes.toString('utf8'));
  const sceneNames = [];
  for (const filename of include) {
    const source = await readFile(path.join(storyDirectory, filename), 'utf8');
    assert.equal(documents.files[filename]?.source, source);
    sceneNames.push(...Object.keys((parse(source) as Dsl4Story).scenes ?? {}));
  }
  assert.deepEqual(Object.keys(composed.scenes ?? {}), sceneNames);
  // The composed script keeps the addresses the entry document declared, so the hosts the entry
  // must not name are checked here too.
  assert(!component.source.text.includes('https://sqs.prof.cuc.ac.jp/'));
  assert(!component.source.text.includes('https://teachablemachine.withgoogle.com/'));
  assert.equal(
    component.source.text.split(poseModelBaseUrl).length - 1,
    3,
    'The composed script must deliver all three pose models from the samples Pages site.',
  );

  const expectedLabels = [
    ['help', 'ride1', 'ride2'],
    ['dance1', 'dance2', 'receive', 'goodbye'],
    ['open1', 'open2', 'open3', 'despair'],
  ];
  for (const [index, modelDirectory] of ['1and2', '3and4', '6and7'].entries()) {
    const metadata = JSON.parse(
      await readFile(
        path.join(storyDirectory, 'pose-models', modelDirectory, 'metadata.json'),
        'utf8',
      ),
    ) as {labels: string[]};
    assert.deepEqual(metadata.labels, expectedLabels[index]);
  }

  const temporaryDirectory = await mkdtemp(path.join(tmpdir(), 'verify-urashima-dsl4-'));
  try {
    const sourceDirectory = path.join(temporaryDirectory, 'source');
    await importSb3({inputPath: outputPath, outputDirectory: sourceDirectory});
    const rebuilt = await createDeterministicSb3(sourceDirectory);
    assertSameBytes(
      Buffer.from(rebuilt.archive),
      outputBytes,
      'urashima-4.0.sb3 must be the canonical sb3-toolchain output.',
    );
  } finally {
    await rm(temporaryDirectory, {recursive: true, force: true});
  }
  return artifactLock;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const lock = await verifyUrashimaDsl4();
  process.stdout.write(
    `Verified ${lock.output.path} (${lock.source.assetCount} local assets, SHA-256 ${lock.output.sha256}).\n`,
  );
}
