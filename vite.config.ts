import process from 'node:process';

import {defineConfig} from 'vitest/config';

// On CI, one test file at a time.
//
// The GitHub-hosted runner (4 cores, 15.7 GB) runs out of memory while this stage runs and the
// kernel takes the process: once reported as a cancelled job, once as the runner losing
// communication with the server. Either way GitHub discards the job's log, so the run says only
// that it failed.
//
// Deriving the worker count from the runner's memory did not change that, and the suite's own cost
// does not explain it: measured on a developer machine, the whole suite with nine workers peaks at
// 3.3 GB across ten processes, and the largest single worker at 1.0 GB. Removing dist/ beforehand,
// as CI has it, does not change those numbers either. So what holds the runner's memory is not
// established, and Vitest's workers are not shown to be it.
//
// Until it is explained, CI runs the files in order. Each file still gets its own process, so
// whatever one file allocates is returned before the next one starts, and nothing multiplies it.
// A developer machine keeps the default, so local runs are unchanged.
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
