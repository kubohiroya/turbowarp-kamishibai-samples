import {spawn} from 'node:child_process';
import process from 'node:process';
import {fileURLToPath} from 'node:url';

/**
 * Run `pnpm run check`: the type check and unit tests, then the site build.
 *
 * These two stages used to run together, because neither reads what the other writes and the
 * overlap cost the build alone instead of the sum. They were separated after a run reached 11.9 GB
 * of the runner's 15.7 GB within a minute and the kernel took the process.
 *
 * That measurement no longer supports the conclusion it was used for: the same run was also
 * building a failure message out of two 10.8 MB buffers, which costs about 375 MB per megabyte
 * compared and accounted for gigabytes on its own. It compares by digest now (see
 * scripts/same-bytes.ts), and the stages' own cost, measured with passing tests, is 7.2 GB
 * together against 5.6 GB in order — both of which fit.
 *
 * They stay in order anyway: it costs about two minutes of wall time, and running them together
 * buys that back only while nothing else on the runner grows. Running them together again is a
 * reasonable thing to try, with the peak measured on the runner rather than here.
 *
 * Both stages stream as they go. The unit stage used to be buffered so that its output could not
 * interleave with the build's, which no longer applies now that they do not overlap, and a
 * buffered stage loses everything it printed when the kernel takes it — which is how the runs that
 * exhaust the runner end. Both stages run even when the first one fails, so one run still reports
 * both stages' failures.
 *
 * The browser checks, the site verification and the repository policy check need dist/ and stay
 * after the build, in that order.
 *
 * The SB3 files are not committed (see scripts/sb3-assets.ts), so missing ones are downloaded
 * first. Files regenerated before the check differ from the record and are kept as they are.
 *
 * Before any of that, the records of those files are compared with each other. A story lock and
 * sb3-assets.json both carry the size and SHA-256 of every built SB3, and when they disagree every
 * later stage is comparing the wrong bytes. That reads two JSON files, so it goes first and the
 * run stops in under a second instead of inside a multi-megabyte comparison.
 */
const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';

interface StageResult {
  readonly name: string;
  readonly code: number;
  readonly output: string;
  readonly ms: number;
}

function run(args: readonly string[], buffered: boolean): Promise<{code: number; output: string}> {
  return new Promise((resolve, reject) => {
    const child = spawn(pnpm, args, {
      cwd: projectRoot,
      stdio: buffered ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    });
    const chunks: Buffer[] = [];
    child.stdout?.on('data', (chunk: Buffer) => chunks.push(chunk));
    child.stderr?.on('data', (chunk: Buffer) => chunks.push(chunk));
    child.once('error', reject);
    child.once('close', (code, signal) => {
      resolve({code: signal ? 1 : (code ?? 1), output: Buffer.concat(chunks).toString('utf8')});
    });
  });
}

/** Run scripts in order, stopping at the first failure, as `a && b` would. */
async function stage(name: string, scripts: readonly string[], buffered: boolean): Promise<StageResult> {
  const startedAt = Date.now();
  let output = '';
  for (const script of scripts) {
    if (buffered) output += `$ pnpm run ${script}\n`;
    const result = await run(['run', script], buffered);
    output += result.output;
    if (result.code !== 0) return {name, code: result.code, output, ms: Date.now() - startedAt};
  }
  return {name, code: 0, output, ms: Date.now() - startedAt};
}

function report(result: StageResult): void {
  const seconds = (result.ms / 1000).toFixed(1);
  process.stdout.write(`\n--- ${result.name} (${seconds}s, exit ${result.code})\n`);
  if (result.output) process.stdout.write(result.output.endsWith('\n') ? result.output : `${result.output}\n`);
}

const records = await stage('artifact records', ['verify:artifact-records'], false);
if (records.code !== 0) {
  report(records);
  process.exit(records.code);
}

const fetched = await stage('sb3:fetch', ['sb3:fetch'], false);
if (fetched.code !== 0) {
  report(fetched);
  process.exit(fetched.code);
}

// In order, not together: see the memory note above.
const unit = await stage('typecheck + test', ['typecheck', 'test'], false);
report(unit);
const build = await stage('build', ['build'], false);
report(build);

const failed = [unit, build].filter((result) => result.code !== 0);
if (failed.length > 0) {
  process.stdout.write(`\nCheck failed in: ${failed.map(({name}) => name).join(', ')}\n`);
  process.exit(1);
}

const rest = await stage('browser checks, verify, repo:check', ['test:web', 'verify', 'repo:check'], false);
report(rest);
process.exitCode = rest.code;
