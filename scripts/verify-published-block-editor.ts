import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdir, mkdtemp, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {setTimeout as pause} from 'node:timers/promises';
import {pathToFileURL} from 'node:url';

const projectRoot = path.resolve(import.meta.dirname, '..');
const publishedPath = 'stories/urashima/urashima-blocks-4.0.sb3';
const digest = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

interface DownloadOptions {
  baseUrl: string;
  expectedInput: string;
  outputDirectory: string;
  attempts?: number;
  retryDelayMs?: number;
}

/** Wait for the deployed bytes, without substituting the local candidate for the public input. */
export async function downloadPublishedBlockProject(
  options: DownloadOptions,
  dependencies = {
    fetch,
    pause: (milliseconds: number) => pause(milliseconds),
  },
): Promise<string> {
  const expected = await readFile(options.expectedInput);
  const expectedSha256 = digest(expected);
  const base = options.baseUrl.endsWith('/') ? options.baseUrl : `${options.baseUrl}/`;
  const url = new URL(publishedPath, base);
  const attempts = options.attempts ?? 12;
  assert(Number.isInteger(attempts) && attempts > 0);
  await mkdir(options.outputDirectory, {recursive: true});
  const input = path.join(options.outputDirectory, 'urashima-blocks-4.0.sb3');
  const history: Record<string, unknown>[] = [];
  const report = {
    deploymentCommit: process.env.GITHUB_SHA ?? null,
    url: url.href,
    expectedInput: options.expectedInput,
    expectedSha256,
    expectedSize: expected.length,
    input,
    status: 'failed',
    attempts: history,
  };
  const verification = `${expectedSha256}-${Date.now()}`;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    // A unique query and no-cache headers avoid reusing a stale edge response between attempts.
    const requestUrl = new URL(url);
    requestUrl.searchParams.set('verification', `${verification}-${attempt}`);
    const entry: Record<string, unknown> = {
      attempt,
      requestUrl: requestUrl.href,
      fetchedAt: new Date().toISOString(),
    };
    let bytes: Buffer | undefined;
    try {
      const response = await dependencies.fetch(requestUrl.href, {
        cache: 'no-store',
        headers: {'cache-control': 'no-cache'},
        signal: AbortSignal.timeout(15_000),
      });
      entry.responseUrl = response.url;
      entry.httpStatus = response.status;
      if (response.status === 200) {
        bytes = Buffer.from(await response.arrayBuffer());
        entry.size = bytes.length;
        entry.sha256 = digest(bytes);
        entry.matchesDeployment =
          bytes.length === expected.length && entry.sha256 === expectedSha256;
        if (!entry.matchesDeployment)
          entry.error = 'Published bytes differ from this deployment.';
      } else {
        entry.error = `HTTP ${response.status}`;
        await response.body?.cancel();
      }
    } catch (error) {
      entry.error = String(error).slice(0, 1000);
    }
    history.push(entry);
    if (bytes && entry.matchesDeployment) {
      await writeFile(input, bytes);
      report.status = 'passed';
    }
    await writeFile(
      path.join(options.outputDirectory, 'download.json'),
      `${JSON.stringify(report, null, 2)}\n`,
    );
    if (report.status === 'passed') {
      console.log(
        `Published SB3 matches deployment: ${expectedSha256} (attempt ${attempt}).`,
      );
      return input;
    }
    console.log(`Published SB3 not ready (${attempt}/${attempts}): ${entry.error}`);
    if (attempt < attempts) await dependencies.pause(options.retryDelayMs ?? 10_000);
  }
  throw new Error(
    `Published SB3 did not match this deployment after ${attempts} attempts. Evidence: ${options.outputDirectory}`,
  );
}

async function main(): Promise<void> {
  const options = {
    baseUrl: '',
    expectedInput: path.join(projectRoot, 'dist', publishedPath),
    outputDirectory: path.join(projectRoot, '.tmp/published-block-editor'),
  };
  for (let i = 2; i < process.argv.length; i += 2) {
    const flag = process.argv[i];
    const value = process.argv[i + 1];
    assert(value, `${flag} requires a value.`);
    if (flag === '--base-url') options.baseUrl = value;
    else if (flag === '--expected-input') options.expectedInput = path.resolve(value);
    else if (flag === '--output-dir') options.outputDirectory = path.resolve(value);
    else throw new Error(`Unknown argument: ${flag}`);
  }
  assert(options.baseUrl, '--base-url is required; use the Pages deployment output URL.');
  await mkdir(options.outputDirectory, {recursive: true});
  options.outputDirectory = await mkdtemp(path.join(options.outputDirectory, 'run-'));
  const input = await downloadPublishedBlockProject(options);
  // The existing GUI regression must consume the downloaded file, never the local expected input.
  const result = spawnSync(
    process.execPath,
    [
      path.join(projectRoot, 'scripts/verify-dsl4-block-editor-browser.ts'),
      '--input',
      input,
      '--output-dir',
      options.outputDirectory,
    ],
    {stdio: 'inherit', timeout: 180_000},
  );
  if (result.error) throw result.error;
  assert.equal(
    result.status,
    0,
    `Published block editor regression failed: ${options.outputDirectory}`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
