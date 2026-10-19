import assert from 'node:assert/strict';
import {mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {afterEach, test} from 'vitest';
import {parse} from 'yaml';

import {downloadPublishedBlockProject} from '../scripts/verify-published-block-editor.ts';

const directories: string[] = [];
afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((directory) => rm(directory, {recursive: true})),
  );
});

async function fixture() {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'published-block-editor-'));
  directories.push(directory);
  const expectedInput = path.join(directory, 'expected.sb3');
  await writeFile(expectedInput, 'new project');
  return {
    baseUrl: 'https://example.test/samples/',
    expectedInput,
    outputDirectory: path.join(directory, 'evidence'),
    attempts: 3,
    retryDelayMs: 10,
  };
}

test('waits for the deployed bytes and returns the fresh public download', async () => {
  const options = await fixture();
  const urls: string[] = [];
  const delays: number[] = [];
  const input = await downloadPublishedBlockProject(options, {
    fetch: async (url, init) => {
      urls.push(String(url));
      assert.equal(init?.cache, 'no-store');
      return new Response(urls.length === 1 ? 'old project' : 'new project');
    },
    pause: async (ms) => {
      delays.push(ms);
    },
  });
  assert.notEqual(input, options.expectedInput);
  assert.equal(await readFile(input, 'utf8'), 'new project');
  assert.deepEqual(delays, [10]);
  assert.notEqual(urls[0], urls[1]);
  assert.equal(
    new URL(urls[0]!).pathname,
    '/samples/stories/urashima/urashima-blocks-4.0.sb3',
  );
  const report = JSON.parse(
    await readFile(path.join(options.outputDirectory, 'download.json'), 'utf8'),
  );
  assert.equal(report.status, 'passed');
  assert.deepEqual(
    report.attempts.map((attempt: any) => attempt.matchesDeployment),
    [false, true],
  );
});

test('retries transient HTTP and network failures before the public file becomes available', async () => {
  const options = await fixture();
  let calls = 0;
  await downloadPublishedBlockProject(options, {
    fetch: async () => {
      calls++;
      if (calls === 1) return new Response('not yet', {status: 404});
      if (calls === 2) throw new Error('temporary connection failure');
      return new Response('new project');
    },
    pause: async () => {},
  });
  assert.equal(calls, 3);
});

test('fails with evidence instead of falling back to the local candidate on a stale public file', async () => {
  const options = await fixture();
  await assert.rejects(
    downloadPublishedBlockProject(options, {
      fetch: async () => new Response('old project'),
      pause: async () => {},
    }),
    /did not match this deployment after 3 attempts/u,
  );
  const report = JSON.parse(
    await readFile(path.join(options.outputDirectory, 'download.json'), 'utf8'),
  );
  assert.equal(report.status, 'failed');
  assert.equal(report.attempts.length, 3);
  await assert.rejects(readFile(report.input), {code: 'ENOENT'});
});

test('runs the published GUI check after deployment and preserves its evidence on failure', async () => {
  const workflow = parse(await readFile('.github/workflows/deploy.yml', 'utf8'));
  const steps = workflow.jobs['build-and-deploy'].steps;
  const deployment = steps.findIndex((step: any) => step.id === 'deployment');
  const verification = steps.findIndex((step: any) =>
    step.run?.includes('verify-published-block-editor.ts'),
  );
  assert(deployment >= 0 && verification > deployment);
  assert.equal(
    steps[verification].env.PAGES_URL,
    '${{ steps.deployment.outputs.page_url }}',
  );
  assert.equal(steps[verification].if, undefined);
  const artifact = steps.findIndex(
    (step: any) => step.with?.name === 'published-block-editor-regression',
  );
  assert(artifact > verification);
  assert.equal(steps[artifact].if, 'always()');
  const diagnostics = steps.findIndex((step: any) =>
    step.run?.includes('verify-published-block-diagnostics.ts'),
  );
  assert(diagnostics > deployment && diagnostics < artifact);
  assert.equal(steps[diagnostics].env.PAGES_URL, '${{ steps.deployment.outputs.page_url }}');
  assert.equal(steps[diagnostics].if, undefined);
  const paths = steps[artifact].with.path.trim().split('\n');
  assert(paths.includes('.tmp/published-block-editor/'));
  assert(paths.includes('.tmp/published-block-diagnostics/'));
});
