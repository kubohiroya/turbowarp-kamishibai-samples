import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdir, readdir, readFile, rename, rm, writeFile} from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import {fileURLToPath} from 'node:url';
import {promisify} from 'node:util';

import {appBaseRelativePath, projectRoot, readAppRelease} from './app-dependency.ts';
import {readStoryArtifactRecords} from './story-artifact-records.ts';

/**
 * The SB3 files under stories/ are not committed. Each one is a GitHub Release asset, and
 * sb3-assets.json records where it is and the size and SHA-256 it must have. The App's own base
 * (app-base/kamishibai-<version>.sb3) comes from the App release that app-release.json already
 * records, so it is not listed here: checkRelativePath refuses anything outside stories/, and
 * expectedSb3Assets adds the pinned release's base with the App's own download URL.
 *
 * - `pnpm sb3:fetch` downloads every listed file that is missing and verifies it. A file that is
 *   present but differs is left alone and reported, because it is usually one just regenerated;
 *   `--force` replaces it with the recorded one.
 * - `pnpm sb3:status` lists the local files that differ from the record or are not recorded.
 * - `pnpm sb3:publish` uploads those files as a new release and records them. A release is never
 *   changed afterwards: a new file always goes to a new release, so a recorded URL keeps its bytes.
 */

export const manifestFilename = 'sb3-assets.json';
export const repository = 'kubohiroya/turbowarp-kamishibai-samples';
const storiesDirectory = 'stories';

export interface Sb3Asset {
  path: string;
  size: number;
  sha256: string;
  url: string;
  /**
   * The App release that built these bytes, copied from the work's story lock.
   *
   * Without it a record says where to download a file and what its digest is, but not what
   * produced it, so the record and the lock could describe different generations of the same
   * work with nothing to compare. Absent for the files no DSL 4.0 lock records.
   */
  runtime?: {repository: string; version: string; commit: string};
}

export interface Sb3Manifest {
  formatVersion: 1;
  repository: string;
  files: Sb3Asset[];
}

export type FetchLike = (input: URL | string, init?: RequestInit) => Promise<Response>;
export type RunCommand = (command: string, args: readonly string[]) => Promise<string>;

function sha256(contents: Uint8Array): string {
  return createHash('sha256').update(contents).digest('hex');
}

function checkRelativePath(relativePath: string): void {
  assert.equal(typeof relativePath, 'string');
  assert(!relativePath.includes('\\'), `${relativePath}: use forward slashes.`);
  assert(!path.posix.isAbsolute(relativePath), `${relativePath}: must be relative.`);
  assert.equal(path.posix.normalize(relativePath), relativePath, `${relativePath}: must be normalized.`);
  assert(relativePath.startsWith(`${storiesDirectory}/`), `${relativePath}: must be under stories/.`);
  assert(relativePath.endsWith('.sb3'), `${relativePath}: must be an SB3.`);
}

export function releaseAssetUrl(tag: string, name: string): string {
  return `https://github.com/${repository}/releases/download/${tag}/${name}`;
}

export async function readSb3Manifest(root = projectRoot): Promise<Sb3Manifest> {
  const manifest = JSON.parse(await readFile(path.join(root, manifestFilename), 'utf8')) as Sb3Manifest;
  assert.equal(manifest.formatVersion, 1);
  assert.equal(manifest.repository, repository);
  assert(Array.isArray(manifest.files));
  const seen = new Set<string>();
  for (const file of manifest.files) {
    checkRelativePath(file.path);
    assert(!seen.has(file.path), `${file.path} is listed twice.`);
    seen.add(file.path);
    assert(Number.isSafeInteger(file.size) && file.size > 0, `${file.path}: size must be positive.`);
    assert.match(file.sha256, /^[a-f0-9]{64}$/u);
    assert.match(
      file.url,
      new RegExp(`^https://github\\.com/${repository}/releases/download/sb3-[0-9]{8}-[a-f0-9]{8}/[^/]+\\.sb3$`, 'u'),
      `${file.path}: must point at an sb3-* release of this repository.`,
    );
    if (file.runtime !== undefined) {
      assert(typeof file.runtime.repository === 'string', `${file.path}: runtime.repository`);
      assert(typeof file.runtime.version === 'string', `${file.path}: runtime.version`);
      assert.match(file.runtime.commit, /^[a-f0-9]{40}$/u, `${file.path}: runtime.commit`);
    }
  }
  return manifest;
}

