import {spawn} from 'node:child_process';
import process from 'node:process';
import {fileURLToPath} from 'node:url';

/**
 * Run `pnpm run check`, with the type check and unit tests alongside the site build.
 *
 * The site build only writes dist/, and the unit tests only write their own temporary
 * directories, so neither reads what the other writes. Chained with `&&` on a GitHub-hosted
 * runner the unit stage (tsc + Vitest) costs 1.5-2 min and the build 2.5-3.5 min one after the
 * other. Run together they cost the build alone.
 *
 * The build streams its output as it goes, because it is the long stage. The unit stage is
 * buffered and printed when it finishes, so the two cannot interleave. Both run to completion
 * before a failure stops the check, so one run reports both stages' failures.
 *
 * The browser checks, the site verification and the repository policy check need dist/ and stay
 * after the build, in that order.
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

const [unit, build] = await Promise.all([
  stage('typecheck + test', ['typecheck', 'test'], true),
  stage('build', ['build'], false),
]);
report(unit);
report(build);

const failed = [unit, build].filter((result) => result.code !== 0);
if (failed.length > 0) {
  process.stdout.write(`\nCheck failed in: ${failed.map(({name}) => name).join(', ')}\n`);
  process.exit(1);
}

const rest = await stage('browser checks, verify, repo:check', ['test:web', 'verify', 'repo:check'], false);
report(rest);
process.exitCode = rest.code;
