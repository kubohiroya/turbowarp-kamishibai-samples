import process from 'node:process';

import {defineConfig} from 'vitest/config';

// On CI, one test file at a time.
//
// The GitHub-hosted runner (4 cores, 15.7 GB) runs out of memory while the tests run and the
// kernel takes the process, which GitHub reports as a cancelled job. Sampling the runner showed a
// single Node process growing from 350 MB to 15.2 GB in thirty seconds, so the cost is one file's,
// not the sum of several running at once: capping the workers by memory did not help, and neither
// did bounding glibc's per-thread arenas.
//
// Measured on a developer machine the whole suite with nine workers peaks at 3.3 GB across ten
// processes and its largest single worker at 1.0 GB, with or without dist/ present, so the file
// that does this on the runner does not do it here and the cause is still open.
//
// Running the files in order does not make the suite fit. It is here because the log then names
// the file that was running when the runner died, and because the suite costs 1.3 GB instead of
// 3.3 GB for 85s instead of 35s. A developer machine keeps the default.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    // sb3 のビルドやパッケージングを伴うテストがあるため、既定より長めに取る。
    testTimeout: 180_000,
    hookTimeout: 180_000,
    ...(process.env.CI ? {maxWorkers: 1} : {}),
  },
});
