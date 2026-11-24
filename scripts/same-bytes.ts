import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

/**
 * Assert that two archives hold the same bytes, reporting digests instead of a diff.
 *
 * `assert.deepEqual` is not usable on buffers of this size. When they differ it inspects both with
 * no length limit and diffs the result line by line, which costs about 375 MB per megabyte
 * compared: measured here, two 10.3 MB buffers one byte apart reach 3.3 GB. The SB3 files these
 * builders compare are about 10.8 MB each, so on a GitHub-hosted runner with 15.7 GB the kernel
 * takes the process while the failure message is still being built. GitHub reports that as a
 * cancelled job and discards the log, so the run never says which file was stale.
 *
 * A digest decides equality just as well, and the size and digest it prints are something a
 * reader can act on.
 */
export function assertSameBytes(actual: Uint8Array, expected: Uint8Array, message: string): void {
  const actualDigest = createHash('sha256').update(actual).digest('hex');
  const expectedDigest = createHash('sha256').update(expected).digest('hex');
  if (actualDigest === expectedDigest) return;
  assert.fail(
    `${message}\n  actual:   ${actual.byteLength} bytes, sha256 ${actualDigest}` +
      `\n  expected: ${expected.byteLength} bytes, sha256 ${expectedDigest}`,
  );
}
