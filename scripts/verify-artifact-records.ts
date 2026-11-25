import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

import {readStoryArtifactRecords} from './story-artifact-records.ts';

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
 */
const projectRoot = fileURLToPath(new URL('../', import.meta.url));

interface ByteRecord {
  path: string;
  size: number;
  sha256: string;
  runtime?: {repository: string; version: string; commit: string};
}

const assets = JSON.parse(
  await readFile(path.join(projectRoot, 'sb3-assets.json'), 'utf8'),
) as {files: ByteRecord[]};
const published = new Map(assets.files.map((file) => [file.path, file]));
const locked = await readStoryArtifactRecords(projectRoot);
assert(locked.size > 0, 'No SB3 files are recorded in stories/*/dsl4-artifacts.lock.json.');

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
      'story lock and by sb3-assets.json.\n\n' +
      `${mismatches.join('\n\n')}\n\n` +
      'If the locks hold the intended state, the rebuilt files were never published: run ' +
      'pnpm sb3:publish.\nIf the published files hold the intended state, the locks are ahead: ' +
      'run pnpm update:dsl4-artifacts and commit the locks.',
  );
}

const unlocked = [...published.keys()].filter((file) => !locked.has(file));
console.log(
  `Verified ${locked.size} built SB3 records, with the release that built each, against ` +
    `sb3-assets.json${unlocked.length > 0 ? `; ${unlocked.length} published file(s) are not built from a DSL 4.0 lock: ${unlocked.join(', ')}` : ''}.`,
);
