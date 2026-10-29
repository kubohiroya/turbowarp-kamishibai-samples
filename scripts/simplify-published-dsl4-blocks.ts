import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash, webcrypto} from 'node:crypto';
import {readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {parse, stringify} from 'yaml';
import {strFromU8, strToU8, unzipSync, zipSync} from 'fflate';
import type {ScratchExtensionComponent} from './scratch.ts';
import {assertBlockSourceRuntimeWrapper} from './build-dsl4-block-source.ts';
import {
  dsl4ExecutableValue,
  record,
  simplifyDsl4Source,
} from './simplify-dsl4-source.ts';

/** Move image/audio payloads into native slots before omitting equivalent declarations. */
export async function simplifyPublishedDsl4Blocks(
  inputPath: string,
  appRoot: string,
  sourceSections: boolean,
  assetRoot: string,
): Promise<void> {
  // A native Node process keeps App function.toString() code generation free of test transforms.
  const {stdout} = await promisify(execFile)(process.execPath, [
    fileURLToPath(import.meta.url),
    '--simplify',
    inputPath,
    appRoot,
    String(sourceSections),
    assetRoot,
  ]);
  process.stdout.write(stdout);
}

async function simplifyNativeAssets(
  inputPath: string,
  appRoot: string,
  sourceSections: boolean,
  assetRoot: string,
): Promise<void> {
  const archive = unzipSync(await readFile(inputPath));
  const project = JSON.parse(strFromU8(archive['project.json']!));
  const bundleUrl = project.extensionURLs?.kubohiroyakamishibai4 ?? '';
  if (!bundleUrl.startsWith('data:text/javascript;base64,')) return;
  const bundle = Buffer.from(bundleUrl.split(',')[1]!, 'base64').toString(
    'utf8',
  );
  if (!bundle.includes('// Kamishibai capabilities: simple-speech-v1')) return;
  const load = (file: string) =>
    import(pathToFileURL(path.join(appRoot, file)).href);
  const [
    {createDsl4ProductionSourceFrontend},
    {collectDsl4DefinitionReferences},
    {extractDsl4BlockSourcesFromProject},
    {removeDsl4BlockSourceDeclarations},
    {authorDsl4BlockSourceSb3},
    {addProjectAsset, projectTarget, readProjectMaterial},
  ] = await Promise.all([
    load('dist/builder/dsl4-source-frontend.js'),
    load('dist/dsl4/definition-references.js'),
    load('dist/dsl4/turbowarp-yaml-json-block-source.js'),
    load('dist/dsl4/compiled-project.js'),
    load('dist/builder/dsl4-block-source-author.js'),
    load('dist/builder/dsl4-asset-project-material.js'),
  ]);
  const schema = JSON.parse(
    await readFile(path.join(appRoot, 'schema/dsl-4.schema.json'), 'utf8'),
  );
  const frontend = createDsl4ProductionSourceFrontend(schema, {
    narrativeControlEnabled: true,
  });
  const graph = extractDsl4BlockSourcesFromProject(project);
  assert.equal(
    Object.keys(graph.sources).length,
    1,
    'Preserve multi-module source graphs.',
  );
  const text = graph.sources[graph.entryPath];
  assert(
    !text.includes('# kamishibai-block-sections-v1:'),
    'Preserve disabled source sections.',
  );
  const normalize = (source: Record<string, unknown>) => {
    const result = frontend.parse(stringify(source), {project});
    assert(result.ok, JSON.stringify(result.diagnostics));
    return result.storyDocument;
  };
  const original = parse(text);
  const mediaKinds = new Set(['costume', 'backdrop', 'sound']);
  const files = new Map<string, Buffer>();
  for (const [id, raw] of Object.entries(record(original.assets))) {
    const asset = record(raw);
    if (!mediaKinds.has(String(asset.kind)) || typeof asset.file !== 'string')
      continue;
    const filePath = path.resolve(assetRoot, asset.file);
    assert(
      filePath.startsWith(path.resolve(assetRoot) + path.sep),
      'Asset path must stay in the story root.',
    );
    files.set(id, await readFile(filePath));
  }
  function executable(source: Record<string, unknown>) {
    const normalized = structuredClone(normalize(source));
    normalized.assets = Object.fromEntries(
      Object.entries(record(normalized.assets)).map(([id, raw]) => {
        const asset = record(raw);
        if (!mediaKinds.has(String(asset.kind)) || asset.delivery === 'remote')
          return [id, raw];
        const bytes =
          typeof asset.file === 'string'
            ? files.get(id)
            : readProjectMaterial(archive, project, id, asset).files[0].bytes;
        assert(bytes, `Missing media bytes for ${id}.`);
        const {id: _id, file: _file, name: _name, ...properties} = asset;
        return [
          id,
          {
            ...properties,
            contentSha256: createHash('sha256').update(bytes).digest('hex'),
          },
        ];
      }),
    );
    return dsl4ExecutableValue(normalized);
  }
  const expected = executable(original);
  const source = structuredClone(original);
  const oldCover = normalize(original).cover;
  let materialized = 0;
  for (const [id, bytes] of files) {
    const asset = record(record(source.assets)[id]);
    const target = projectTarget(project, asset, id);
    const key = asset.kind === 'sound' ? 'sounds' : 'costumes';
    const collection = target[key] ?? [];
    const matches = collection
      .map((entry: {name: string}, index: number) => ({entry, index}))
      .filter(({entry}: {entry: {name: string}}) => entry.name === id);
    assert(matches.length <= 1, `Ambiguous native slot: ${target.name}/${id}.`);
    const index = matches[0]?.index;
    if (index !== undefined) collection.splice(index, 1);
    target[key] = collection;
    addProjectAsset(archive, project, id, asset, {
      files: [{path: asset.file, bytes}],
    });
    if (index !== undefined) collection.splice(index, 0, collection.pop());
    const {file: _file, ...properties} = asset;
    record(source.assets)[id] = {...properties, name: id};
    assert.deepEqual(
      Buffer.from(
        readProjectMaterial(archive, project, id, record(source.assets)[id])
          .files[0].bytes,
      ),
      bytes,
    );
    materialized++;
  }
  // Adding Stage sounds must not silently change a previously silent default cover.
  if (materialized && source.cover === undefined && oldCover) {
    const assets = record(normalize(original).assets);
    const backdrop = record(assets[oldCover.backdrop]).name;
    const bgm =
      oldCover.bgm === undefined
        ? undefined
        : record(assets[oldCover.bgm]).name;
    const scenes = source.scenes;
    delete source.scenes;
    source.cover = {backdrop, ...(bgm === undefined ? {} : {bgm})};
    source.scenes = scenes;
  }
  assert.equal(
    executable(source),
    expected,
    'Native materialization changed executable values.',
  );
  const simplified = simplifyDsl4Source(source, {
    normalize,
    references: (value) => collectDsl4DefinitionReferences(value, schema),
  });
  if (materialized === 0 && simplified.removed.length === 0) return;
  assert.equal(executable(simplified.source), expected);
  removeDsl4BlockSourceDeclarations(project);
  archive['project.json'] = strToU8(JSON.stringify(project));
  // Reuse the pinned embedded bytes; rebuilding here depends on the caller's build mode.
  assertBlockSourceRuntimeWrapper(bundle);
  const header = bundle.match(/^(?:\s*\/\/[^\r\n]*\r?\n)*/u)?.[0] ?? '';
  const bodyStart = '    (function(Scratch){\n';
  const bodyEnd = '\n})(scoped);\n  })(Scratch);';
  const start = bundle.indexOf(bodyStart, header.length);
  assert(
    start >= header.length && bundle.endsWith(bodyEnd),
    'Pinned runtime wrapper changed.',
  );
  const runtime =
    header + bundle.slice(start + bodyStart.length, -bodyEnd.length);
  const authored = authorDsl4BlockSourceSb3({
    baseBytes: zipSync(archive),
    sourceText: stringify(simplified.source),
    sourceFrontend: frontend,
    sourceSections,
    narrativeRuntimeSource: runtime,
  });
  assert(authored.ok, JSON.stringify(authored.diagnostics));
  const outputProject = JSON.parse(
    strFromU8(unzipSync(authored.bytes)['project.json']!),
  );
  const exported = extractDsl4BlockSourcesFromProject(outputProject);
  assert.equal(
    executable(parse(exported.sources[exported.entryPath])),
    expected,
    'Published simplification must preserve every executable value and media byte.',
  );
  const outputArchive = unzipSync(authored.bytes);
  const component =
    outputProject.extensionStorage?.kubohiroyakamishibai4?.components
      ?.kubohiroyakamishibairuntime4;
  if (component?.assets) {
    component.assets = await alignDsl4BlockAssetBundle(
      outputProject,
      component.assets,
      appRoot,
      true,
    );
    outputArchive['project.json'] = strToU8(JSON.stringify(outputProject));
  }
  await writeFile(
    inputPath,
    zipSync(outputArchive, {level: 6, mtime: new Date(2000, 0, 1)}),
  );
  console.log(
    `Native block assets: ${materialized} materialized, ${simplified.removed.length} declarations omitted.`,
  );
}

/** Compare storage changes by media bytes as well as normalized commands and settings. */
export async function canonicalDsl4ProjectStory(
  sourceText: string,
  project: Record<string, unknown>,
  archive: Record<string, Uint8Array>,
  appRoot: string,
  assetRoot: string,
): Promise<string> {
  const load = (file: string) =>
    import(pathToFileURL(path.join(appRoot, file)).href);
  const [{createDsl4ProductionSourceFrontend}, {readProjectMaterial}] =
    await Promise.all([
      load('dist/builder/dsl4-source-frontend.js'),
      load('dist/builder/dsl4-asset-project-material.js'),
    ]);
  const schema = JSON.parse(
    await readFile(path.join(appRoot, 'schema/dsl-4.schema.json'), 'utf8'),
  );
  const frontend = createDsl4ProductionSourceFrontend(schema, {
    narrativeControlEnabled: true,
  });
  const result = frontend.parse(sourceText, {project});
  assert(result.ok, JSON.stringify(result.diagnostics));
  const story = structuredClone(result.storyDocument);
  for (const [id, raw] of Object.entries(record(story.assets))) {
    const asset = record(raw);
    if (
      !['costume', 'backdrop', 'sound'].includes(String(asset.kind)) ||
      asset.delivery === 'remote'
    )
      continue;
    const bytes =
      typeof asset.file === 'string'
        ? await readFile(path.resolve(assetRoot, asset.file))
        : readProjectMaterial(archive, project, id, asset).files[0].bytes;
    const {id: _id, file: _file, name: _name, ...properties} = asset;
    story.assets[id] = {
      ...properties,
      contentSha256: createHash('sha256').update(bytes).digest('hex'),
    };
  }
  return dsl4ExecutableValue(story);
}

/** Authenticate retained payloads and rebuild the bundle for the current editable declarations. */
export async function alignDsl4BlockAssetBundle(
  project: Record<string, unknown>,
  previous: ScratchExtensionComponent['assets'],
  appRoot: string,
  allowMissingFilePayloads = false,
): Promise<ScratchExtensionComponent['assets']> {
  const load = (file: string) =>
    import(pathToFileURL(path.join(appRoot, file)).href);
  const [
    {createDsl4ProductionSourceFrontend},
    {extractDsl4BlockSourcesFromProject},
    {createDsl4EmbeddedAssetBundle, validateDsl4EmbeddedAssetBundle},
  ] = await Promise.all([
    load('dist/builder/dsl4-source-frontend.js'),
    load('dist/dsl4/turbowarp-yaml-json-block-source.js'),
    load('dist/dsl4/asset-bundle-descriptor.js'),
  ]);
  const frontend = createDsl4ProductionSourceFrontend(
    JSON.parse(
      await readFile(path.join(appRoot, 'schema/dsl-4.schema.json'), 'utf8'),
    ),
    {narrativeControlEnabled: true},
  );
  const graph = extractDsl4BlockSourcesFromProject(project);
  const parsed = frontend.parse(graph.sources[graph.entryPath], {project});
  assert(parsed.ok, JSON.stringify(parsed.diagnostics));
  const story = parsed.storyDocument;
  const retained = new Map<string, any>(
    (previous.manifest?.assets ?? []).map((asset: any) => [asset.id, asset]),
  );
  // Menu bases have no file payloads yet; the distribution builder supplies them afterward.
  if (
    Object.entries(record(story.assets)).some(
      ([id, raw]) => typeof record(raw).file === 'string' && !retained.has(id),
    )
  ) {
    assert(allowMissingFilePayloads, 'Missing retained file payloads.');
    return previous;
  }
  const oldDefinitions = Object.fromEntries(
    [...retained].map(([id, asset]) => {
      const source = asset.source;
      return [
        id,
        {
          kind: asset.kind,
          loading: asset.loading,
          ...(asset.target === undefined ? {} : {target: asset.target}),
          ...(asset.bitmapResolution === undefined
            ? {}
            : {bitmapResolution: asset.bitmapResolution}),
          ...(source.type === 'file'
            ? {file: source.inputPath}
            : source.type === 'remote'
              ? {delivery: 'remote', source}
              : {name: source.name}),
        },
      ];
    }),
  );
  const options = {
    maxFiles: 4096,
    maxFileBytes: 128 * 1024 * 1024,
    maxTotalBytes: 256 * 1024 * 1024,
    subtleCrypto: webcrypto.subtle,
  };
  const snapshot = await validateDsl4EmbeddedAssetBundle(
    {kind: 'StoryDocument', version: '4.0', assets: oldDefinitions},
    previous,
    options,
  );
  const manifest = {
    formatVersion: 1,
    assets: Object.entries(record(story.assets))
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([id, raw]) => {
        const asset = record(raw);
        if (typeof asset.file === 'string') return retained.get(id);
        return {
          id,
          kind: asset.kind,
          loading: asset.loading,
          ...(asset.target === undefined ? {} : {target: asset.target}),
          ...(asset.bitmapResolution === undefined
            ? {}
            : {bitmapResolution: asset.bitmapResolution}),
          source:
            asset.delivery === 'remote'
              ? {type: 'remote', ...record(asset.source)}
              : {type: 'project', name: asset.name},
        };
      }),
  };
  return createDsl4EmbeddedAssetBundle(
    story,
    {manifest, getFile: snapshot.getFile},
    options,
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  assert.equal(process.argv[2], '--simplify');
  assert.equal(process.argv.length, 7);
  assert(['true', 'false'].includes(process.argv[5]!));
  await simplifyNativeAssets(
    process.argv[3]!,
    process.argv[4]!,
    process.argv[5] === 'true',
    process.argv[6]!,
  );
}
