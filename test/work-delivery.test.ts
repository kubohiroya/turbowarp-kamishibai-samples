import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {test} from 'vitest';
import {readWorksCatalog} from '../scripts/works-catalog.ts';
import {validateWorkDelivery, workDelivery} from '../scripts/work-delivery.ts';
import {renderDeliveryRows} from '../scripts/build-site.ts';

test('keeps heading play links and editor links matched to the delivered formats on home and detail pages', async () => {
  const catalog = await readWorksCatalog('site/works.json');
  const features = {urashimaWeb: true, urashimaDsl4Web: true, myUrashimaDsl4Web: true};
  for (const id of ['urashima', 'my-urashima']) {
    const work = catalog.works.find((entry) => entry.id === id)!;
    const rows = workDelivery(work)!;
    for (const detail of [false, true]) {
      const html = renderDeliveryRows(work, rows, features, (href) => detail ? href.replace(`stories/${id}/`, '') : href);
      const cards = [...html.matchAll(/<section class="delivery-option"[\s\S]*?<\/section>/gu)].map(([card]) => card);
      assert.equal(cards.length, rows.length);
      for (const [index, row] of rows.entries()) {
        const card = cards[index]!;
        const heading = card.slice(0, card.indexOf('<div class="delivery-assets">'));
        const play = heading.match(/<a class="delivery-play" href="([^"]+)" title="Web版でプレイ" aria-label="Web版でプレイ"/u);
        assert.equal(Boolean(play), Boolean(row.web));
        if (row.web) {
          assert.equal(play![1], detail ? row.web.replace(`stories/${id}/`, '') : row.web);
          assert(heading.includes('data-capability-launch="camera"'));
        }
        assert(!card.includes('class="button"'));
        const editorLink = card.match(/class="twpe-edit-button" href="([^"]+)"/u);
        assert(editorLink, `${id}/${row.id} must have an editor button.`);
        const editor = new URL(editorLink[1]!.replaceAll('&amp;', '&'));
        assert.equal(editor.searchParams.get('project_url'), `https://kubohiroya.github.io/turbowarp-kamishibai-samples/${row.sb3}`);
        assert.equal(editor.searchParams.get('lang'), 'ja');
        assert.equal(editor.searchParams.get('twPlusYamlEditor'), '1');
        const download = detail ? row.sb3.replace(`stories/${id}/`, '') : row.sb3;
        assert(card.includes(`href="${download}" download`));
      }
    }
  }
});

test('keeps external workshop YAML distinct from the embedded story Web build', async () => {
  const catalog = await readWorksCatalog('site/works.json');
  for (const id of ['urashima', 'my-urashima']) {
    const work = catalog.works.find((entry) => entry.id === id)!;
    const config = JSON.parse(await readFile(`stories/${id}/sample.config.json`, 'utf8'));
    const rows = workDelivery(work)!;
    const yaml = rows.find(({script}) => script.format === 'dsl4-yaml')!;
    assert.equal(yaml.script.mode, config.dsl4.web.scriptMode);
    assert.equal(yaml.sb3, `stories/${id}/${config.dsl4.output}`);
    assert.equal(yaml.web, `stories/${id}/${config.dsl4.web.outputDirectory}/`);
    assert(!rows.find(({script}) => script.format === 'dsl4-blocks')!.web);
    assert(rows.find(({script}) => script.format === 'dsl4-blocks')!.assets.length >= 2);
  }
});

test('rejects undeclared artifacts, external block scripts, and another configuration Web build', async () => {
  const work = (await readWorksCatalog('site/works.json')).works.find(({id}) => id === 'my-urashima')!;
  const original = workDelivery(work)!;
  const badArtifact = structuredClone(original);
  badArtifact[0]!.sb3 = 'stories/my-urashima/not-built.sb3';
  assert.throws(() => validateWorkDelivery(badArtifact, work), /unknown SB3/u);
  const badScript = structuredClone(original);
  badScript[1]!.script.mode = 'external';
  assert.throws(() => validateWorkDelivery(badScript, work), /Block scripts must be embedded/u);
  const badWeb = structuredClone(original);
  badWeb[1]!.web = original[0]!.web;
  assert.throws(() => validateWorkDelivery(badWeb, work), /No Web build/u);
});
