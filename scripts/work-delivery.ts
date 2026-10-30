import assert from 'node:assert/strict';
import catalog from '../site/work-delivery.json' with {type: 'json'};
import type {WorkEntry} from './works-catalog.ts';

export interface WorkDelivery {
  id: string;
  assets: {scope: string; mode: 'external' | 'internal' | 'project'}[];
  script: {format: 'dsl4-yaml' | 'dsl4-blocks' | 'dsl32-txt'; mode: 'external' | 'embedded'};
  sb3: string;
  source?: string;
  web?: string;
  note?: string;
}

export const assetModeLabels = {
  external: '外部URL参照',
  internal: '内部パス参照（同梱ファイル）',
  project: 'コスチューム・背景・音',
} as const;
export const scriptFormatLabels = {
  'dsl4-yaml': 'DSL4.0 YAML台本',
  'dsl4-blocks': 'DSL4.0 ブロック台本',
  'dsl32-txt': 'DSL3.2 TXT台本',
} as const;

export function validateWorkDelivery(value: unknown, work: WorkEntry): asserts value is WorkDelivery[] {
  assert(Array.isArray(value) && value.length > 0, `${work.id}: delivery rows are required.`);
  const ids = new Set<string>();
  const knownHrefs = new Set([
    ...work.actions.map(({href}) => href),
    ...Object.values(work.artifacts ?? {}).map(({href}) => href),
  ].filter((href): href is string => Boolean(href)));
  for (const raw of value) {
    assert(raw && typeof raw === 'object' && !Array.isArray(raw));
    const row = raw as WorkDelivery;
    assert(typeof row.id === 'string' && /^[a-z0-9-]+$/u.test(row.id));
    assert(!ids.has(row.id), `${work.id}: duplicate delivery ${row.id}.`);
    ids.add(row.id);
    assert(row.script && Object.hasOwn(scriptFormatLabels, row.script.format));
    assert(['external', 'embedded'].includes(row.script.mode));
    assert(row.script.format !== 'dsl4-blocks' || row.script.mode === 'embedded', 'Block scripts must be embedded.');
    assert(Array.isArray(row.assets) && row.assets.length > 0);
    for (const asset of row.assets) {
      assert(typeof asset.scope === 'string' && asset.scope.length > 0);
      assert(Object.hasOwn(assetModeLabels, asset.mode));
    }
    assert(typeof row.sb3 === 'string' && row.sb3.endsWith('.sb3') && knownHrefs.has(row.sb3), `${work.id}: unknown SB3 ${row.sb3}.`);
    if (row.source) assert(knownHrefs.has(row.source), `${work.id}: unknown source ${row.source}.`);
    if (row.script.mode === 'external') assert(row.source, `${work.id}: external scripts need their source link.`);
    if (row.script.format === 'dsl4-blocks') {
      assert.equal(row.sb3, work.artifacts?.['sb3-blocks'].href, 'Block rows must use the declared block project.');
      assert(!row.web, 'No Web build is declared for these block projects.');
    }
    if (row.web) {
      assert(work.actions.some((action) => action.href === row.web && action.launch === 'web' && !action.disabled), `${work.id}: Web action must be declared.`);
      assert(work.artifacts?.html.href !== row.web || row.sb3 !== work.artifacts?.['sb3-blocks'].href, 'Do not reuse a YAML Web build for a block project.');
    }
    if (row.note) assert(typeof row.note === 'string');
  }
}

export function workDelivery(work: WorkEntry): WorkDelivery[] | undefined {
  const rows = (catalog.works as Record<string, unknown>)[work.id];
  if (!rows) return undefined;
  validateWorkDelivery(rows, work);
  return rows;
}
