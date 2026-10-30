import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {test} from 'vitest';
import {readWorksCatalog} from '../scripts/works-catalog.ts';
import {validateWorkDelivery, workDelivery} from '../scripts/work-delivery.ts';

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
