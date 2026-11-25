import assert from 'node:assert/strict';
import {globSync} from 'node:fs';
import {readFile} from 'node:fs/promises';
import path from 'node:path';

import {projectRoot} from './app-dependency.ts';

/** The App release a work was built from, as its story lock records it. */
export interface ArtifactRuntime {
  repository: string;
  version: string;
  commit: string;
}

/** What a story lock says one built SB3 holds. */
export interface StoryArtifactRecord {
  path: string;
  size: number;
  sha256: string;
  runtime: ArtifactRuntime;
}

function readRuntime(lock: unknown, lockFile: string): ArtifactRuntime {
  const runtime = (lock as {runtime?: Partial<ArtifactRuntime>}).runtime;
  assert(runtime, `${lockFile} records no runtime.`);
  const {repository, version, commit} = runtime;
  assert(typeof repository === 'string' && repository, `${lockFile}: runtime.repository`);
  assert(typeof version === 'string' && version, `${lockFile}: runtime.version`);
  assert(typeof commit === 'string' && /^[a-f0-9]{40}$/u.test(commit), `${lockFile}: runtime.commit`);
  return {repository, version, commit};
}

/**
 * Every built SB3 the story locks record, by its path relative to the repository.
 *
 * One reader for both sides: `sb3:publish` writes each file's provenance from here, and
 * verify-artifact-records.ts checks the published record against the same source. A second
 * traversal would be a second answer to the same question.
 */
export async function readStoryArtifactRecords(
  root = projectRoot,
): Promise<Map<string, StoryArtifactRecord>> {
  const found = new Map<string, StoryArtifactRecord>();
  for (const lockFile of globSync('stories/*/dsl4-artifacts.lock.json', {cwd: root}).sort()) {
    const storyDirectory = path.dirname(lockFile).split(path.sep).join('/');
    const lock = JSON.parse(await readFile(path.join(root, lockFile), 'utf8')) as unknown;
    const runtime = readRuntime(lock, lockFile);
    const walk = (node: unknown) => {
      if (Array.isArray(node)) {
        for (const value of node) walk(value);
        return;
      }
      if (node === null || typeof node !== 'object') return;
      const record = node as {path?: unknown; size?: unknown; sha256?: unknown};
      if (
        typeof record.path === 'string' &&
        record.path.endsWith('.sb3') &&
        typeof record.sha256 === 'string' &&
        typeof record.size === 'number'
      ) {
        const file = `${storyDirectory}/${record.path}`;
        found.set(file, {path: file, size: record.size, sha256: record.sha256, runtime});
      }
      for (const value of Object.values(node)) walk(value);
    };
    walk(lock);
  }
  // No assertion that something was found: a caller publishing from a tree with no locks is not
  // doing anything wrong, while a verification that finds nothing is vacuous. That belongs to the
  // verification, which says so itself.
  return found;
}
