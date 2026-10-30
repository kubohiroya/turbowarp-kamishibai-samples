import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';

import {strFromU8, strToU8, unzipSync, zipSync} from 'fflate';
import type {Page} from 'playwright';

import {assertEmbeddedYamlBlockSource} from './migrate-embedded-yaml.ts';
import type {ScratchProject} from './scratch.ts';

const prefix = 'kubohiroyakamishibai4_kubohiroyakamishibairuntime4__';
const authoring = 'kubohiroyakamishibaiauthoring4_';
const configuration = new Set(['control', 'asset', 'cover', 'textStyle', 'variable', 'loading', 'recognition']);
const configurationKeys = new Set(['controls', 'assets', 'cover', 'textStyles', 'variables', 'loading', 'recognition']);

/** Make an explicitly separate compatibility fixture; never rewrite the downloaded distribution. */
export async function createLegacyBlockDiagnosticFixture(input: string, directory: string) {
  const original = await readFile(input), archive = unzipSync(original);
  const project = JSON.parse(strFromU8(archive['project.json']!)) as ScratchProject;
  const stage = project.targets.find((target) => target.isStage)!;
  if (!Object.values(stage.blocks).some(({opcode}) => opcode === prefix + 'embeddedYamlRoot')) {
    return {input, converted: false, originalSha256: createHash('sha256').update(original).digest('hex')};
  }
  assertEmbeddedYamlBlockSource(project);
  const [rootId, root] = Object.entries(stage.blocks).find(([, b]) => b.opcode === prefix + 'embeddedYamlRoot')!;
  const documents = Object.entries(stage.blocks).filter(([, b]) => b.opcode === prefix + 'embeddedYaml');
  assert.equal(documents.length, 1, 'The legacy diagnostic fixture only supports one real document.');
  const [id, document] = documents[0]!;
  assert.equal(document.fields?.DOCUMENT?.[0], root.fields?.DOCUMENT?.[0]);
  assert(!root.comment, 'Do not discard a comment on the new root when deriving a compatibility fixture.');
  delete stage.blocks[rootId];
  document.opcode = authoring + 'kamishibai';
  document.fields = {};
  document.inputs = {VERSION: [1, [10, '4.0']], LABEL: [1, [10, '']]};
  const configId = 'legacy-diagnostic-config';
  assert(!stage.blocks[configId]);
  stage.blocks[configId] = {opcode: authoring + 'kamishibaiConfig', next: null, parent: null,
    topLevel: true, shadow: false, inputs: {LABEL: [1, [10, '']]}, fields: {}, x: 600, y: 32};
  let bodyTail = id, configTail = configId, next = document.next;
  document.next = null;
  while (next) {
    const block = stage.blocks[next]!;
    assert(block, `Missing diagnostic fixture block ${next}.`);
    const following = block.next;
    const isConfig = configuration.has(block.opcode.slice(authoring.length)) ||
      (block.opcode === authoring + 'property' && configurationKeys.has(JSON.parse(block.inputs?.PATH?.[1]?.[1] ?? 'null')?.[0]));
    const tail = isConfig ? configTail : bodyTail;
    stage.blocks[tail]!.next = next; block.parent = tail; block.next = null;
    if (isConfig) configTail = next; else bodyTail = next;
    next = following;
  }
  const component = project.extensionStorage?.kubohiroyakamishibai4?.components?.kubohiroyakamishibairuntime4;
  assert(component);
  delete component.sourceDocuments; delete component.editorViews;
  component.application = {...component.application, mode: 'menu'};
  archive['project.json'] = strToU8(JSON.stringify(project));
  const bytes = zipSync(archive, {level: 6});
  const output = path.join(directory, 'legacy-diagnostic-fixture.sb3');
  await writeFile(output, bytes);
  return {input: output, converted: true, originalSha256: createHash('sha256').update(original).digest('hex'),
    fixtureSha256: createHash('sha256').update(bytes).digest('hex'),
    purpose: 'Legacy Config/include diagnostics only; generated locally from the verified new document body.'};
}

