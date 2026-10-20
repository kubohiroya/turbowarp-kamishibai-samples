import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp, mkdir, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {test} from 'vitest';
import {appBasePath, readAppRelease} from '../scripts/app-dependency.ts';
import {
  publishedAppReleaseDiffers,
  resolveAppRelease,
  selectAppRelease,
  syncAppRelease,
} from '../scripts/app-release.ts';

const repo = 'kubohiroya/turbowarp-kamishibai-app';
const api = `https://api.github.com/repos/${repo}`;
const makeRelease = (tag: string) => ({
  tag_name: tag,
  draft: false,
  prerelease: tag.includes('-'),
  published_at: '2026-10-20T00:00:00Z',
  assets: [] as {name: string; size: number; digest?: string}[],
});
function upstream(corrupt = false) {
  const version = '4.0.0-rc.30';
  const tag = `v${version}`;
  const commit = 'a'.repeat(40);
  const bytes = Buffer.from('verified-base');
  const artifact = {
    filename: `kamishibai-${version}.sb3`,
    size: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    url: `https://github.com/${repo}/releases/download/${tag}/kamishibai-${version}.sb3`,
  };
  const release = makeRelease(tag);
  release.assets = [
    {
      name: artifact.filename,
      size: bytes.length,
      digest: `sha256:${artifact.sha256}`,
    },
  ];
  const raw = `https://raw.githubusercontent.com/${repo}/${commit}`;
  const routes = new Map<string, unknown>([
    [`${api}/releases?per_page=100&page=1`, [release]],
    [`${api}/commits/${tag}`, {sha: commit}],
    [
      `${raw}/release-metadata/${version}.json`,
      {
        version,
        sourceIdentity: `sha256:${'b'.repeat(64)}`,
        artifact,
        publication: {github: {tag}},
      },
    ],
    [`${raw}/package.json`, {version}],
    [artifact.url, corrupt ? Buffer.from('x'.repeat(bytes.length)) : bytes],
  ]);
  const fetchImplementation = async (url: string, options?: RequestInit) => {
    assert(routes.has(url), `Unexpected URL: ${url}`);
    const headers = options!.headers as Record<string, string>;
    if (!url.startsWith('https://api.github.com/'))
      assert.equal(headers.Authorization, undefined);
    const value = routes.get(url);
    return new Response(
      Buffer.isBuffer(value) ? new Uint8Array(value) : JSON.stringify(value),
    );
  };
  return {fetchImplementation, routes, release, artifact, bytes, commit};
}

test('selects published numeric RCs and stable releases while excluding drafts', () => {
  const releases = ['v3.2.3', 'v4.0.0-rc.9', 'v4.0.0-rc.30', 'v4.1.0'].map(
    makeRelease,
  );
  releases.push({...makeRelease('v4.0.0-rc.99'), draft: true});
  assert.equal(selectAppRelease(releases).tag_name, 'v4.0.0-rc.30');
  assert.equal(
    selectAppRelease([...releases, makeRelease('v4.0.0')]).tag_name,
    'v4.0.0',
  );
  assert.throws(() => selectAppRelease([makeRelease('v3.2.3')]));
});

test('verifies the downloaded artifact against tagged metadata and GitHub digest', async () => {
  const fixture = upstream();
  const {lock, bytes} = await resolveAppRelease({
    ...fixture,
    token: 'test-token',
  });
  assert.equal(lock.commit, fixture.commit);
  assert.equal(lock.artifact.sha256, fixture.artifact.sha256);
  assert.deepEqual(bytes, fixture.bytes);
});

test('reads further release pages before selecting a version', async () => {
  const fixture = upstream();
  fixture.routes.set(
    `${api}/releases?per_page=100&page=1`,
    Array.from({length: 100}, () => makeRelease('v3.2.3')),
  );
  fixture.routes.set(`${api}/releases?per_page=100&page=2`, [fixture.release]);
  assert.equal((await resolveAppRelease(fixture)).lock.version, '4.0.0-rc.30');
});

test('rejects a corrupt newest artifact and missing assets without fallback', async () => {
  await assert.rejects(resolveAppRelease(upstream(true)), /hash differs/u);
  const fixture = upstream();
  fixture.release.assets = [];
  await assert.rejects(
    resolveAppRelease(fixture),
    /newest release has no Standard SB3/u,
  );
});

test('rejects builder/version mismatch and transport failures', async () => {
  const fixture = upstream();
  fixture.routes.set(
    `https://raw.githubusercontent.com/${repo}/${fixture.commit}/package.json`,
    {version: '4.0.0-rc.25'},
  );
  await assert.rejects(resolveAppRelease(fixture), /Builder version differs/u);
  await assert.rejects(
    resolveAppRelease({
      fetchImplementation: async () => new Response('', {status: 503}),
    }),
    /HTTP 503/u,
  );
});

test('updates only the shared manifest and base, preserving story settings deterministically', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'samples-app-release-test-'));
  try {
    const settings = JSON.stringify({dsl4: {blockAuthoring: {sourceSections: true}}});
    await mkdir(path.join(root, 'stories/urashima'), {recursive: true});
    const configPath = path.join(root, 'stories/urashima/sample.config.json');
    await writeFile(configPath, settings);
    const fixture = upstream();
    const first = await syncAppRelease({root, ...fixture});
    assert.equal(first.changed, true);
    assert.equal((await readAppRelease(root)).commit, fixture.commit);
    assert.equal(await readFile(configPath, 'utf8'), settings);
    assert.deepEqual(await readFile(appBasePath(root)), fixture.bytes);
    assert.equal((await syncAppRelease({root, ...fixture})).changed, false);
    await assert.rejects(syncAppRelease({root, ...upstream(true)}));
    assert.deepEqual(await readFile(appBasePath(root)), fixture.bytes);
    assert.equal(await readFile(configPath, 'utf8'), settings);
  } finally {
    await rm(root, {recursive: true, force: true});
  }
});

test('compares with the deployed release and fails on unavailable public status', async () => {
  const {lock} = await resolveAppRelease(upstream());
  assert.equal(
    await publishedAppReleaseDiffers(lock, async () => Response.json(lock)),
    false,
  );
  assert.equal(
    await publishedAppReleaseDiffers(
      lock,
      async () => new Response('', {status: 404}),
    ),
    true,
  );
  await assert.rejects(
    publishedAppReleaseDiffers(
      lock,
      async () => new Response('', {status: 503}),
    ),
    /HTTP 503/u,
  );
});
