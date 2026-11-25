import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { appBasePath, readAppRelease } from "./app-dependency.ts";

const repository = "kubohiroya/turbowarp-kamishibai-app";
const repositoryUrl = `https://github.com/${repository}`;
const api = `https://api.github.com/repos/${repository}`;
const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const sha256 = (bytes: Uint8Array | string) =>
  createHash("sha256").update(bytes).digest("hex");
type FetchLike = (url: string, options?: RequestInit) => Promise<Response>;

interface GithubRelease {
  tag_name: string;
  draft: boolean;
  prerelease: boolean;
  published_at: string | null;
  assets: { name: string; size: number; digest?: string }[];
}

export interface AppRelease {
  formatVersion: number;
  repository: string;
  version: string;
  tag: string;
  commit: string;
  publishedAt: string;
  sourceIdentity: string;
  artifact: { filename: string; url: string; size: number; sha256: string };
}

/**
 * The releases the works may follow.
 *
 * This used to be written into the selection itself: a tag had to match `^v4.0.(\d+)(-rc.N)?$`,
 * drafts and unpublished releases were out, and a stable release outranked an RC. That is a range,
 * and it was a range nobody could see or change without editing the comparison. It is declared in
 * repo-policy.json now, beside the 3.2 series pin that the same file already carries.
 *
 * The bounds stay inside one series, so the comparison is still the patch and RC numbers and
 * nothing here needs a semver implementation.
 */
export interface AppReleasePolicy {
  /** The major.minor series the works follow, e.g. '4.0'. */
  readonly series: string;
  /** Whether an `-rc.N` release may be selected. A stable release always outranks an RC. */
  readonly allowPrerelease: boolean;
  /** Inclusive lower bound inside the series, e.g. '4.0.12'. */
  readonly minimumVersion?: string;
  /** Exclusive upper bound inside the series, e.g. '4.0.20'. */
  readonly maximumVersion?: string;
}

/** What the selection did before the range could be declared. */
export const defaultAppReleasePolicy: AppReleasePolicy = Object.freeze({
  series: "4.0",
  allowPrerelease: true,
});

function patchOf(version: string, series: string, name: string): number {
  const match = new RegExp(`^${series.replace(".", "\\.")}\\.(\\d+)$`, "u").exec(version);
  assert(match, `repo-policy.json dependencies.app.${name} must be a ${series}.x version.`);
  return Number(match[1]);
}

/** Read the declared policy, falling back to what the selection has always done. */
export async function readAppReleasePolicy(
  root = projectRoot,
): Promise<AppReleasePolicy> {
  // A tree without the policy file — a temporary root in a test, an export without it — follows
  // what the selection always did rather than failing. Declaring nothing and having no file to
  // declare it in mean the same thing here.
  const contents = await readFile(path.join(root, "repo-policy.json"), "utf8").catch(
    (error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") return undefined;
      throw error;
    },
  );
  if (contents === undefined) return defaultAppReleasePolicy;
  const policy = JSON.parse(contents) as {
    dependencies?: { app?: Partial<AppReleasePolicy> };
  };
  const declared = policy.dependencies?.app;
  if (!declared) return defaultAppReleasePolicy;
  const series = declared.series ?? defaultAppReleasePolicy.series;
  assert.match(series, /^\d+\.\d+$/u, "repo-policy.json dependencies.app.series");
  const allowPrerelease =
    declared.allowPrerelease ?? defaultAppReleasePolicy.allowPrerelease;
  assert.equal(
    typeof allowPrerelease,
    "boolean",
    "repo-policy.json dependencies.app.allowPrerelease must be a boolean.",
  );
  for (const [name, value] of [
    ["minimumVersion", declared.minimumVersion],
    ["maximumVersion", declared.maximumVersion],
  ] as const) {
    if (value !== undefined) patchOf(value, series, name);
  }
  if (declared.minimumVersion !== undefined && declared.maximumVersion !== undefined) {
    assert(
      patchOf(declared.minimumVersion, series, "minimumVersion") <
        patchOf(declared.maximumVersion, series, "maximumVersion"),
      "repo-policy.json dependencies.app.minimumVersion must be below maximumVersion.",
    );
  }
  return Object.freeze({
    series,
    allowPrerelease,
    ...(declared.minimumVersion === undefined
      ? {}
      : { minimumVersion: declared.minimumVersion }),
    ...(declared.maximumVersion === undefined
      ? {}
      : { maximumVersion: declared.maximumVersion }),
  });
}