/** Approve only extension IDs/sources present in the verified input, with current and legacy dialogs. */
export async function approveVerifiedBlockProject(page: Page, project: ScratchProject, legacyOnly = false) {
  const sources = new Map(Object.entries(project.extensionURLs ?? {}).filter(([, url]) => url.startsWith('data:text/javascript;base64,'))
    .map(([id, url]) => [id, createHash('sha256').update(Buffer.from(url.split(',')[1]!, 'base64')).digest('hex')]));
  let count = 0;
  for (;;) {
    await page.waitForFunction((legacyOnly) => document.querySelector('[role=dialog]') ||
      window.vm.runtime.targets.some((target: any) => Object.values(target.blocks?._blocks ?? {}).some((block: any) =>
        block.opcode === 'kubohiroyakamishibaiauthoring4_kamishibai' || (!legacyOnly && block.opcode.endsWith('__embeddedYaml')))), legacyOnly,
    {timeout: 120_000, polling: 250});
    const dialog = page.getByRole('dialog');
    if (!await dialog.count()) return count;
    assert(count++ < sources.size + 1, 'Unexpected additional extension permission request.');
    const rows = dialog.getByRole('article');
    if (await rows.count()) {
      await rows.first().waitFor({state: 'visible'});
      for (const row of await rows.all()) {
        const text = await row.innerText();
        const ids = [...sources.keys()].filter((id) => text.includes(id));
        assert.equal(ids.length, 1, 'Permission row must identify an extension in the verified input.');
        if (await row.locator('textarea').count()) assert.equal(createHash('sha256').update(await row.locator('textarea').inputValue()).digest('hex'), sources.get(ids[0]!));
        await row.getByRole('radio', {name: /(?:サンドボックスなし|Without sandbox)$/u}).check();
      }
      await dialog.getByRole('button', {name: 'OK', exact: true}).click();
    } else {
      const source = await dialog.locator('textarea').inputValue();
      assert([...sources.values()].includes(createHash('sha256').update(source).digest('hex')));
      await dialog.getByLabel('Run without sandbox', {exact: true}).check();
      await dialog.getByRole('button', {name: 'Allow', exact: true}).click();
    }
    await dialog.waitFor({state: 'hidden'});
  }
}

export async function loadVerifiedBlockProject(page: Page, input: string, project: ScratchProject, legacyOnly = false) {
  await page.getByText(/^(File|ファイル)$/u).first().click();
  const chooser = page.waitForEvent('filechooser');
  await page.getByText(/^(Load from your computer|コンピューターから読み込む)$/u).click();
  await (await chooser).setFiles(input);
  return approveVerifiedBlockProject(page, project, legacyOnly);
}

/** Inspect the actual native Blockly root before switching to compatibility diagnostics. */
export async function inspectLoadedEmbeddedYamlRoot(page: Page) {
  await page.locator('[class*="stage-selector_stage-selector_"]').click();
  await page.waitForFunction(() => window.vm.editingTarget?.isStage);
  await page.waitForFunction(() => {
    const stage = window.vm.runtime.getTargetForStage();
    const root = Object.values(stage.blocks._blocks).find((b: any) => b.opcode.endsWith('__embeddedYamlRoot')) as any;
    return !root || Boolean(window.ScratchBlocks.getMainWorkspace().getBlockById(root.id));
  }, undefined, {timeout: 30_000, polling: 250});
  const result = await page.evaluate(() => {
    const workspace = window.ScratchBlocks.getMainWorkspace();
    const roots = workspace.getAllBlocks(false).filter((b: any) => b.type.endsWith('__embeddedYamlRoot'));
    if (!roots.length) return {legacy: true};
    const root = roots[0];
    const reference = root.getFieldValue('DOCUMENT');
    const documents = workspace.getAllBlocks(false).filter((b: any) => b.type.endsWith('__embeddedYaml') && b.getFieldValue('DOCUMENT') === reference);
    return {legacy: false, count: roots.length, version: root.getFieldValue('VERSION'), reference,
      previous: !!root.previousConnection, next: !!root.nextConnection, documentCount: documents.length,
      body: !!documents[0]?.getNextBlock()};
  });
  if (!result.legacy) {
    assert.equal(result.count, 1); assert.equal(result.version, '4.0');
    assert.equal(result.previous, false); assert.equal(result.next, false);
    assert.equal(result.documentCount, 1); assert.equal(result.body, true);
    await page.evaluate(() => {
      const workspace = window.ScratchBlocks.getMainWorkspace();
      const root = workspace.getTopBlocks(false).find((block: any) => block.type.endsWith('__embeddedYamlRoot'));
      const position = root.getRelativeToSurfaceXY();
      const metrics = workspace.getMetrics();
      workspace.scrollbar.set(position.x * workspace.scale - metrics.contentLeft - 30,
        position.y * workspace.scale - metrics.contentTop - 30);
    });
  }
  return result;
}
