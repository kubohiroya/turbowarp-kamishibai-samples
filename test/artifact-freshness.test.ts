import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {test} from 'vitest';

import {
  allowStaleArtifactsVariable,
  requireFresh,
  staleArtifactsAllowed,
} from '../scripts/artifact-freshness.ts';

const root = path.resolve(import.meta.dirname, '..');
const stale = (): void => {
  assert.fail('dsl4-artifacts.lock.json is stale; run pnpm update:urashima-dsl4.');
};

test('an ordinary build fails on a stale artifact', () => {
  for (const env of [
    {},
    {[allowStaleArtifactsVariable]: undefined},
    // Anything other than exactly '1' keeps the check on. A switch that weakens a gate should not
    // be satisfied by a typo.
    {[allowStaleArtifactsVariable]: ''},
    {[allowStaleArtifactsVariable]: '0'},
    {[allowStaleArtifactsVariable]: 'true'},
    {[allowStaleArtifactsVariable]: 'yes'},
    {[allowStaleArtifactsVariable]: ' 1'},
  ]) {
    assert.equal(staleArtifactsAllowed(env), false, JSON.stringify(env));
    const printed: string[] = [];
    assert.throws(() => requireFresh(stale, {env, write: (text) => printed.push(text)}), /is stale/u);
    assert.deepEqual(printed, [], 'A failing check must not also report.');
  }
});

test('the development switch reports the difference instead of failing', () => {
  const env = {[allowStaleArtifactsVariable]: '1'};
  assert.equal(staleArtifactsAllowed(env), true);
  const printed: string[] = [];
  requireFresh(stale, {env, write: (text) => printed.push(text)});
  assert.equal(printed.length, 1);
  assert.match(printed[0]!, /KAMISHIBAI_ALLOW_STALE_ARTIFACTS=1/u);
  assert.match(printed[0]!, /is stale; run pnpm update:urashima-dsl4\./u);
});

test('a fresh artifact neither fails nor reports, switch or no switch', () => {
  for (const env of [{}, {[allowStaleArtifactsVariable]: '1'}]) {
    const printed: string[] = [];
    requireFresh(() => assert.equal(1, 1), {env, write: (text) => printed.push(text)});
    assert.deepEqual(printed, []);
  }
});

test('the asynchronous form follows the same policy', async () => {
  const comparison = async (): Promise<void> => {
    await Promise.resolve();
    stale();
  };
  await assert.rejects(requireFresh(comparison, {env: {}}), /is stale/u);
  const printed: string[] = [];
  await requireFresh(comparison, {
    env: {[allowStaleArtifactsVariable]: '1'},
    write: (text) => printed.push(text),
  });
  assert.equal(printed.length, 1);
  assert.match(printed[0]!, /is stale/u);
});

test('a reported difference is capped so it stays readable', () => {
  const printed: string[] = [];
  requireFresh(
    (): void => {
      assert.fail('x'.repeat(10_000));
    },
    {env: {[allowStaleArtifactsVariable]: '1'}, write: (text) => printed.push(text)},
  );
  assert.equal(printed.length, 1);
  assert(printed[0]!.length < 5_000, `reported ${printed[0]!.length} characters`);
  assert.match(printed[0]!, /more characters$/mu);
});

test('no workflow sets the switch, so it cannot reach CI or the deploy', async () => {
  for (const file of [
    '.github/actions/verify/action.yml',
    '.github/workflows/ci.yml',
    '.github/workflows/deploy.yml',
    '.github/workflows/scheduled-verify.yml',
  ]) {
    const contents = await readFile(path.join(root, file), 'utf8');
    assert(
      !contents.includes(allowStaleArtifactsVariable),
      `${file} must not set ${allowStaleArtifactsVariable}: the freshness check is on for every ordinary build.`,
    );
  }
});

test('every stale assertion goes through the one policy', async () => {
  // The switch is only as good as its coverage: one comparison left outside it still stops a
  // developer with a hard failure, and the switch would look broken rather than scoped.
  const {globSync} = await import('node:fs');
  const offenders: string[] = [];
  for (const file of globSync('scripts/*.ts', {cwd: root}).sort()) {
    if (file.endsWith('artifact-freshness.ts')) continue;
    const lines = (await readFile(path.join(root, file), 'utf8')).split('\n');
    lines.forEach((line, index) => {
      if (!/(?:is|are) stale|differ from lock/u.test(line)) return;
      if (line.trimStart().startsWith('//') || line.trimStart().startsWith('*')) return;
      const window = lines.slice(Math.max(0, index - 8), index + 1).join('\n');
      if (!window.includes('requireFresh')) offenders.push(`${file}:${index + 1}`);
    });
  }
  assert.deepEqual(offenders, [], `staleness asserted outside requireFresh: ${offenders.join(', ')}`);
});
