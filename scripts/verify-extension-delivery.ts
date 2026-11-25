import assert from 'node:assert/strict';
import {globSync} from 'node:fs';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

import {strFromU8, unzipSync} from 'fflate';

import {readBlockProjectExtensions} from './block-project-extensions.ts';
import type {ScratchProject} from './scratch.ts';

/**
 * Check that every work stores its extensions in the form the repository declares.
 *
 * How an SB3 carries a referenced extension decides where the reference's metadata lives:
 * `embedded-data` puts the bytes in a `data:` URI under `extensionURLs`, `embedded-file` puts
 * them in the archive and leaves `extensionURLs` empty. Until now only one output chose a form
 * on purpose — build-urashima-dsl4.ts converts its block source to `embedded-file` so the editor
 * reads verified files through the Plus Manifest, and verify-urashima-dsl4.ts asserts it. Every
 * other output took whatever the App's default produced, and nothing recorded or checked which
 * that was: of 27 extension references across 17 works, 25 turned out to be `embedded-data` and
 * 2 `embedded-file`, with the same story split between the two.
 *
 * repo-policy.json now states the form instead of leaving it to be read back afterwards, and this
 * compares every reference against it.
 */
const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const readJson = async (file: string) =>
  JSON.parse(await readFile(path.join(projectRoot, file), 'utf8'));

interface ExtensionDelivery {
  default: string;
  [form: string]: string | string[];
}

const {extensionDelivery} = (await readJson('repo-policy.json')) as {
  extensionDelivery: ExtensionDelivery;
};
assert(extensionDelivery?.default, 'repo-policy.json must declare extensionDelivery.default');

/** The form a work's path is declared to use, by name rather than by what it happens to hold. */
function declaredForm(file: string): string {
  const named = Object.entries(extensionDelivery).filter(
    ([form, value]) => form !== 'default' && Array.isArray(value) && value.includes(file),
  );
  assert(named.length <= 1, `${file} is declared under more than one delivery form.`);
  return named[0]?.[0] ?? extensionDelivery.default;
}

/** Every `.sb3` a story lock records, by its path relative to the repository. */
function lockedArchives(lock: unknown, storyDirectory: string, found: Set<string>) {
  const walk = (node: unknown) => {
    if (Array.isArray(node)) {
      for (const value of node) walk(value);
      return;
    }
    if (node === null || typeof node !== 'object') return;
    const record = node as {path?: unknown; sha256?: unknown};
    if (
      typeof record.path === 'string' &&
      record.path.endsWith('.sb3') &&
      typeof record.sha256 === 'string'
    ) {
      found.add(`${storyDirectory}/${record.path}`);
    }
    for (const value of Object.values(node)) walk(value);
  };
  walk(lock);
}

const works = new Set<string>();
for (const lockFile of globSync('stories/*/dsl4-artifacts.lock.json', {cwd: projectRoot}).sort()) {
  const storyDirectory = path.dirname(lockFile).split(path.sep).join('/');
  lockedArchives(await readJson(lockFile), storyDirectory, works);
}
assert(works.size > 0, 'No SB3 files are recorded in stories/*/dsl4-artifacts.lock.json.');

const wrong: string[] = [];
let references = 0;
for (const file of [...works].sort()) {
  const expected = declaredForm(file);
  const archive = unzipSync(new Uint8Array(await readFile(path.join(projectRoot, file))));
  const project = JSON.parse(strFromU8(archive['project.json']!)) as ScratchProject;
  for (const [id, extension] of readBlockProjectExtensions(project, archive)) {
    references += 1;
    if (extension.format === expected) continue;
    wrong.push(`${file}\n  ${id}: stores ${String(extension.format)}, declared ${expected}`);
  }
}

// A path declared under a form but absent from the locks would be a declaration nothing applies.
for (const [form, value] of Object.entries(extensionDelivery)) {
  if (form === 'default' || !Array.isArray(value)) continue;
  for (const file of value) {
    assert(works.has(file), `repo-policy.json declares ${file} as ${form}, but no lock records it.`);
  }
}

assert.equal(
  wrong.length,
  0,
  `${wrong.length} extension reference(s) are not stored in the declared form.\n\n${wrong.join('\n\n')}\n\n` +
    'Either the work must be rebuilt in that form, or repo-policy.json must declare the form it ' +
    'uses. The form decides where the reference metadata lives, so it is a stated choice.',
);
console.log(
  `Verified ${references} extension reference(s) in ${works.size} work(s) against repo-policy.json.`,
);
