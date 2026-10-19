import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

import {strFromU8, unzipSync} from 'fflate';

import {assertBlockSourceRuntimeWrapper} from './build-dsl4-block-source.ts';

export interface BlockAuthoringIdentity {
  repository: string;
  commit: string;
  sourceSections?: boolean;
  refreshRuntime?: boolean;
}

/** Replace only the verified base bundle, keeping the surrounding authoring wrapper. */
export function replaceBlockSourceRuntime(
  source: string,
  base: string,
  replacement: string,
): string {
  assertBlockSourceRuntimeWrapper(source);
  const index = source.indexOf(base);
  assert(base.length > 0 && index >= 0, 'BLOCK_SOURCE_RUNTIME_DRIFT: base bundle is missing.');
  assert.equal(
    source.indexOf(base, index + base.length),
    -1,
    'BLOCK_SOURCE_RUNTIME_DRIFT: base bundle occurs more than once.',
  );
  return source.slice(0, index) + replacement + source.slice(index + base.length);
}

/** Keep editable-source generation independent of the published playback runtime pin. */
export async function resolveBlockAuthoringBuilder(rootOverride?: string) {
  const projectRoot = path.resolve(import.meta.dirname, '..');
  const config = JSON.parse(
    await readFile(path.join(projectRoot, 'stories/urashima/dsl4-build.config.json'), 'utf8'),
  ) as {
    blockAuthoring: BlockAuthoringIdentity;
    runtime: {basePath: string; baseSize: number; baseSha256: string};
  };
  const identity = config.blockAuthoring;
  assert.match(identity.commit, /^[0-9a-f]{40}$/u);
  const sourceSections = identity.sourceSections ?? false;
  assert.equal(typeof sourceSections, 'boolean', 'sourceSections must be boolean.');
  const refreshRuntime = identity.refreshRuntime ?? false;
  assert.equal(typeof refreshRuntime, 'boolean', 'refreshRuntime must be boolean.');
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
  let pendingSources: Promise<{base: string; replacement: string}> | undefined;
  async function runtimeSources() {
    const bytes = await readFile(
      path.join(projectRoot, 'stories/urashima', config.runtime.basePath),
    );
    assert.equal(bytes.length, config.runtime.baseSize);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), config.runtime.baseSha256);
    const baseProject = JSON.parse(strFromU8(unzipSync(bytes)['project.json']!)) as {
      extensionURLs: Record<string, string>;
    };
    const url = baseProject.extensionURLs.kubohiroyakamishibai4!;
    assert(url.startsWith('data:text/javascript;base64,'));
    const module = (await import(
      pathToFileURL(path.join(root, 'scripts/sb3/dsl4-downloadable-release.ts')).href
    )) as {
      createDsl4RuntimeBundleSource(options: {profile: 'authoring'}): Promise<Uint8Array>;
    };
    return {
      base: Buffer.from(url.split(',')[1]!, 'base64').toString('utf8'),
      replacement: Buffer.from(
        await module.createDsl4RuntimeBundleSource({profile: 'authoring'}),
      ).toString('utf8'),
    };
  }
  return {
    root,
    cli: path.join(root, 'bin/turbowarp-kamishibai.mjs'),
    identity,
    authorOptions: ['--block-sections', String(sourceSections)],
    async refreshRuntime(sourceDirectory: string) {
      if (!refreshRuntime) return;
      const {base, replacement} = await (pendingSources ??= runtimeSources());
      const runtimePath = path.join(sourceDirectory, 'extensions/kubohiroyakamishibai4.js');
      const source = await readFile(runtimePath, 'utf8');
      await writeFile(runtimePath, replaceBlockSourceRuntime(source, base, replacement));
    },
  };
}
