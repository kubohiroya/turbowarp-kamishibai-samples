import os from 'node:os';

import {defineConfig} from 'vitest/config';

// 同時に動かすワーカー数は、コア数ではなく実メモリから決める。
// Vitest はテストファイルごとにプロセスを起こし、既定ではコア数−1 まで並べる。ここのテストは
// SB3 と、それを埋め込んだ HTML を丸ごと組み立てるため、1ワーカーのピークがGB級になる。GitHub
// ホストのランナー（4コア・15.7GB）では既定の3ワーカーが70秒で 15,750MB に達し、swap まで
// 巻き込んでカーネルにプロセスを落とされた。GitHub はこれを cancelled として記録し、ログも
// 破棄するので、run には cancelled とだけ残る。
// 下の見込み値は同じ計測から取っている。アイドル時から 14.4GB 増えてワーカーは3本、1本あたり
// 約4.8GB。OS の取り分を引いた残りをこの見込みで割ると、ランナーでは2本になり、メモリが潤沢な
// 機械ではコア数ぶんが残るので手元の実行は変わらない。
const workerPeakMiB = 5 * 1024;
const reservedMiB = 2 * 1024;
const cores = os.availableParallelism?.() ?? os.cpus().length;
const memoryBudgetMiB = Math.max(workerPeakMiB, os.totalmem() / (1024 * 1024) - reservedMiB);
const maxWorkers = Math.max(1, Math.min(cores - 1, Math.floor(memoryBudgetMiB / workerPeakMiB)));

// このリポジトリはブラウザ向けバンドルを持たないため、Vite はテスト設定のホストとして使う。
export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    // sb3 のビルドやパッケージングを伴うテストがあるため、既定より長めに取る。
    testTimeout: 180_000,
    hookTimeout: 180_000,
    maxWorkers,
  },
});
