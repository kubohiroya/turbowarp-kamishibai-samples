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
    {authorDsl4BlockSourceSb3, authorDsl4BlockSourceGraphSb3},
    {createDsl4BlockSourceGraph},
    {createDsl4SourceGraphFrontend},
    {addProjectAsset, projectTarget, readProjectMaterial},
  ] = await Promise.all([
    load('dist/builder/dsl4-source-frontend.js'),
    load('dist/dsl4/definition-references.js'),
    load('dist/dsl4/turbowarp-yaml-json-block-source.js'),
    load('dist/dsl4/compiled-project.js'),
    load('dist/builder/dsl4-block-source-author.js'),
    load('dist/dsl4/block-source-export.js'),
    load('dist/dsl4/source-graph-frontend.js'),
    load('dist/builder/dsl4-asset-project-material.js'),
  ]);
  const schema = JSON.parse(
    await readFile(path.join(appRoot, 'schema/dsl-4.schema.json'), 'utf8'),
  );
  const frontend = createDsl4ProductionSourceFrontend(schema, {
    narrativeControlEnabled: true,
  });
  const graph = extractDsl4BlockSourcesFromProject(project);
  const entry = graph.sources[graph.entryPath];
  const hasModules = Object.keys(graph.sources).length > 1;
  const composed = async (sources: typeof graph) => {
    if (Object.keys(sources.sources).length === 1) return sources.sources[sources.entryPath];
    const sourceGraph = await createDsl4BlockSourceGraph(sources);
    const parsed = createDsl4SourceGraphFrontend(frontend).parse(sourceGraph, {
      project, featureFlags: {dsl4Runtime: true, dsl4SourceIncludes: true},
      maxComposedSourceBytes: sourceGraph.limits.maxTotalSourceBytes,
    });
    assert(parsed.ok, JSON.stringify(parsed.diagnostics));
    return parsed.canonicalSource;
  };
  const text = await composed(graph);
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
  let sourceGraph;
  if (hasModules) {
    // Scene-only modules retain their own authored declarations while media moves into native slots.
    const sources: Record<string, string> = {};
    const filenames = new Map<string, string>();
    for (const [sourcePath, text] of Object.entries(graph.sources)) {
      if (sourcePath === graph.entryPath) continue;
      assert.deepEqual(Object.keys(parse(text as string)), ['scenes']);
      const {targetName, blockId} = graph.sourceLocations[sourcePath];
      const target = project.targets.find((candidate: {name: string}) => candidate.name === targetName);
      const filename = target.blocks[blockId].inputs.LABEL[1][1];
      assert(typeof filename === 'string' && !Object.hasOwn(sources, filename));
      filenames.set(sourcePath, filename);
      sources[filename] = text as string;
    }
    const {scenes: _scenes, ...definitions} = simplified.source;
    const include = parse(entry).include as string | string[];
    sources[graph.entryPath] = stringify({
      ...definitions,
      include: [include].flat().map((sourcePath) => {
        const filename = filenames.get(sourcePath);
        assert(filename, `The included scene ${sourcePath} needs its original filename.`);
        return filename;
      }),
    });
    sourceGraph = await createDsl4BlockSourceGraph({...graph, sources});
  }
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
  const authoringOptions = {
    baseBytes: zipSync(archive),
    sourceFrontend: frontend,
    sourceSections,
    narrativeRuntimeSource: runtime,
  };
  const authored = sourceGraph
    ? await authorDsl4BlockSourceGraphSb3({...authoringOptions, sourceGraph})
    : authorDsl4BlockSourceSb3({...authoringOptions, sourceText: stringify(simplified.source)});
  assert(authored.ok, JSON.stringify(authored.diagnostics));
  const outputProject = JSON.parse(
    strFromU8(unzipSync(authored.bytes)['project.json']!),
  );
  const exported = extractDsl4BlockSourcesFromProject(outputProject);
  assert.equal(
    executable(parse(await composed(exported))),
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

/** Resolve the same ordered include graph used by the pinned App's CLI. */
export async function composeDsl4Source(
  sourceText: string,
  appRoot: string,
  includeDirectory: string,
  project?: Record<string, unknown>,
  sources?: {entryPath: string; files: Record<string, string>},
): Promise<string> {
  if (!Object.hasOwn(record(parse(sourceText)), 'include')) return sourceText;
  const load = (file: string) => import(pathToFileURL(path.join(appRoot, file)).href);
  const [
    {loadDsl4BuildSourceGraph},
    {createDsl4SourceGraph},
    {createDsl4ProductionSourceFrontend},
    {createDsl4SourceGraphFrontend},
    schema,
  ] = await Promise.all([
    load('dist/builder/dsl4-source-graph.js'),
    load('dist/dsl4/source-graph.js'),
    load('dist/builder/dsl4-source-frontend.js'),
    load('dist/dsl4/source-graph-frontend.js'),
    readFile(path.join(appRoot, 'schema/dsl-4.schema.json'), 'utf8').then(JSON.parse),
  ]);
  const graph = sources
    ? await createDsl4SourceGraph(sources.entryPath, {
        readSource(filename: string) {
          assert(Object.hasOwn(sources.files, filename), `Missing exported source ${filename}.`);
          return sources.files[filename];
        },
      })
    : await loadDsl4BuildSourceGraph(includeDirectory, {
        manifest: {path: 'story.k4.yml'},
        descriptor: {text: sourceText},
      });
  const frontend = createDsl4ProductionSourceFrontend(schema, {narrativeControlEnabled: true});
  const parsed = createDsl4SourceGraphFrontend(frontend).parse(graph, {
    project,
    featureFlags: {dsl4Runtime: true, dsl4SourceIncludes: true},
    maxComposedSourceBytes: graph.limits.maxTotalSourceBytes,
  });
  assert(parsed.ok, JSON.stringify(parsed.diagnostics));
  return parsed.canonicalSource;
}

/** Read either output shape returned by export-block-dsl. */
export async function readExportedDsl4Source(
  cliOutput: string,
  appRoot: string,
  project: Record<string, unknown>,
): Promise<string> {
  const {kind, entryFilename, outputPath, files: entries} = JSON.parse(cliOutput) as {
    kind: 'single' | 'package';
    entryFilename: string;
    outputPath: string;
    files: {path: string}[];
  };
  if (kind === 'single') return readFile(outputPath, 'utf8');
  const entry = entries.find(({path: filename}) => filename.endsWith('/' + entryFilename));
  assert(entry, `Missing export entry ${entryFilename}.`);
  const packagePrefix = path.posix.dirname(entry.path) + '/';
  const files = Object.fromEntries(
    Object.entries(unzipSync(await readFile(outputPath))).map(([name, bytes]) => {
      assert(name.startsWith(packagePrefix), `Unexpected export entry ${name}.`);
      return [name.slice(packagePrefix.length), strFromU8(bytes)];
    }),
  );
  assert(Object.hasOwn(files, entryFilename), `Missing export entry ${entryFilename}.`);
  return composeDsl4Source(files[entryFilename]!, appRoot, path.dirname(outputPath), project, {
    entryPath: entryFilename,
    files,
  });
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
  const result = frontend.parse(
    await composeDsl4Source(sourceText, appRoot, assetRoot, project),
    {project},
  );
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
    {createDsl4BlockSourceGraph},
    {createDsl4SourceGraphFrontend},
  ] = await Promise.all([
    load('dist/builder/dsl4-source-frontend.js'),
    load('dist/dsl4/turbowarp-yaml-json-block-source.js'),
    load('dist/dsl4/asset-bundle-descriptor.js'),
    load('dist/dsl4/block-source-export.js'),
    load('dist/dsl4/source-graph-frontend.js'),
  ]);
  const frontend = createDsl4ProductionSourceFrontend(
    JSON.parse(
      await readFile(path.join(appRoot, 'schema/dsl-4.schema.json'), 'utf8'),
    ),
    {narrativeControlEnabled: true},
  );
  const graph = extractDsl4BlockSourcesFromProject(project);
  const sourceGraph = await createDsl4BlockSourceGraph(graph);
  const parsed = createDsl4SourceGraphFrontend(frontend).parse(sourceGraph, {
    project, featureFlags: {dsl4Runtime: true, dsl4SourceIncludes: true},
    maxComposedSourceBytes: sourceGraph.limits.maxTotalSourceBytes,
  });
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
