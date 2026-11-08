import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

import {sb3SaveCapabilities} from '@kubohiroya/turbowarp-sb3-save-format';
import {readSb3ExtensionPayloads} from '@kubohiroya/turbowarp-sb3-save-format/writer';

export const extensionSaveCapabilities = sb3SaveCapabilities();

export function readBlockProjectExtensions(
  project: Record<string, unknown>,
  archive: Record<string, Uint8Array> = {},
) {
  return new Map(readSb3ExtensionPayloads(archive, project).flatMap((payload) => {
    const {id, bytes, sha256} = payload;
    if (!bytes) return [];
    assert(sha256, `Extension digest is missing: ${id}.`);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), sha256, `Extension digest differs: ${id}.`);
    return [[id, {...payload, bytes, sha256}] as const];
  }));
}
