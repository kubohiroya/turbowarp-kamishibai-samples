import {spawn} from 'node:child_process';
import process from 'node:process';
import {fileURLToPath} from 'node:url';

/**
 * Run the browser checks at the same time.
 *
 * The checks are independent: each drives its own browser and reads artifacts nobody writes
 * during the run. The editor check opens TurboWarp; the player checks serve local fixtures.
 * Chained with `&&` they cost the sum of their runtimes -- the slowest two player checks are
 * 51s and 34s on an M1 Max -- while the machine sits
 * mostly idle waiting for a browser. Run together they cost the longest one.
 *
 * Output is buffered per check and printed when that check finishes, so two browsers logging at
 * once cannot interleave into something unreadable. Every check runs to completion even after one
 * fails: a run that reports only the first failure sends you back for a second full pass to find
 * the next.
 */
const checks = [
  {script: 'scripts/verify-packaged-web-browser.ts', line: 'dsl32'},
  {script: 'scripts/verify-packaged-web-webkit-audio.ts', line: 'dsl32'},
  {script: 'scripts/verify-dsl4-packaged-web-browser.ts', line: 'dsl4'},
  {script: 'scripts/verify-dsl4-block-editor-browser.ts', line: 'editor'},
  ...(process.env.KAMISHIBAI_BLOCK_DIAGNOSTICS === '1'
    ? [{
      script: 'scripts/verify-published-block-diagnostics.ts',
      line: 'editor',
      args: ['--input', 'dist/stories/urashima/urashima-blocks-4.0.sb3'],
    }]
    : []),
] as const;

/**
 * Local and published-release runs use the full scope. A PR selects its scope from the
 * changed files and runs its standalone editor diagnostics alongside the other browser checks.
 */
const scope = process.env.KAMISHIBAI_WEB_CHECKS ?? 'all';
if (scope !== 'all' && scope !== 'dsl4' && scope !== 'editor' && scope !== 'none') {
  throw new Error(`Unknown KAMISHIBAI_WEB_CHECKS scope: ${scope}`);
}
const selected = checks.filter(({line}) => scope === 'all' || scope === line ||
  (scope === 'dsl4' && line === 'editor'));

const projectRoot = fileURLToPath(new URL('../', import.meta.url));

interface CheckResult {
  readonly script: string;
  readonly code: number;
  readonly output: string;
  readonly ms: number;
}

function runCheck(script: string, args: readonly string[]): Promise<CheckResult> {
  const startedAt = Date.now();
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script, ...args], {
      cwd: projectRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const chunks: Buffer[] = [];
    child.stdout.on('data', (chunk: Buffer) => chunks.push(chunk));
    child.stderr.on('data', (chunk: Buffer) => chunks.push(chunk));
    child.once('error', reject);
    child.once('close', (code, signal) => {
      resolve({
        script,
        code: signal ? 1 : (code ?? 1),
        output: Buffer.concat(chunks).toString('utf8'),
        ms: Date.now() - startedAt,
      });
    });
  });
}

if (scope !== 'all') {
  const skipped = checks.filter((check) => !selected.includes(check)).map(({script}) => script);
  process.stdout.write(`Browser scope ${scope} skips: ${skipped.join(', ')}\n`);
}
const results = await Promise.all(selected.map((check) =>
  runCheck(check.script, 'args' in check ? check.args : [])));
for (const result of results) {
  const seconds = (result.ms / 1000).toFixed(1);
  process.stdout.write(`\n--- ${result.script} (${seconds}s, exit ${result.code})\n`);
  process.stdout.write(result.output.endsWith('\n') ? result.output : `${result.output}\n`);
}

const failed = results.filter((result) => result.code !== 0);
if (failed.length > 0) {
  process.stdout.write(`\n${failed.length} of ${selected.length} browser checks failed:\n`);
  for (const result of failed) process.stdout.write(`  ${result.script}\n`);
  process.exitCode = 1;
}