function releaseVersion(release: GithubRelease, policy: AppReleasePolicy) {
  const pattern = new RegExp(
    `^v${policy.series.replace(".", "\\.")}\\.(\\d+)(?:-rc\\.(\\d+))?$`,
    "u",
  );
  const match = pattern.exec(release.tag_name);
  if (!match || release.draft || !release.published_at) return null;
  const patch = Number(match[1]);
  const rc = Number(match[2] ?? Infinity);
  if (!policy.allowPrerelease && rc !== Infinity) return null;
  if (
    policy.minimumVersion !== undefined &&
    patch < patchOf(policy.minimumVersion, policy.series, "minimumVersion")
  )
    return null;
  if (
    policy.maximumVersion !== undefined &&
    patch >= patchOf(policy.maximumVersion, policy.series, "maximumVersion")
  )
    return null;
  return { patch, rc };
}

/** Prefer published stable releases; RCs support snapshots before the first stable release. */
export function selectAppRelease(
  releases: GithubRelease[],
  policy: AppReleasePolicy = defaultAppReleasePolicy,
): GithubRelease {
  const eligible = releases.filter((release) => releaseVersion(release, policy));
  eligible.sort((a, b) => {
    const av = releaseVersion(a, policy)!;
    const bv = releaseVersion(b, policy)!;
    const stableOrder = Number(bv.rc === Infinity) - Number(av.rc === Infinity);
    return stableOrder || bv.patch - av.patch || bv.rc - av.rc;
  });
  assert(
    eligible[0],
    `No published DSL ${policy.series} release satisfies repo-policy.json dependencies.app.`,
  );
  return eligible[0];
}

/**
 * Seconds to wait before each retry of a transient failure. GitHub release downloads and the
 * API occasionally answer 502/503/504 for a moment (the 2026-11-09 scheduled run failed on one
 * 504 for the release SB3), so a short backoff rides it out; a persistent outage still fails.
 */
const retryDelaysMs = [2_000, 5_000, 10_000] as const;
const isTransientStatus = (status: number) => status === 429 || status >= 500;

