import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import path from 'node:path';

export interface BlockAuthoringIdentity {
  repository: string;
  commit: string;
}

/** Keep editable-source generation independent of the published playback runtime pin. */
export async function resolveBlockAuthoringBuilder(rootOverride?: string) {
  const projectRoot = path.resolve(import.meta.dirname, '..');
  const config = JSON.parse(
    await readFile(path.join(projectRoot, 'stories/urashima/dsl4-build.config.json'), 'utf8'),
  ) as {blockAuthoring: BlockAuthoringIdentity};
  const identity = config.blockAuthoring;
  assert.match(identity.commit, /^[0-9a-f]{40}$/u);
  const root = path.resolve(
    rootOverride ??
      process.env.TURBOWARP_KAMISHIBAI_BLOCK_AUTHORING_ROOT ??
      process.env.TURBOWARP_KAMISHIBAI_APP_ROOT ??
      path.join(projectRoot, '../turbowarp-kamishibai-app'),
  );
  const git = (args: string[]) => {
    const result = spawnSync('git', args, {cwd: root, encoding: 'utf8'});
    if (result.error) throw result.error;
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  };
  assert.equal(
    git(['rev-parse', 'HEAD']),
    identity.commit,
    'Block authoring CLI differs from its pin.',
  );
  assert.equal(git(['status', '--porcelain']), '', 'Block authoring CLI checkout must be clean.');
  return {
    root,
    cli: path.join(root, 'bin/turbowarp-kamishibai.mjs'),
    identity,
  };
}
