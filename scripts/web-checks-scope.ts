import process from 'node:process';
import {fileURLToPath} from 'node:url';

const browserIndependent = /^(?:(?:.*\/)?README(?:\.[a-z]+)?\.md|docs\/.*\.md|test\/.*\.test\.ts)$/u;
const editorOnly = /^scripts\/(?:block-diagnostic-fixture|verify-dsl4-block-editor-browser|verify-published-block-editor|verify-published-block-diagnostics)\.ts$/u;
const dsl4Only: readonly RegExp[] = [
  /^app-release\.json$/u,
  /^stories\/(?:tutorial|audio-playback|three-visits)\//u,
  /^stories\/(?:urashima|my-urashima)\/[^/]*(?:dsl4|4\.0|\.k4\.yml)/u,
  /^scripts\/(?:build-(?:urashima-dsl4|my-urashima-dsl4|tutorial-dsl4|audio-playback|three-visits)|verify-(?:urashima-dsl4|dsl4-packaged-web-browser|dsl4-block-source-round-trip|tutorial-dsl4))\.ts$/u,
];

export type WebCheckScope = 'all' | 'dsl4' | 'editor' | 'none';

/** Narrow checks only for inputs with a known owner. Shared and unfamiliar paths run everything. */
export function webCheckScope(changedPaths: readonly string[]): WebCheckScope {
  if (changedPaths.length === 0) return 'all';
  const browserPaths = changedPaths.filter((candidate) => !browserIndependent.test(candidate));
  if (browserPaths.length === 0) return 'none';
  if (browserPaths.every((candidate) => editorOnly.test(candidate))) return 'editor';
  if (browserPaths.every((candidate) => editorOnly.test(candidate) ||
    dsl4Only.some((pattern) => pattern.test(candidate)))) return 'dsl4';
  return 'all';
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const input = await new Promise<string>((resolve, reject) => {
    let text = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => {
      text += chunk;
    });
    process.stdin.once('end', () => resolve(text));
    process.stdin.once('error', reject);
  });
  const paths = input
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  process.stdout.write(`${webCheckScope(paths)}\n`);
}
