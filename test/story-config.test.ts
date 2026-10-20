import assert from 'node:assert/strict';
import {mkdtemp, mkdir, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {test} from 'vitest';

import type {AppRelease} from '../scripts/app-release.ts';
import {readAppRelease} from '../scripts/app-dependency.ts';
import {readDsl4StoryConfig} from '../scripts/story-config.ts';

const snapshot = (version: string, commit: string): AppRelease => ({
  formatVersion: 1,
  repository: 'kubohiroya/turbowarp-kamishibai-app',
  version,
  tag: `v${version}`,
  commit,
  publishedAt: '2026-10-20T00:00:00Z',
  sourceIdentity: `sha256:${'b'.repeat(64)}`,
  artifact: {
    filename: `kamishibai-${version}.sb3`,
    url: `https://github.com/kubohiroya/turbowarp-kamishibai-app/releases/download/v${version}/kamishibai-${version}.sb3`,
    size: 123,
    sha256: 'c'.repeat(64),
  },
});

async function fixture(run: (root: string, story: string) => Promise<void>) {
  const root = await mkdtemp(path.join(tmpdir(), 'samples-story-settings-'));
  try {
    const story = path.join(root, 'stories/tutorial');
    await mkdir(story, {recursive: true});
    await writeFile(
      path.join(root, 'app-release.json'),
      JSON.stringify(snapshot('4.0.0-rc.30', 'a'.repeat(40))),
    );
    await writeFile(
      path.join(story, 'sample.config.json'),
      JSON.stringify({
        dsl4: {
          formatVersion: 1,
          web: {enabled: false},
          publication: {enabled: false, issue: '#192'},
          blockAuthoring: {sourceSections: false},
        },
      }),
    );
    await run(root, story);
  } finally {
    await rm(root, {recursive: true, force: true});
  }
}

test('all stories follow a manifest-only update without changing local flags or settings', async () => {
  await fixture(async (root, tutorial) => {
    const settings = await readFile(
      path.join(tutorial, 'sample.config.json'),
      'utf8',
    );
    const stories = ['urashima', 'my-urashima', 'tutorial'].map((name) =>
      path.join(root, 'stories', name),
    );
    for (const story of stories) {
      await mkdir(story, {recursive: true});
      await writeFile(path.join(story, 'sample.config.json'), settings);
    }
    const before = await Promise.all(
      stories.map((story) => readDsl4StoryConfig(story)),
    );
    assert(before.every(({runtime}) => runtime.commit === 'a'.repeat(40)));
    const next = snapshot('4.0.0-rc.31', 'd'.repeat(40));
    await writeFile(path.join(root, 'app-release.json'), JSON.stringify(next));
    for (const story of stories) {
      const config = await readDsl4StoryConfig(story);
      assert.equal(config.runtime.commit, next.commit);
      assert.equal(config.runtime.version, next.version);
      assert.equal(
        config.releaseDependency,
        `https://github.com/${next.repository}/releases/tag/${next.tag}`,
      );
      assert(config.publication!.reason!.includes(next.version));
      assert.equal(config.web.enabled, false);
      assert.equal(config.publication!.enabled, false);
      assert.equal(config.blockAuthoring!.sourceSections, false);
      assert.equal(
        await readFile(path.join(story, 'sample.config.json'), 'utf8'),
        settings,
      );
    }
  });
});

test('rejects independent dependency pins and retired authoring overrides', async () => {
  await fixture(async (_root, story) => {
    const file = path.join(story, 'sample.config.json');
    const initial = JSON.parse(await readFile(file, 'utf8'));
    for (const override of [
      {runtime: {config: '../urashima/retired.json'}},
      {version: '4.0.0-rc.25'},
      {releaseDependency: 'old-release'},
      {blockAuthoring: {commit: 'a'.repeat(40)}},
      {blockAuthoring: {repository: 'other-repo'}},
      {blockAuthoring: {refreshRuntime: true}},
      {blockAuthoring: {sourceSections: 'false'}},
    ]) {
      await writeFile(
        file,
        JSON.stringify({dsl4: {...initial.dsl4, ...override}}),
      );
      await assert.rejects(readDsl4StoryConfig(story));
    }
  });
});

test('rejects an inconsistent or missing manifest instead of using a story fallback', async () => {
  await fixture(async (root, story) => {
    const release = snapshot('4.0.0-rc.30', 'a'.repeat(40));
    for (const patch of [
      {commit: 'main'},
      {tag: 'v4.0.0-rc.25'},
      {sourceIdentity: 'invalid'},
      {artifact: {...release.artifact, size: -1}},
      {artifact: {...release.artifact, sha256: 'invalid'}},
    ]) {
      await writeFile(
        path.join(root, 'app-release.json'),
        JSON.stringify({...release, ...patch}),
      );
      await assert.rejects(readAppRelease(root));
      await assert.rejects(readDsl4StoryConfig(story));
    }
    await rm(path.join(root, 'app-release.json'));
    await assert.rejects(readDsl4StoryConfig(story), /ENOENT/u);
  });
});