export async function writeSb3Manifest(manifest: Sb3Manifest, root = projectRoot): Promise<void> {
  const files = [...manifest.files].sort((a, b) => a.path.localeCompare(b.path, 'en'));
  await writeAtomically(
    path.join(root, manifestFilename),
    Buffer.from(`${JSON.stringify({...manifest, files}, null, 2)}\n`),
  );
}

/** Every file the working tree needs: the recorded ones and the App's base. */
export async function expectedSb3Assets(root = projectRoot): Promise<Sb3Asset[]> {
  const manifest = await readSb3Manifest(root);
  const app = await readAppRelease(root);
  return [
    ...manifest.files,
    {
      path: appBaseRelativePath(app.version),
      size: app.artifact.size,
      sha256: app.artifact.sha256,
      url: app.artifact.url,
    },
  ];
}

async function readIfPresent(filename: string): Promise<Buffer | null> {
  try {
    return await readFile(filename);
  } catch (error) {
    if ((error as NodeJS.ErrnoException | null)?.code === 'ENOENT') return null;
    throw error;
  }
}

async function writeAtomically(filename: string, contents: Uint8Array): Promise<void> {
  await mkdir(path.dirname(filename), {recursive: true});
  const temporary = `${filename}.tmp-${process.pid}`;
  await writeFile(temporary, contents);
  await rename(temporary, filename);
}

const retryDelaysMs = [2000, 5000, 15000];
const isTransientStatus = (status: number) => status === 408 || status === 429 || status >= 500;

async function download(
  asset: Sb3Asset,
  fetchImplementation: FetchLike,
  wait: (ms: number) => Promise<void>,
): Promise<Buffer> {
  for (let attempt = 0; ; attempt += 1) {
    const retryDelay = retryDelaysMs[attempt];
    let response: Response;
    try {
      response = await fetchImplementation(asset.url, {signal: AbortSignal.timeout(120000)});
    } catch (error) {
      if (retryDelay === undefined) throw error;
      console.warn(`${asset.path}: download failed (${String(error)}); retrying.`);
      await wait(retryDelay);
      continue;
    }
    if (!response.ok && isTransientStatus(response.status) && retryDelay !== undefined) {
      console.warn(`${asset.path}: HTTP ${response.status}; retrying.`);
      await response.body?.cancel();
      await wait(retryDelay);
      continue;
    }
    assert(response.ok, `Cannot download ${asset.path} from ${asset.url} (HTTP ${response.status}).`);
    const bytes = Buffer.from(await response.arrayBuffer());
    assert.equal(bytes.length, asset.size, `${asset.path}: downloaded size differs from ${manifestFilename}.`);
    assert.equal(sha256(bytes), asset.sha256, `${asset.path}: downloaded SHA-256 differs from ${manifestFilename}.`);
    return bytes;
  }
}

export interface FetchResult {
  downloaded: string[];
  present: string[];
  /** Present but different from the record: left alone unless forced. */
  differing: string[];
}

