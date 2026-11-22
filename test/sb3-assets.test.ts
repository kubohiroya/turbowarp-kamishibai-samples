import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir, mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {afterEach, test} from 'vitest';

import {
  fetchSb3Assets,
  publishSb3Assets,
  readSb3Manifest,
  releaseAssetUrl,
  releaseTag,
  sb3Status,
  type RunCommand,
  type Sb3Asset,
} from '../scripts/sb3-assets.ts';

const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, {recursive: true, force: true})));
});

const base = Buffer.from('app base');
const appBaseUrl = 'https://github.com/kubohiroya/turbowarp-kamishibai-app/releases/download/v4.0.1/kamishibai-4.0.1.sb3';

function record(relative: string, bytes: Buffer, tag = 'sb3-20261122-0123abcd'): Sb3Asset {
  return {path: relative, size: bytes.length, sha256: sha256(bytes), url: releaseAssetUrl(tag, path.posix.basename(relative))};
}

async function project(files: Sb3Asset[]) {
  const root = await mkdtemp(path.join(tmpdir(), 'sb3-assets-'));
  roots.push(root);
  await writeFile(path.join(root, 'app-release.json'), JSON.stringify({
    formatVersion: 1,
    repository: 'kubohiroya/turbowarp-kamishibai-app',
    version: '4.0.1',
    tag: 'v4.0.1',
    commit: 'a'.repeat(40),
    publishedAt: '2026-11-21T21:21:36Z',
    sourceIdentity: `sha256:${'b'.repeat(64)}`,
    artifact: {filename: 'kamishibai-4.0.1.sb3', sha256: sha256(base), size: base.length, url: appBaseUrl},
  }));
  await writeFile(path.join(root, 'sb3-assets.json'), JSON.stringify({
    formatVersion: 1,
    repository: 'kubohiroya/turbowarp-kamishibai-samples',
    files,
  }));
  return root;
}

function server(contents: Map<string, Buffer>) {
  const requested: string[] = [];
  const fetchImplementation = async (input: URL | string) => {
    requested.push(String(input));
    const bytes = contents.get(String(input));
    return bytes ? new Response(new Uint8Array(bytes)) : new Response('missing', {status: 404});
  };
  return {requested, fetchImplementation};
}

test('fetch downloads missing files, keeps matching and regenerated ones, and verifies the bytes', async () => {
  const tekona = Buffer.from('tekona');
  const tutorial = Buffer.from('tutorial');
  const files = [record('stories/tekona/tekona-4.0.sb3', tekona), record('stories/tutorial/tutorial-4.0.sb3', tutorial)];
  const root = await project(files);
  await mkdir(path.join(root, 'stories/tutorial'), {recursive: true});
  await writeFile(path.join(root, 'stories/tutorial/tutorial-4.0.sb3'), 'regenerated');
  const {requested, fetchImplementation} = server(new Map([
    [files[0]!.url, tekona],
    [files[1]!.url, tutorial],
    [appBaseUrl, base],
  ]));

  const first = await fetchSb3Assets({root, fetchImplementation});
  assert.deepEqual(first.downloaded, ['stories/tekona/tekona-4.0.sb3', 'stories/urashima/base/kamishibai-4.0.sb3']);
  assert.deepEqual(first.differing, ['stories/tutorial/tutorial-4.0.sb3']);
  assert.equal(await readFile(path.join(root, 'stories/tutorial/tutorial-4.0.sb3'), 'utf8'), 'regenerated');
  assert.deepEqual(await readFile(path.join(root, 'stories/urashima/base/kamishibai-4.0.sb3')), base);

  requested.length = 0;
  const second = await fetchSb3Assets({root, fetchImplementation});
  assert.deepEqual(second.downloaded, []);
  assert.deepEqual(requested, []);

  const forced = await fetchSb3Assets({root, fetchImplementation, force: true});
  assert.deepEqual(forced.downloaded, ['stories/tutorial/tutorial-4.0.sb3']);
  assert.deepEqual(await readFile(path.join(root, 'stories/tutorial/tutorial-4.0.sb3')), tutorial);
});

test('fetch refuses bytes that differ from the record and retries transient failures', async () => {
  const tekona = Buffer.from('tekona');
  const files = [record('stories/tekona/tekona-4.0.sb3', tekona)];
  const root = await project(files);
  await mkdir(path.join(root, 'stories/urashima/base'), {recursive: true});
  await writeFile(path.join(root, 'stories/urashima/base/kamishibai-4.0.sb3'), base);

  const tampered = server(new Map([[files[0]!.url, Buffer.from('tekonA')]]));
  await assert.rejects(
    fetchSb3Assets({root, fetchImplementation: tampered.fetchImplementation}),
    /downloaded SHA-256 differs/u,
  );
  await assert.rejects(readFile(path.join(root, 'stories/tekona/tekona-4.0.sb3')), {code: 'ENOENT'});

  let calls = 0;
  const flaky = async () => (++calls === 1 ? new Response('busy', {status: 503}) : new Response(new Uint8Array(tekona)));
  const result = await fetchSb3Assets({root, fetchImplementation: flaky, wait: async () => {}});
  assert.equal(calls, 2);
  assert.deepEqual(result.downloaded, ['stories/tekona/tekona-4.0.sb3']);
});

