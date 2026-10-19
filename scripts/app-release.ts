import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {appendFile, mkdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const repository = 'kubohiroya/turbowarp-kamishibai-app';
const repositoryUrl = `https://github.com/${repository}`;
const api = `https://api.github.com/repos/${repository}`;
const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const sha256 = (bytes: Uint8Array | string) =>
  createHash('sha256').update(bytes).digest('hex');
type FetchLike = (url: string, options?: RequestInit) => Promise<Response>;

interface GithubRelease {
  tag_name: string;
  draft: boolean;
  prerelease: boolean;
  published_at: string | null;
  assets: {name: string; size: number; digest?: string}[];
}

export interface AppRelease {
  formatVersion: number;
  repository: string;
  version: string;
  tag: string;
  commit: string;
  publishedAt: string;
  sourceIdentity: string;
  artifact: {filename: string; url: string; size: number; sha256: string};
}

function releaseVersion(release: GithubRelease) {
  const match = /^v4\.0\.(\d+)(?:-rc\.(\d+))?$/u.exec(release.tag_name);
  if (!match || release.draft || !release.published_at) return null;
  return {patch: Number(match[1]), rc: Number(match[2] ?? Infinity)};
}

/** RCs are eligible; the GitHub latest-release endpoint does not include them. */
export function selectAppRelease(releases: GithubRelease[]): GithubRelease {
  const eligible = releases.filter((release) => releaseVersion(release));
  eligible.sort((a, b) => {
    const av = releaseVersion(a)!;
    const bv = releaseVersion(b)!;
    return bv.patch - av.patch || bv.rc - av.rc;
  });
  assert(eligible[0], 'No published DSL 4.0 release is available.');
  return eligible[0];
}

export async function resolveAppRelease({
  fetchImplementation = fetch as FetchLike,
  token = process.env.GH_TOKEN,
} = {}): Promise<{lock: AppRelease; bytes: Buffer}> {
  async function request(url: string) {
    const headers: Record<string, string> = url.startsWith(
      'https://api.github.com/',
    )
      ? {
          Accept: 'application/vnd.github+json',
          ...(token ? {Authorization: `Bearer ${token}`} : {}),
        }
      : {};
    const response = await fetchImplementation(url, {
      headers,
      signal: AbortSignal.timeout(60000),
    });
    assert(
      response.ok,
      `Cannot read app release input: ${url} (HTTP ${response.status}).`,
    );
    return response;
  }
  const releases: GithubRelease[] = [];
  for (let page = 1; ; page += 1) {
    assert(page <= 100, 'Release pagination exceeded its limit.');
    const batch = (await (
      await request(`${api}/releases?per_page=100&page=${page}`)
    ).json()) as GithubRelease[];
    assert(Array.isArray(batch), 'Release list must be an array.');
    releases.push(...batch);
    if (batch.length < 100) break;
  }
  const release = selectAppRelease(releases);
  const version = release.tag_name.slice(1);
  const commit = (await (
    await request(`${api}/commits/${encodeURIComponent(release.tag_name)}`)
  ).json()) as {sha: string};
  assert.match(commit.sha, /^[a-f0-9]{40}$/u);
  const raw = `https://raw.githubusercontent.com/${repository}/${commit.sha}`;
  const metadata = (await (
    await request(`${raw}/release-metadata/${version}.json`)
  ).json()) as {
    version: string;
    sourceIdentity: string;
    artifact: AppRelease['artifact'];
    publication: {github: {tag: string}};
  };
  const packageJson = (await (await request(`${raw}/package.json`)).json()) as {
    version: string;
  };
  assert.equal(
    metadata.version,
    version,
    'Release metadata differs from its tag.',
  );
  assert.equal(
    packageJson.version,
    version,
    'Builder version differs from its release.',
  );
  assert.equal(metadata.publication.github.tag, release.tag_name);
  assert.match(metadata.sourceIdentity, /^sha256:[a-f0-9]{64}$/u);
  const artifact = metadata.artifact;
  assert.equal(artifact.filename, `kamishibai-${version}.sb3`);
  assert.equal(
    artifact.url,
    `${repositoryUrl}/releases/download/${release.tag_name}/${artifact.filename}`,
  );
  assert.match(artifact.sha256, /^[a-f0-9]{64}$/u);
  assert(Number.isSafeInteger(artifact.size) && artifact.size > 0);
  const asset = release.assets.find(({name}) => name === artifact.filename);
  assert(
    asset,
    'The newest release has no Standard SB3; refusing to use an older release.',
  );
  assert.equal(
    asset.size,
    artifact.size,
    'Release asset size differs from metadata.',
  );
  if (asset.digest) assert.equal(asset.digest, `sha256:${artifact.sha256}`);
  const bytes = Buffer.from(await (await request(artifact.url)).arrayBuffer());
  assert.equal(
    bytes.length,
    artifact.size,
    'Downloaded base SB3 size differs.',
  );
  assert.equal(
    sha256(bytes),
    artifact.sha256,
    'Downloaded base SB3 hash differs.',
  );
  return {
    bytes,
    lock: {
      formatVersion: 1,
      repository,
      version,
      tag: release.tag_name,
      commit: commit.sha,
      publishedAt: release.published_at!,
      sourceIdentity: metadata.sourceIdentity,
      artifact,
    },
  };
}

/** A deployed snapshot can be newer than the committed one on a scheduled build. */
export async function publishedAppReleaseDiffers(
  current: AppRelease,
  fetchImplementation: FetchLike = fetch,
) {
  const response = await fetchImplementation(
    'https://kubohiroya.github.io/turbowarp-kamishibai-samples/app-release.json',
    {signal: AbortSignal.timeout(60000), cache: 'no-store'},
  );
  assert(
    response.ok || response.status === 404,
    `Cannot compare public app dependency (HTTP ${response.status}).`,
  );
  return (
    response.status === 404 ||
    JSON.stringify(await response.json()) !== JSON.stringify(current)
  );
}

export async function syncAppRelease({
  root = projectRoot,
  ...options
}: {
  root?: string;
  fetchImplementation?: FetchLike;
  token?: string;
} = {}) {
  const {lock, bytes} = await resolveAppRelease(options);
  const configPath = path.join(root, 'stories/urashima/dsl4-build.config.json');
  const config = JSON.parse(await readFile(configPath, 'utf8'));
  config.runtime = {
    repository: repositoryUrl,
    version: lock.version,
    commit: lock.commit,
    basePath: config.runtime.basePath,
    baseSourceIdentity: lock.sourceIdentity,
    baseSize: lock.artifact.size,
    baseSha256: lock.artifact.sha256,
  };
  // The authoring CLI and the base always come from the same release.
  delete config.blockAuthoring.commit;
  delete config.blockAuthoring.repository;
  delete config.blockAuthoring.refreshRuntime;
  const tutorialPath = path.join(
    root,
    'stories/tutorial/dsl4-build.config.json',
  );
  const tutorial = JSON.parse(await readFile(tutorialPath, 'utf8'));
  tutorial.version = lock.version;
  tutorial.releaseDependency = `${repositoryUrl}/releases/tag/${lock.tag}`;
  tutorial.publication.reason = `TurboWarp-Kamishibai ${lock.version} release artifacts are published and integrity-verified`;
  const files = new Map<string, string | Buffer>([
    [path.join(root, 'app-release.json'), `${JSON.stringify(lock, null, 2)}\n`],
    [configPath, `${JSON.stringify(config, null, 2)}\n`],
    [tutorialPath, `${JSON.stringify(tutorial, null, 2)}\n`],
    [path.join(root, 'stories/urashima', config.runtime.basePath), bytes],
  ]);
  let changed = false;
  for (const [filename, contents] of files) {
    const next = Buffer.from(contents);
    const previous = await readFile(filename).catch(
      (error: NodeJS.ErrnoException) => {
        if (error.code === 'ENOENT') return Buffer.alloc(0);
        throw error;
      },
    );
    if (!previous.equals(next)) {
      await mkdir(path.dirname(filename), {recursive: true});
      await writeFile(filename, next);
      changed = true;
    }
  }
  console.log(
    `App release ${lock.tag}: ${changed ? 'updated' : 'unchanged'} (${lock.commit}).`,
  );
  return {lock, changed};
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  assert.equal(process.argv.length, 2, 'Usage: node scripts/app-release.ts');
  const {lock, changed} = await syncAppRelease();
  const publish =
    process.env.COMPARE_PUBLISHED_APP_RELEASE === 'true'
      ? await publishedAppReleaseDiffers(lock)
      : changed;
  if (process.env.GITHUB_OUTPUT)
    await appendFile(process.env.GITHUB_OUTPUT, `changed=${publish}\n`);
}