export async function fetchSb3Assets({
  root = projectRoot,
  force = false,
  fetchImplementation = fetch,
  wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  concurrency = 4,
}: {
  root?: string;
  force?: boolean;
  fetchImplementation?: FetchLike;
  wait?: (ms: number) => Promise<void>;
  concurrency?: number;
} = {}): Promise<FetchResult> {
  const result: FetchResult = {downloaded: [], present: [], differing: []};
  const queue = await expectedSb3Assets(root);
  const worker = async () => {
    for (let asset = queue.shift(); asset; asset = queue.shift()) {
      const filename = path.join(root, asset.path);
      const local = await readIfPresent(filename);
      if (local && local.length === asset.size && sha256(local) === asset.sha256) {
        result.present.push(asset.path);
        continue;
      }
      if (local && !force) {
        result.differing.push(asset.path);
        continue;
      }
      await writeAtomically(filename, await download(asset, fetchImplementation, wait));
      result.downloaded.push(asset.path);
    }
  };
  await Promise.all(Array.from({length: concurrency}, worker));
  for (const list of Object.values(result)) list.sort();
  return result;
}

async function findLocalSb3(root: string): Promise<string[]> {
  const entries = await readdir(path.join(root, storiesDirectory), {recursive: true, withFileTypes: true});
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.sb3'))
    .map((entry) => path.relative(root, path.join(entry.parentPath, entry.name)).split(path.sep).join('/'))
    .sort();
}

export interface LocalChange {
  path: string;
  size: number;
  sha256: string;
  status: 'changed' | 'new';
}

export interface Sb3Status {
  changes: LocalChange[];
  /** Recorded but absent locally: fetch them, or drop the entry if the work was removed. */
  missing: string[];
}

export async function sb3Status(root = projectRoot): Promise<Sb3Status> {
  const manifest = await readSb3Manifest(root);
  const recorded = new Map(manifest.files.map((file) => [file.path, file]));
  const changes: LocalChange[] = [];
  for (const relative of await findLocalSb3(root)) {
    const bytes = await readFile(path.join(root, relative));
    const digest = sha256(bytes);
    const record = recorded.get(relative);
    if (record && record.size === bytes.length && record.sha256 === digest) continue;
    changes.push({path: relative, size: bytes.length, sha256: digest, status: record ? 'changed' : 'new'});
  }
  const local = new Set(await findLocalSb3(root));
  const missing = manifest.files.map((file) => file.path).filter((file) => !local.has(file));
  return {changes, missing};
}

/** Name a release after its day and contents, so the same upload never gets two names. */
export function releaseTag(changes: readonly Pick<LocalChange, 'path' | 'sha256'>[], date: Date): string {
  const day = date.toISOString().slice(0, 10).replaceAll('-', '');
  const digest = createHash('sha256')
    .update(changes.map((change) => `${change.path}\0${change.sha256}\n`).join(''))
    .digest('hex');
  return `sb3-${day}-${digest.slice(0, 8)}`;
}

const execFileAsync = promisify(execFile);
const runCommand: RunCommand = async (command, args) =>
  (await execFileAsync(command, [...args], {cwd: projectRoot, maxBuffer: 16 * 1024 * 1024})).stdout;

/**
 * Upload every changed or new local SB3 as one new release and record it. The release targets
 * the commit given (default: origin/main), which only names where the tag sits; the files are
 * whatever is on disk now, verified again against the release after the upload.
 */