test('the record only accepts SB3 files under stories/ from this repository\'s sb3 releases', async () => {
  const bytes = Buffer.from('x');
  for (const file of [
    {...record('stories/a.sb3', bytes), url: 'https://example.com/a.sb3'},
    record('docs/a.sb3', bytes),
    record('stories/../a.sb3', bytes),
    record('stories/urashima/base/kamishibai-4.0.sb3', bytes),
  ]) {
    const root = await project([file]);
    await assert.rejects(readSb3Manifest(root));
  }
});

test('status lists changed and new local files and recorded files that are missing', async () => {
  const kept = Buffer.from('kept');
  const files = [
    record('stories/a/kept.sb3', kept),
    record('stories/a/changed.sb3', Buffer.from('old')),
    record('stories/a/gone.sb3', Buffer.from('gone')),
  ];
  const root = await project(files);
  await mkdir(path.join(root, 'stories/a'), {recursive: true});
  await mkdir(path.join(root, 'stories/urashima/base'), {recursive: true});
  await writeFile(path.join(root, 'stories/a/kept.sb3'), kept);
  await writeFile(path.join(root, 'stories/a/changed.sb3'), 'new');
  await writeFile(path.join(root, 'stories/a/added.sb3'), 'added');
  await writeFile(path.join(root, 'stories/urashima/base/kamishibai-4.0.sb3'), 'from the app');

  const status = await sb3Status(root);
  assert.deepEqual(status.changes.map(({path: file, status: kind}) => [kind, file]), [
    ['new', 'stories/a/added.sb3'],
    ['changed', 'stories/a/changed.sb3'],
  ]);
  assert.deepEqual(status.missing, ['stories/a/gone.sb3']);
  await assert.rejects(publishSb3Assets({root, run: async () => ''}), /missing locally/u);
});

test('publish uploads changed files as one new release and records them', async () => {
  const kept = Buffer.from('kept');
  const keptRecord = record('stories/a/kept.sb3', kept, 'sb3-20261101-00000000');
  const root = await project([keptRecord, record('stories/a/changed.sb3', Buffer.from('old'))]);
  await mkdir(path.join(root, 'stories/a'), {recursive: true});
  await mkdir(path.join(root, 'stories/b'), {recursive: true});
  await writeFile(path.join(root, 'stories/a/kept.sb3'), kept);
  await writeFile(path.join(root, 'stories/a/changed.sb3'), 'new');
  await writeFile(path.join(root, 'stories/b/added.sb3'), 'added');

  const calls: string[][] = [];
  const run: RunCommand = async (command, args) => {
    calls.push([command, ...args]);
    if (args[1] === 'view') {
      return JSON.stringify({assets: [
        {name: 'changed.sb3', size: 3, digest: `sha256:${sha256(Buffer.from('new'))}`},
        {name: 'added.sb3', size: 5},
      ]});
    }
    return '';
  };
  const date = new Date('2026-11-22T03:00:00Z');
  const result = await publishSb3Assets({root, run, date, target: 'c'.repeat(40)});
  const expectedTag = releaseTag([
    {path: 'stories/a/changed.sb3', sha256: sha256(Buffer.from('new'))},
    {path: 'stories/b/added.sb3', sha256: sha256(Buffer.from('added'))},
  ], date);
  assert.match(expectedTag, /^sb3-20261122-[a-f0-9]{8}$/u);
  assert.equal(result?.tag, expectedTag);

  const create = calls[0]!;
  assert.deepEqual(create.slice(0, 4), ['gh', 'release', 'create', expectedTag]);
  assert(create.includes('--latest=false'));
  assert.equal(create[create.indexOf('--target') + 1], 'c'.repeat(40));
  assert.deepEqual(create.filter((arg) => arg.endsWith('.sb3')).map((file) => path.relative(root, file)), [
    path.join('stories', 'a', 'changed.sb3'),
    path.join('stories', 'b', 'added.sb3'),
  ]);

  const manifest = await readSb3Manifest(root);
  assert.deepEqual(manifest.files.map((file) => [file.path, file.url]), [
    ['stories/a/changed.sb3', releaseAssetUrl(expectedTag, 'changed.sb3')],
    ['stories/a/kept.sb3', keptRecord.url],
    ['stories/b/added.sb3', releaseAssetUrl(expectedTag, 'added.sb3')],
  ]);
  assert.deepEqual((await sb3Status(root)).changes, []);
  assert.equal(await publishSb3Assets({root, run, date}), null);
});

test('publish refuses a release whose uploaded asset differs from the local file', async () => {
  const root = await project([]);
  await mkdir(path.join(root, 'stories/a'), {recursive: true});
  await writeFile(path.join(root, 'stories/a/added.sb3'), 'added');
  const run: RunCommand = async (_command, args) =>
    args[1] === 'view' ? JSON.stringify({assets: [{name: 'added.sb3', size: 4}]}) : '';
  await assert.rejects(publishSb3Assets({root, run, target: 'c'.repeat(40)}), /uploaded size differs/u);
  assert.deepEqual((await readSb3Manifest(root)).files, []);
});

test('two works may not upload files with the same name in one release', async () => {
  const root = await project([]);
  await mkdir(path.join(root, 'stories/a'), {recursive: true});
  await mkdir(path.join(root, 'stories/b'), {recursive: true});
  await writeFile(path.join(root, 'stories/a/same.sb3'), 'a');
  await writeFile(path.join(root, 'stories/b/same.sb3'), 'b');
  await assert.rejects(publishSb3Assets({root, run: async () => '', target: 'c'.repeat(40)}), /share the asset name/u);
});
