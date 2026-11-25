import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {promisify} from 'node:util';

import {
  collectStoryArtifactRecords,
  isStoryArtifactLockPath,
  readStoryArtifactRecords,
  type StoryArtifactRecord,
} from './story-artifact-records.ts';

/**
 * Check the two records of every built SB3 against each other.
 *
 * `stories/<name>/dsl4-artifacts.lock.json` records what the pinned App builds. `sb3-assets.json`
 * records the bytes `pnpm sb3:fetch` downloads. Both carry the size and SHA-256 of the same files,
 * and nothing compared them.
 *
 * Following App 4.0.5 to 4.0.12 updated the locks and rebuilt the SB3 files but never published
 * them, so for all 17 files the two records disagreed. The first thing to notice was a 10.8 MB
 * buffer comparison inside a test, whose failure message cost about 375 MB of memory per megabyte
 * compared and took the CI runner's 15.7 GB before it could be printed; GitHub recorded that as a
 * cancelled job and discarded the log, five times over.
 *
 * Two JSON files decide the same thing in well under a second, which is why this runs before
 * anything downloads or builds.
 *
 * The published record also names the release that built each file. A digest says two records
 * describe the same bytes; it does not say which generation of the App produced them, and reading
 * that back out of the bytes means parsing a comment inside a 3.3 MB bundle. So the record carries
 * it as a field and this compares that too.
 *
 * Both records are read out of HEAD, not the working tree. What they have to agree about is a
 * property of a commit: the locks a commit carries and the sb3-assets.json it carries must describe
 * the same bytes. The deploy workflow runs `pnpm update:dsl4-artifacts` before `pnpm run check`
 * (see .github/actions/verify), which rewrites every lock in the workspace and publishes nothing,
 * so a working-tree comparison there is between a fresh build and the last release and cannot
 * hold. It failed every deploy from the commit that introduced this check until this one, and the
 * site stopped being published while the repository itself was consistent.
 *
 * So an uncommitted lock is outside what this decides. `pnpm sb3:status` lists the built files that
 * differ from the published ones, which is the question before a commit; this one is asked of the
 * commit, where CI asks it too.
 */
const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const run = promisify(execFile);

/** Read one repository-relative path out of HEAD, or undefined when the commit has no such file. */
async function readFromHead(file: string): Promise<string | undefined> {
  try {
    const {stdout} = await run('git', ['show', `HEAD:${file}`], {
      cwd: projectRoot,
      maxBuffer: 64 * 1024 * 1024,
    });
    return stdout;
  } catch {
    return undefined;
  }
}

/** The story locks HEAD carries. */
async function listHeadLockFiles(): Promise<string[]> {
  const {stdout} = await run('git', ['ls-tree', '-r', '--name-only', 'HEAD'], {
    cwd: projectRoot,
    maxBuffer: 64 * 1024 * 1024,
  });
  return stdout.split('\n').filter(isStoryArtifactLockPath).sort();
}

/**
 * Both records as the commit carries them, or as the working tree holds them when there is no
 * commit to read — a tarball export or a checkout with no history still gets a check, and says so.
 */
async function readRecords(): Promise<{
  source: string;
  assets: {files: ByteRecord[]};
  locked: Map<string, StoryArtifactRecord>;
}> {
  const headAssets = await readFromHead('sb3-assets.json');
  if (headAssets === undefined) {
    return {
      source: 'the working tree (HEAD has no sb3-assets.json)',
      assets: JSON.parse(await readFile(path.join(projectRoot, 'sb3-assets.json'), 'utf8')),
      locked: await readStoryArtifactRecords(projectRoot),
    };
  }
  const locked = new Map<string, StoryArtifactRecord>();
  for (const lockFile of await listHeadLockFiles()) {
    const contents = await readFromHead(lockFile);
    assert(contents !== undefined, `${lockFile} is listed in HEAD but could not be read.`);
    collectStoryArtifactRecords(lockFile, JSON.parse(contents) as unknown, locked);
  }
  return {source: 'HEAD', assets: JSON.parse(headAssets) as {files: ByteRecord[]}, locked};
}

interface ByteRecord {
  path: string;
  size: number;
  sha256: string;
  runtime?: {repository: string; version: string; commit: string};
}

const {source, assets, locked} = await readRecords();
const published = new Map(assets.files.map((file) => [file.path, file]));
assert(locked.size > 0, `No SB3 files are recorded in stories/*/dsl4-artifacts.lock.json in ${source}.`);

const mismatches: string[] = [];
for (const [file, record] of locked) {
  const asset = published.get(file);
  if (asset === undefined) {
    mismatches.push(
      `${file}\n  the lock records it, sb3-assets.json does not.` +
        '\n  Publish the built file: pnpm sb3:publish',
    );
    continue;
  }
  if (asset.size !== record.size || asset.sha256 !== record.sha256) {
    mismatches.push(
      `${file}\n  lock:            ${record.size} bytes, sha256 ${record.sha256}` +
        `\n  sb3-assets.json: ${asset.size} bytes, sha256 ${asset.sha256}`,
    );
    continue;
  }
  if (asset.runtime === undefined) {
    mismatches.push(
      `${file}\n  sb3-assets.json records no runtime, so nothing says which release built it.` +
        `\n  The lock says ${record.runtime.version} (${record.runtime.commit}).`,
    );
    continue;
  }
  const same =
    asset.runtime.repository === record.runtime.repository &&
    asset.runtime.version === record.runtime.version &&
    asset.runtime.commit === record.runtime.commit;
  if (!same) {
    mismatches.push(
      `${file}\n  lock runtime:            ${record.runtime.version} (${record.runtime.commit})` +
        `\n  sb3-assets.json runtime: ${asset.runtime.version} (${asset.runtime.commit})`,
    );
  }
}

if (mismatches.length > 0) {
  // Which side is stale cannot be decided from these two files alone, and reading the SB3 files
  // would not settle it either, since they are whatever the last local build or fetch left there.
  assert.fail(
    `${mismatches.length} of ${locked.size} built SB3 files are recorded differently by their ` +
      `story lock and by sb3-assets.json in ${source}.\n\n` +
      `${mismatches.join('\n\n')}\n\n` +
      'If the locks hold the intended state, the rebuilt files were never published: run ' +
      'pnpm sb3:publish and commit sb3-assets.json.\nIf the published files hold the intended ' +
      'state, the locks are ahead: run pnpm update:dsl4-artifacts and commit the locks.',
  );
}

const unlocked = [...published.keys()].filter((file) => !locked.has(file));
console.log(
  `Verified ${locked.size} built SB3 records in ${source}, with the release that built each, ` +
    `against sb3-assets.json${unlocked.length > 0 ? `; ${unlocked.length} published file(s) are not built from a DSL 4.0 lock: ${unlocked.join(', ')}` : ''}.`,
);
