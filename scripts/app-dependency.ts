import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

import type {AppRelease} from './app-release.ts';

export const projectRoot = fileURLToPath(new URL('../', import.meta.url));
export const appBaseRelativePath = 'stories/urashima/base/kamishibai-4.0.sb3';

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
    basePath: 'base/kamishibai-4.0.sb3',
    baseSourceIdentity: release.sourceIdentity,
    baseSize: release.artifact.size,
    baseSha256: release.artifact.sha256,
  };
}

export function appBasePath(root = projectRoot) {
  return path.join(root, appBaseRelativePath);
}
