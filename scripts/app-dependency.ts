import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

import type {AppRelease} from './app-release.ts';

export const projectRoot = fileURLToPath(new URL('../', import.meta.url));
/** Where the base SB3 of every App release is kept, relative to the repository. */
export const appBaseDirectory = 'app-base';

/**
 * Where one App release's base SB3 is kept.
 *
 * It lived at stories/urashima/base/kamishibai-4.0.sb3: a constant, one file, inside one work's
 * directory. Every other work read it from there through appBasePath, so the `basePath` their
 * locks recorded — `base/kamishibai-4.0.sb3`, resolved against their own directory — named a file
 * that does not exist. build-site.ts copies a work's directory as it is, so the App's own base was
 * also published as if it were part of Urashima.
 *
 * The name is the release artifact's own (`kamishibai-<version>.sb3`), so nothing is renamed on the
 * way in and the filename carries the provenance. Two releases can sit here at once, which is what
 * a per-work pin would need.
 */
export function appBaseRelativePath(version: string): string {
  assert.match(
    version,
    /^\d+\.\d+\.\d+(?:-rc\.\d+)?$/u,
    `An App base needs a release version, not ${JSON.stringify(version)}.`,
  );
  return `${appBaseDirectory}/kamishibai-${version}.sb3`;
}

/** Read the sole app dependency snapshot without contacting the network. */
export async function readAppRelease(root = projectRoot): Promise<AppRelease> {
  const release = JSON.parse(
    await readFile(path.join(root, 'app-release.json'), 'utf8'),
  ) as AppRelease;
  assert.equal(release.formatVersion, 1);
  assert.equal(release.repository, 'kubohiroya/turbowarp-kamishibai-app');
  assert.match(release.version, /^4\.0\.\d+(?:-rc\.\d+)?$/u);
  assert.equal(release.tag, `v${release.version}`);
  assert.match(release.commit, /^[a-f0-9]{40}$/u);
  assert.match(release.sourceIdentity, /^sha256:[a-f0-9]{64}$/u);
  assert(
    Number.isSafeInteger(release.artifact.size) && release.artifact.size > 0,
  );
  assert.match(release.artifact.sha256, /^[a-f0-9]{64}$/u);
  assert.equal(release.artifact.filename, `kamishibai-${release.version}.sb3`);
  assert.equal(
    release.artifact.url,
    `https://github.com/${release.repository}/releases/download/${release.tag}/${release.artifact.filename}`,
  );
  return release;
}

/** This projection is recorded in output locks, never in story settings. */
export function appRuntimeIdentity(release: AppRelease) {
  return {
    repository: `https://github.com/${release.repository}`,
    version: release.version,
    commit: release.commit,
    basePath: appBaseRelativePath(release.version),
    baseSourceIdentity: release.sourceIdentity,
    baseSize: release.artifact.size,
    baseSha256: release.artifact.sha256,
  };
}

export function appBasePath(version: string, root = projectRoot) {
  return path.join(root, ...appBaseRelativePath(version).split('/'));
}