export async function publishSb3Assets({
  root = projectRoot,
  run = runCommand,
  date = new Date(),
  target,
}: {
  root?: string;
  run?: RunCommand;
  date?: Date;
  target?: string;
} = {}): Promise<{tag: string; files: Sb3Asset[]} | null> {
  const status = await sb3Status(root);
  assert.equal(
    status.missing.length,
    0,
    `Recorded SB3 files are missing locally: ${status.missing.join(', ')}. Run pnpm sb3:fetch, or remove their entries if the works were removed.`,
  );
  if (status.changes.length === 0) return null;
  const names = new Map<string, string>();
  for (const change of status.changes) {
    const name = path.posix.basename(change.path);
    assert(!names.has(name), `${change.path} and ${names.get(name)} share the asset name ${name}.`);
    names.set(name, change.path);
  }
  const tag = releaseTag(status.changes, date);
  const commit = target ?? (await run('git', ['rev-parse', 'origin/main'])).trim();
  assert.match(commit, /^[a-f0-9]{40}$/u);
  const notes = [
    'SB3 files for turbowarp-kamishibai-samples, recorded in sb3-assets.json.',
    'The works are published at https://kubohiroya.github.io/turbowarp-kamishibai-samples/ ; use those URLs to download or open them.',
    '',
    ...status.changes.map((change) => `- \`${change.path}\` (${change.size} bytes, sha256 ${change.sha256})`),
  ].join('\n');
  await run('gh', [
    'release', 'create', tag,
    '--repo', repository,
    '--target', commit,
    '--title', tag,
    '--notes', notes,
    '--latest=false',
    ...status.changes.map((change) => path.join(root, change.path)),
  ]);
  const published = JSON.parse(
    await run('gh', ['release', 'view', tag, '--repo', repository, '--json', 'assets']),
  ) as {assets: {name: string; size: number; digest?: string}[]};
  // The provenance comes from the same reader the verification uses, so a published record and
  // the lock cannot disagree about which release built the file.
  const locked = await readStoryArtifactRecords(root);
  const files = status.changes.map((change): Sb3Asset => {
    const name = path.posix.basename(change.path);
    const asset = published.assets.find((candidate) => candidate.name === name);
    assert(asset, `${tag} has no asset ${name}.`);
    assert.equal(asset.size, change.size, `${tag}/${name}: uploaded size differs.`);
    if (asset.digest) assert.equal(asset.digest, `sha256:${change.sha256}`, `${tag}/${name}: uploaded digest differs.`);
    const record = locked.get(change.path);
    return {
      path: change.path,
      size: change.size,
      sha256: change.sha256,
      url: releaseAssetUrl(tag, name),
      ...(record ? {runtime: record.runtime} : {}),
    };
  });
  const manifest = await readSb3Manifest(root);
  const updated = new Map(files.map((file) => [file.path, file]));
  await writeSb3Manifest(
    {
      ...manifest,
      files: [
        ...manifest.files.filter((file) => !updated.has(file.path)),
        ...files,
      ],
    },
    root,
  );
  return {tag, files};
}

/** Remove a recorded file that a work no longer has. */
export async function forgetSb3Asset(relativePath: string, root = projectRoot): Promise<void> {
  const manifest = await readSb3Manifest(root);
  assert(manifest.files.some((file) => file.path === relativePath), `${relativePath} is not recorded.`);
  await writeSb3Manifest({...manifest, files: manifest.files.filter((file) => file.path !== relativePath)}, root);
  await rm(path.join(root, relativePath), {force: true});
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [command = 'fetch', ...rest] = process.argv.slice(2);
  if (command === 'fetch') {
    const result = await fetchSb3Assets({force: rest.includes('--force')});
    console.log(
      `SB3: ${result.downloaded.length} downloaded, ${result.present.length} already present, ${result.differing.length} differ locally.`,
    );
    for (const file of result.differing) {
      console.log(`  differs (kept; pnpm sb3:fetch --force replaces it): ${file}`);
    }
  } else if (command === 'status') {
    const status = await sb3Status();
    for (const change of status.changes) console.log(`${change.status}: ${change.path}`);
    for (const file of status.missing) console.log(`missing: ${file}`);
    if (status.changes.length === 0 && status.missing.length === 0) console.log('SB3 files match sb3-assets.json.');
  } else if (command === 'publish') {
    const result = await publishSb3Assets();
    if (result) {
      console.log(`Published ${result.files.length} SB3 file(s) as ${result.tag}; commit ${manifestFilename}.`);
    } else {
      console.log('Nothing to publish: SB3 files match sb3-assets.json.');
    }
  } else if (command === 'forget') {
    assert(rest[0], 'Usage: sb3-assets.ts forget <stories/...sb3>');
    await forgetSb3Asset(rest[0]);
    console.log(`Removed ${rest[0]} from ${manifestFilename}.`);
  } else {
    throw new Error(`Unknown command: ${command} (fetch, status, publish, forget)`);
  }
}
