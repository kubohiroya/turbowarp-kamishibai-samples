import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {strFromU8, unzipSync} from 'fflate';
import {readDsl4StoryConfig} from './story-config.ts';
import type {AppRelease} from './app-release.ts';
import type {ScratchProject} from './scratch.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const readJson = async (name: string) => JSON.parse(await readFile(path.join(root, name), 'utf8'));
const release = (await readJson('app-release.json')) as AppRelease;
const config = await readDsl4StoryConfig(path.join(root, 'stories/urashima'));
assert.equal(config.runtime.commit, release.commit);
assert.equal(config.runtime.version, release.version);
const base = await readFile(path.join(root, 'stories/urashima', config.runtime.basePath));
assert.equal(base.length, release.artifact.size);
assert.equal(createHash('sha256').update(base).digest('hex'), release.artifact.sha256);
const filenames: string[] = [];
for (const name of ['urashima', 'my-urashima', 'tutorial']) {
  const story = await readDsl4StoryConfig(path.join(root, `stories/${name}`));
  filenames.push(`stories/${name}/${story.output}`, `stories/${name}/${story.blocksOutput}`);
  const lock = await readJson(`stories/${name}/dsl4-artifacts.lock.json`);
  assert.equal(lock.runtime.commit, release.commit);
  assert.equal(lock.blockAuthoring.commit, release.commit);
}
for (const count of [2, 3, 4])
  filenames.push(`stories/my-urashima/my-urashima-${count}-poses-blocks-4.0.sb3`);
for (const name of ['audio-playback', 'three-visits']) {
  const lock = await readJson(`stories/${name}/dsl4-artifacts.lock.json`);
  assert.equal(lock.runtime.commit, release.commit);
  assert.equal(lock.builder.commit, release.commit);
  assert.equal(lock.builder.version, release.version);
  filenames.push(
    `stories/${name}/${lock.outputs.yaml.path}`,
    `stories/${name}/${lock.outputs.blocks.path}`,
  );
}
for (const name of filenames) {
  const archive = unzipSync(await readFile(path.join(root, name)));
  const project = JSON.parse(strFromU8(archive['project.json']!)) as ScratchProject;
  const stage = project.targets.find((target) => target.isStage)!;
  for (const [costumeName, title] of [
    ['Title', 'TurboWarp Kamishibai'],
    ['Menu', 'TurboWarp Kamishibai'],
    ['TitleRuntime', 'TurboWarp紙芝居'],
    ['MenuRuntime', 'TurboWarp紙芝居'],
  ]) {
    const costume = stage.costumes.find(({name}) => name === costumeName);
    assert(costume, `${name}: ${costumeName} is missing.`);
    const source = strFromU8(archive[costume.md5ext!]!);
    assert(source.includes(title), `${name}: ${costumeName} has an outdated title.`);
    assert(!source.includes('Participatory AI Kamishibai'), `${name}: retired title remains.`);
  }
}
console.log(
  `Verified ${filenames.length} SB3 files: ${release.tag}, unified builders and localized titles/menus.`,
);
