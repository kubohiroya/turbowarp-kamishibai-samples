import process from 'node:process';

/**
 * The one place that decides what a stale artifact means.
 *
 * Every story builder takes a `writeLock` flag: with it they write the artifacts and the lock,
 * without it they rebuild and compare, failing with "… is stale; run pnpm update:…". That
 * comparison is what keeps a committed artifact and its lock describing the same bytes, and it is
 * on for every ordinary build — `pnpm run check`, `pnpm run build`, `pnpm verify:*`, the pull
 * request CI, the Pages deploy and `sb3:publish`.
 *
 * It is also the gate that stops a developer from getting anywhere with an App the repository has
 * not followed yet. Build against a newer release or a local build of the App and all six stories
 * fail here, so `pnpm run check` stops inside `build` before it reaches the browser checks or the
 * site generation, and the effect of an App change on the works cannot be seen. That happened for
 * real: App 4.0.13 was published, `update:dsl4-artifacts` did not cover tekona, and the Pages
 * deploy failed twice on "Tekona workshop artifacts are stale" with no way to look past it.
 *
 * So the comparison can be turned into a report, for development only, by setting
 *
 *     KAMISHIBAI_ALLOW_STALE_ARTIFACTS=1
 *
 * An environment variable rather than a setting in a file, for one reason: it cannot be committed.
 * A flag in `sample.config.json` or `repo-policy.json` would disable the gate permanently and
 * invisibly, and would reach CI with the rest of the repository. This cannot: the workflows do not
 * set it (test/artifact-freshness.test.ts checks that they do not), so it only ever applies to the
 * shell that typed it.
 *
 * Only the freshness comparison is affected. The integrity verification — the base SB3's bytes
 * against `runtime.baseSha256` in each builder — is a different check answering a different
 * question (is the input the published artifact?) and stays on. AGENTS.md requires it:
 * 「公開済みの版付き成果物を使用し、取得元・対応版・ハッシュを確認する」.
 *
 * Nothing is skipped silently. An allowed difference is still printed, with whatever the assertion
 * had to say about it, so the drift stays visible in the log.
 */
export const allowStaleArtifactsVariable = 'KAMISHIBAI_ALLOW_STALE_ARTIFACTS';

/** Whether this process may report a stale artifact instead of failing. */
export function staleArtifactsAllowed(
  env: Record<string, string | undefined> = process.env,
): boolean {
  // Exactly '1'. An unset, empty or misspelled value keeps the check on, which is the safe
  // direction for a switch whose whole purpose is to weaken a gate.
  return env[allowStaleArtifactsVariable] === '1';
}

/**
 * The printed form of an allowed difference.
 *
 * The assertion's own message carries the detail, and for a lock comparison that is a diff of two
 * JSON documents. It is capped because this runs in place of a failure: a report nobody can read
 * is no better than silence, and this repository has already lost CI logs to one oversized
 * comparison message (see scripts/same-bytes.ts).
 */
function reportAllowedStaleness(error: unknown, write: (text: string) => void): void {
  const message = error instanceof Error ? error.message : String(error);
  const limit = 4_000;
  const shown =
    message.length > limit
      ? `${message.slice(0, limit)}\n… ${message.length - limit} more characters`
      : message;
  write(
    `${allowStaleArtifactsVariable}=1: allowing a stale artifact instead of failing.\n${shown}\n`,
  );
}

export interface RequireFreshOptions {
  /** The environment to read the switch from. Defaults to this process's. */
  readonly env?: Record<string, string | undefined>;
  /** Where an allowed difference is printed. Defaults to stderr. */
  readonly write?: (text: string) => void;
}

/**
 * Run one freshness comparison under that policy.
 *
 * `compare` throws when the artifact is stale, exactly as it does today. This rethrows unless the
 * switch is set, in which case the difference is printed and the build goes on. Wrap each
 * comparison separately rather than a whole verify branch, so one allowed difference does not hide
 * the ones after it.
 */
// The promise-returning form comes first on purpose. `Promise<void>` is assignable to `void`, so
// a `() => void` overload listed first would also match an async comparison and type the call as
// `void`, losing the `await`. The reverse is not true, so this order resolves each call to the
// form it actually is.
export function requireFresh(
  compare: () => Promise<void>,
  options?: RequireFreshOptions,
): Promise<void>;
export function requireFresh(compare: () => void, options?: RequireFreshOptions): void;
export function requireFresh(
  compare: () => void | Promise<void>,
  {env, write = (text: string) => process.stderr.write(text)}: RequireFreshOptions = {},
): void | Promise<void> {
  const handle = (error: unknown) => {
    if (!staleArtifactsAllowed(env)) throw error;
    reportAllowedStaleness(error, write);
  };
  let result: void | Promise<void>;
  try {
    result = compare();
  } catch (error) {
    handle(error);
    return undefined;
  }
  if (result instanceof Promise) return result.catch(handle);
  return undefined;
}
