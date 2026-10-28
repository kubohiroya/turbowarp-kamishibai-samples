import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {test} from 'vitest';
import {SITE_SHELL_CSS_URL} from '@kubohiroya/turbowarp-kamishibai-site-navigation';
import {fileURLToPath} from 'node:url';
import {verifyNoPlusHeader} from '../scripts/verify-site.ts';
import {
  renderAudioPlaybackIndex,
  renderMyUrashimaIndex,
  renderRightsIndex,
  renderRootIndex,
  renderSampleIndex,
  renderThreeVisitsIndex,
  renderTutorialIndex,
} from '../scripts/build-site.ts';
import type {MyUrashimaDsl4Manifest, SiteManifest} from '../scripts/site-manifest.ts';
import {readTutorialStoryConfig, type ArtifactsLock} from '../scripts/story-config.ts';
import {readWorksCatalog} from '../scripts/works-catalog.ts';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));

test('rejects Plus header injection while preserving native Kamishibai navigation', () => {
  assert.doesNotThrow(() => verifyNoPlusHeader(
    '<header class="site-header">紙芝居</header><footer class="site-footer">権利表示</footer>',
    'index.html',
  ));
  for (const html of [
    '<script type="module" src="https://kubohiroya.github.io/turbowarp-plus-site-header/dist/auto.js"></script>',
    '<turbowarp-plus-header></turbowarp-plus-header>',
    '<turbowarp-plus-header sticky></turbowarp-plus-header>',
  ]) {
    assert.throws(() => verifyNoPlusHeader(html, 'stories/tutorial/index.html'), /Plus header is not allowed/u);
  }
});

test('all public page renderers retain the native header and footer without Plus injection', async () => {
  const catalog = await readWorksCatalog(path.join(projectRoot, 'site/works.json'));
  const work = (id: string) => {
    const entry = catalog.works.find((candidate) => candidate.id === id);
    assert(entry, `Missing work ${id}`);
    return entry;
  };
  const record = {size: 1, sha256: 'fixture'};
  const manifest = {
    updatedAt: '2026-08-16', web: {enabled: false}, dsl4Web: {enabled: false},
    script: record, source: {dsl4Script: record}, profiles: {player: {sb3: record}, editor: {sb3: record}},
    dsl4Offline: record, assets: [], assetCounts: {images: 0, sounds: 0, embedded: 0},
  } as unknown as SiteManifest;
  const myManifest = {source: record, output: record, web: {enabled: false}} as unknown as MyUrashimaDsl4Manifest;
  const tutorialDirectory = path.join(projectRoot, 'stories/tutorial');
  const tutorialConfig = await readTutorialStoryConfig(tutorialDirectory);
  const tutorialManifest = JSON.parse(await readFile(path.join(tutorialDirectory, 'public-surfaces.json'), 'utf8'));
  const pages = {
    root: renderRootIndex(manifest, myManifest, catalog),
    urashima: renderSampleIndex(manifest, work('urashima')),
    myUrashima: renderMyUrashimaIndex(work('my-urashima'), myManifest, {} as ArtifactsLock),
    tutorial: renderTutorialIndex(tutorialConfig.work, tutorialManifest),
    rights: renderRightsIndex(),
    audio: renderAudioPlaybackIndex(work('audio-playback'), '4.0.0-rc.59'),
    narrative: renderThreeVisitsIndex(work('three-visits'), '4.0.0-rc.59'),
  };
  for (const [page, html] of Object.entries(pages)) {
    verifyNoPlusHeader(html, page);
    assert(html.includes('<header class="site-header">'), `${page}: native header missing`);
    assert(html.includes('<footer class="site-footer"'), `${page}: native footer missing`);
  }
  assert(pages.urashima.includes('DSL 3.2'));
  assert(pages.urashima.includes('DSL 4.0'));
});

test('keeps the Urashima site symbol transparent and free of decorative borders', async () => {
  const css = await readFile(SITE_SHELL_CSS_URL, 'utf8');

  assert.match(
    css,
    /\.site-brand__symbol\s*\{[\s\S]*?border:\s*0;[\s\S]*?border-radius:\s*0;[\s\S]*?background:\s*transparent;/u,
  );
});

test('styles the shared rights footer for narrow screens and print', async () => {
  const css = await readFile(SITE_SHELL_CSS_URL, 'utf8');

  assert.match(css, /\.site-footer\s*\{[\s\S]*?border-top:/u);
  assert.match(css, /\.site-footer__brand\s*\{[\s\S]*?min-height:\s*44px;/u);
  assert.match(css, /\.site-footer__rights\s*\{[\s\S]*?min-height:\s*44px;/u);
  assert.match(
    css,
    /@media \(max-width:\s*760px\)[\s\S]*?\.site-footer__legal\s*\{[\s\S]*?text-align:\s*left;/u,
  );
  assert.match(css, /@media print[\s\S]*?\.site-footer\s*\{[\s\S]*?display:\s*none/u);
});

test('records the source of the Urashima site symbol', async () => {
  const metadata = JSON.parse(
    await readFile(path.join(projectRoot, 'site/favicon.source.json'), 'utf8'),
  );

  assert.equal(metadata.sourceName, 'Urashima-walk-1');
  assert.equal(metadata.sourceRepository, 'kubohiroya/turbowarp-kamishibai-samples');
  assert.equal(
    metadata.sourcePath,
    'stories/urashima/assets/images/9a8cf053f6169ea9b530a852ab62c5a0.png',
  );
  assert.equal(
    metadata.sourceSha256,
    '617bdabd94e214551ce06b32acc67e5fb3eeb77b84e1c56b9a445f79e79f2919',
  );
  assert.equal(metadata.license, 'MPL-2.0');
  assert.equal(metadata.derivedAsset, 'favicon.png');
});
