import assert from 'node:assert/strict';

export const workshopPoseCounts = [2, 3, 4] as const;
export type WorkshopPoseCount = (typeof workshopPoseCounts)[number];

/** Enable one existing workshop choice without introducing a second script template. */
export function createMyUrashimaPoseVariant(source: string, poseCount: WorkshopPoseCount): string {
  assert(workshopPoseCounts.includes(poseCount), 'The workshop supports 2, 3, or 4 poses.');
  const candidates = source.match(/^#      - Princess\.pose:.*$/gmu) ?? [];
  assert.equal(candidates.length, 3, 'Exactly three workshop pose candidates are required.');
  const lines = [
    ...Array.from({length: poseCount}, (_, i) => `#  p${i + 1}: costume:Princess`),
    candidates[poseCount - 2]!,
  ];
  let variant = source;
  for (const line of lines) {
    const parts = variant.split(line);
    assert.equal(parts.length, 2, `Workshop candidate must occur exactly once: ${line}`);
    variant = parts[0] + line.slice(1) + parts[1];
  }
  assert.equal((variant.match(/^  p[1-4]: costume:Princess$/gmu) ?? []).length, poseCount);
  assert.equal((variant.match(/^      - Princess\.pose:/gmu) ?? []).length, 1);
  return variant;
}
