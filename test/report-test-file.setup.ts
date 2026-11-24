import fs from 'node:fs';
import path from 'node:path';

import {expect} from 'vitest';

/**
 * Name each test file as it starts, for the CI runs the kernel kills.
 *
 * A reporter names a file when it finishes, which a run that dies inside one never reaches, and
 * Vitest replaces `process.stdout` in its workers, so `console.log` here is buffered and reported
 * with the file's result — also too late. Writing to the file descriptor goes around that and
 * reaches the job's log straight away.
 *
 * Remove this with the rest of the resource diagnostics once those runs are explained.
 */
const testPath = expect.getState().testPath;
fs.writeSync(2, `[test file] ${testPath ? path.relative(process.cwd(), testPath) : 'unknown'}\n`);