export async function resolveAppRelease({
  fetchImplementation = fetch as FetchLike,
  token = process.env.GH_TOKEN,
  policy = defaultAppReleasePolicy,
  wait = (ms: number) =>
    new Promise<void>((resolve) => setTimeout(resolve, ms)),
}: {
  fetchImplementation?: FetchLike;
  token?: string;
  policy?: AppReleasePolicy;
  wait?: (ms: number) => Promise<void>;
} = {}): Promise<{ lock: AppRelease; bytes: Buffer }> {
  async function request(url: string) {
    const headers: Record<string, string> = url.startsWith(
      "https://api.github.com/",
    )
      ? {
          Accept: "application/vnd.github+json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        }
      : {};
    for (let attempt = 0; ; attempt += 1) {
      const retryDelay = retryDelaysMs[attempt];
      let response: Response;
      try {
        response = await fetchImplementation(url, {
          headers,
          signal: AbortSignal.timeout(60000),
        });
      } catch (error) {
        // Network errors and the 60 s timeout are transient by nature.
        if (retryDelay === undefined) throw error;
        console.warn(
          `App release input unavailable (${String(error)}); retrying: ${url}`,
        );
        await wait(retryDelay);
        continue;
      }
      if (
        !response.ok &&
        isTransientStatus(response.status) &&
        retryDelay !== undefined
      ) {
        console.warn(
          `App release input answered HTTP ${response.status}; retrying: ${url}`,
        );
        await response.body?.cancel();
        await wait(retryDelay);
        continue;
      }
      assert(
        response.ok,
        `Cannot read app release input: ${url} (HTTP ${response.status}).`,
      );
      return response;
    }
  }
  const releases: GithubRelease[] = [];
  for (let page = 1; ; page += 1) {
    assert(page <= 100, "Release pagination exceeded its limit.");
    const batch = (await (
      await request(`${api}/releases?per_page=100&page=${page}`)
    ).json()) as GithubRelease[];
    assert(Array.isArray(batch), "Release list must be an array.");
    releases.push(...batch);
    if (batch.length < 100) break;
  }
  const release = selectAppRelease(releases, policy);
  const version = release.tag_name.slice(1);
  const commit = (await (
    await request(`${api}/commits/${encodeURIComponent(release.tag_name)}`)
  ).json()) as { sha: string };
  assert.match(commit.sha, /^[a-f0-9]{40}$/u);
  const raw = `https://raw.githubusercontent.com/${repository}/${commit.sha}`;
  const metadata = (await (
    await request(`${raw}/release-metadata/${version}.json`)
  ).json()) as {
    version: string;
    sourceIdentity: string;
    artifact: AppRelease["artifact"];
    publication: { github: { tag: string } };
  };
  const packageJson = (await (await request(`${raw}/package.json`)).json()) as {
    version: string;
  };
  assert.equal(
    metadata.version,
    version,
    "Release metadata differs from its tag.",
  );
  assert.equal(
    packageJson.version,
    version,
    "Builder version differs from its release.",
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
  const asset = release.assets.find(({ name }) => name === artifact.filename);
  assert(
    asset,
    "The newest release has no Standard SB3; refusing to use an older release.",
  );
  assert.equal(
    asset.size,
    artifact.size,
    "Release asset size differs from metadata.",
  );
  if (asset.digest) assert.equal(asset.digest, `sha256:${artifact.sha256}`);
  const bytes = Buffer.from(await (await request(artifact.url)).arrayBuffer());
  assert.equal(
    bytes.length,
    artifact.size,
    "Downloaded base SB3 size differs.",
  );
  assert.equal(
    sha256(bytes),
    artifact.sha256,
    "Downloaded base SB3 hash differs.",
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
    "https://kubohiroya.github.io/turbowarp-kamishibai-samples/app-release.json",
    { signal: AbortSignal.timeout(60000), cache: "no-store" },
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
  policy?: AppReleasePolicy;
  wait?: (ms: number) => Promise<void>;
} = {}) {
  // The declared range is an input of the sync, read from the repository being synced. The pin it
  // writes is the output; keeping the two in separate files is why repo-policy.json holds the
  // range and app-release.json stays a generated snapshot.
  const policy = options.policy ?? (await readAppReleasePolicy(root));
  const { lock, bytes } = await resolveAppRelease({ ...options, policy });
  const files = new Map<string, string | Buffer>([
    [path.join(root, "app-release.json"), `${JSON.stringify(lock, null, 2)}\n`],
    [appBasePath(lock.version, root), bytes],
  ]);
  let changed = false;
  for (const [filename, contents] of files) {
    const next = Buffer.from(contents);
    const previous = await readFile(filename).catch(
      (error: NodeJS.ErrnoException) => {
        if (error.code === "ENOENT") return Buffer.alloc(0);
        throw error;
      },
    );
    if (!previous.equals(next)) {
      await mkdir(path.dirname(filename), { recursive: true });
      await writeFile(filename, next);
      changed = true;
    }
  }
  console.log(
    `App release ${lock.tag}: ${changed ? "updated" : "unchanged"} (${lock.commit}).`,
  );
  return { lock, changed };
}

/** Record a successful dependency check without implying a deployment succeeded. */
export function appReleaseCheckSummary(
  lock: AppRelease,
  {
    changed,
    comparedWithPublished,
    checkedAt,
  }: {
    changed: boolean;
    comparedWithPublished: boolean;
    checkedAt: string;
  },
) {
  const comparison = comparedWithPublished
    ? "公開済みmanifest"
    : "checkoutのsnapshot";
  return `## App公開版の確認

- 確認時刻: ${checkedAt}
- 検証済みRelease: ${lock.tag}
- source commit: \`${lock.commit}\`
- SB3 SHA-256: \`${lock.artifact.sha256}\`
- 比較先: ${comparison}
- 比較結果: ${changed ? "差分あり" : "差分なし"}

これは依存の取得・照合結果です。公開完了はdeploy jobと公開URLで確認してください。

`;
}

/**
 * Compare the committed pin with the newest release the declared range allows, writing nothing.
 *
 * The verify action used to reach this module through `syncAppRelease`, which rewrites
 * app-release.json and the base SB3 in the workspace. On a pull request it was skipped, so the
 * build used the committed pin; everywhere else — the Pages deploy, the scheduled run — the
 * workspace was moved to the newest published release before anything was built. That is version
 * following as a side effect of "no pull request number", and AGENTS.md asks for the opposite:
 * 「App公開版追従のためのcron／scheduleは使わない。main更新・承認済みの手動起動・明示的な
 * repository_dispatchで同期する」.
 *
 * It also broke the deploy. App 4.0.13 was published while the repository pinned 4.0.12, so the
 * deploy regenerated five works against 4.0.13 while tekona's lock still recorded 4.0.12, and the
 * freshness check stopped the publish twice. The same skew is why the site's bytes and the release
 * assets differed by ten bytes.
 *
 * So the deploy builds with the committed pin now, and this reports a newer release instead of
 * taking it. Following stays an explicit `pnpm update:app-release`, reviewed as a pull request.
 */
export async function checkAppReleaseDrift({
  root = projectRoot,
  ...options
}: {
  root?: string;
  fetchImplementation?: FetchLike;
  token?: string;
  policy?: AppReleasePolicy;
  wait?: (ms: number) => Promise<void>;
} = {}): Promise<{ committed: AppRelease; available: AppRelease; changed: boolean }> {
  const policy = options.policy ?? (await readAppReleasePolicy(root));
  const [committed, { lock: available }] = await Promise.all([
    readAppRelease(root),
    resolveAppRelease({ ...options, policy }),
  ]);
  return {
    committed,
    available,
    changed: available.commit !== committed.commit,
  };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const check = process.argv[2] === "--check";
  assert(
    process.argv.length === 2 || (process.argv.length === 3 && check),
    "Usage: node scripts/app-release.ts [--check]",
  );
  if (check) {
    const { committed, available, changed } = await checkAppReleaseDrift();
    console.log(
      changed
        ? `A newer app release is available: ${committed.tag} is pinned, ${available.tag} is published. Run pnpm update:app-release to follow it.`
        : `The pinned app release ${committed.tag} is the newest one the declared range allows.`,
    );
    if (process.env.GITHUB_STEP_SUMMARY)
      await appendFile(
        process.env.GITHUB_STEP_SUMMARY,
        appReleaseCheckSummary(committed, {
          changed,
          comparedWithPublished: false,
          checkedAt: new Date().toISOString(),
        }),
      );
    if (process.env.GITHUB_OUTPUT)
      await appendFile(process.env.GITHUB_OUTPUT, `changed=${changed}\n`);
    process.exit(0);
  }
  const { lock, changed } = await syncAppRelease();
  const comparedWithPublished =
    process.env.COMPARE_PUBLISHED_APP_RELEASE === "true";
  const publish = comparedWithPublished
    ? await publishedAppReleaseDiffers(lock)
    : changed;
  if (process.env.GITHUB_STEP_SUMMARY)
    await appendFile(
      process.env.GITHUB_STEP_SUMMARY,
      appReleaseCheckSummary(lock, {
        changed: publish,
        comparedWithPublished,
        checkedAt: new Date().toISOString(),
      }),
    );
  if (process.env.GITHUB_OUTPUT)
    await appendFile(process.env.GITHUB_OUTPUT, `changed=${publish}\n`);
}
