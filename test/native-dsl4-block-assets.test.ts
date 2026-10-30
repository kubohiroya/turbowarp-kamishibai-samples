import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {webcrypto} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {test} from 'vitest';
import {parse} from 'yaml';
import {strFromU8, unzipSync} from 'fflate';
import {canonicalDsl4ProjectStory} from '../scripts/simplify-published-dsl4-blocks.ts';

const root = path.resolve(import.meta.dirname, '..');
const appRoot =
  process.env.TURBOWARP_KAMISHIBAI_APP_ROOT ??
  path.resolve(root, '../turbowarp-kamishibai-app');

test('published Urashima blocks use exact source image/audio bytes as native slots without media asset declarations', async () => {
  const archive = unzipSync(
    await readFile(path.join(root, 'stories/urashima/urashima-blocks-4.0.sb3')),
  );
  const project = JSON.parse(strFromU8(archive['project.json']!));
  const {extractEmbeddedYamlDocumentSources} = await import(
    pathToFileURL(path.join(appRoot, 'dist/dsl4/embedded-yaml-migration.js'))
      .href
  );
  const {readProjectMaterial} = await import(
    pathToFileURL(
      path.join(appRoot, 'dist/builder/dsl4-asset-project-material.js'),
    ).href
  );
  const {validateKamishibaiEmbeddedYamlRoot} = await import(
    pathToFileURL(
      path.join(appRoot, 'dist/dsl4/embedded-yaml-root-validation.js'),
    ).href
  );
  const {createDsl4ProductionSourceFrontend} = await import(
    pathToFileURL(path.join(appRoot, 'dist/builder/dsl4-source-frontend.js'))
      .href
  );
  const schema = JSON.parse(
    await readFile(path.join(appRoot, 'schema/dsl-4.schema.json'), 'utf8'),
  );
  const frontend = createDsl4ProductionSourceFrontend(schema, {
    narrativeControlEnabled: true,
  });
  const selection = validateKamishibaiEmbeddedYamlRoot(project, {
    allowLegacySingle: false,
  });
  const graph = await extractEmbeddedYamlDocumentSources(project, frontend);
  assert.equal(
    selection.path,
    graph.entryPath,
    'The independent root must select the exported named file.',
  );
  assert.equal(
    Object.keys(graph.sources).length,
    1,
    'The full Urashima story must remain one named document.',
  );
  const exported = graph.sources[graph.entryPath];
  assert.equal(typeof exported, 'string');
  const sourcePath = path.join(root, 'stories/urashima/urashima.k4.yml');
  const source = await readFile(sourcePath, 'utf8');
  const original = parse(source);
  const simplified = parse(exported);
  for (const asset of Object.values(simplified.assets ?? {}) as {
    kind: string;
  }[])
    assert(
      !['backdrop', 'costume', 'sound'].includes(asset.kind),
      'Native media must not retain asset declarations.',
    );
  const bundle =
    project.extensionStorage.kubohiroyakamishibai4.components
      .kubohiroyakamishibairuntime4.assets;
  assert(
    bundle.files.every((file: {assetId: string}) =>
      file.assetId.startsWith('PoseModel'),
    ),
    'Migrated image/audio payloads must not remain in the file bundle.',
  );
  const {prepareDsl4EmbeddedBlockStoryProject} = await import(
    pathToFileURL(
      path.join(appRoot, 'dist/dsl4/platform/embedded-block-story.js'),
    ).href
  );
  await prepareDsl4EmbeddedBlockStoryProject(project, frontend, {
    maxSourceBytes: 262144,
    maxAssetFiles: 4096,
    maxTotalAssetBytes: 256 * 1024 * 1024,
    subtleCrypto: webcrypto.subtle,
  });
  let checked = 0;
  for (const [id, raw] of Object.entries(original.assets)) {
    const asset = raw as {kind: string; file?: string};
    if (!['backdrop', 'costume', 'sound'].includes(asset.kind) || !asset.file)
      continue;
    const expected = await readFile(
      path.resolve(path.dirname(sourcePath), asset.file),
    );
    const actual = readProjectMaterial(archive, project, id, asset).files[0]
      .bytes;
    assert.deepEqual(
      Buffer.from(actual),
      expected,
      `Native media changed: ${id}`,
    );
    checked++;
  }
  assert.equal(checked, 46);
  const urashima = project.targets.find(
    (target: {name: string}) => target.name === 'Urashima',
  );
  const costume = urashima.costumes.find(
    (entry: {name: string}) => entry.name === 'Urashima-walk-1',
  );
  assert.equal(costume.md5ext, '9a8cf053f6169ea9b530a852ab62c5a0.png');
  assert.equal(costume.bitmapResolution, 1);
  assert.equal(
    await canonicalDsl4ProjectStory(
      exported,
      project,
      archive,
      appRoot,
      path.dirname(sourcePath),
    ),
    await canonicalDsl4ProjectStory(
      source,
      project,
      archive,
      appRoot,
      path.dirname(sourcePath),
    ),
  );
});
