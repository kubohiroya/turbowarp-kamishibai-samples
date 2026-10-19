import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir, mkdtemp, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright';
import {strFromU8, unzipSync} from 'fflate';

import {downloadPublishedBlockProject} from './verify-published-block-editor.ts';

const root = path.resolve(import.meta.dirname, '..');
const editorUrl =
  'https://kubohiroya.github.io/turbowarp-extension-data-editor/editor.html?blockEditorDialogs=1&lang=ja';
const options = {
  baseUrl: 'https://kubohiroya.github.io/turbowarp-kamishibai-samples/',
  input: '',
  expectedInput: path.join(root, 'dist/stories/urashima/urashima-blocks-4.0.sb3'),
  outputDirectory: path.join(root, '.tmp/published-block-diagnostics'),
};
for (let i = 2; i < process.argv.length; i += 2) {
  const value = process.argv[i + 1];
  assert(value, `${process.argv[i]} requires a value`);
  if (process.argv[i] === '--input') options.input = path.resolve(value);
  else if (process.argv[i] === '--base-url') options.baseUrl = value;
  else if (process.argv[i] === '--output-dir') options.outputDirectory = path.resolve(value);
  else throw new Error(`Unknown argument: ${process.argv[i]}`);
}
await mkdir(options.outputDirectory, {recursive: true});
const output = await mkdtemp(path.join(options.outputDirectory, 'run-'));
const input =
  options.input ||
  (await downloadPublishedBlockProject({
    ...options,
    outputDirectory: output,
  }));
const inputProject = JSON.parse(strFromU8(unzipSync(await readFile(input))['project.json']));
const allowedSources = new Set(
  Object.values(inputProject.extensionURLs as Record<string, string>)
    .filter((url) => url.startsWith('data:text/javascript;base64,'))
    .map((url) =>
      createHash('sha256')
        .update(Buffer.from(url.split(',')[1], 'base64'))
        .digest('hex'),
    ),
);
const report: Record<string, unknown> = {
  editorUrl,
  input,
  publicInput: !options.input,
  inputSha256: createHash('sha256')
    .update(await readFile(input))
    .digest('hex'),
  cases: [],
};
const browser = await chromium.launch({headless: true});
const context = await browser.newContext({
  locale: 'ja-JP',
  viewport: {width: 1500, height: 1000},
});
await context.addInitScript(() => {
  delete window.showOpenFilePicker;
});
await context.tracing.start({screenshots: true, snapshots: false});
const page = await context.newPage();
page.setDefaultTimeout(30_000);
const errors: string[] = [];
page.on('pageerror', (error) =>
  errors.push(error.message.replace(/data:[^\s)]+/gu, 'data:<embedded>').slice(0, 1000)),
);
let phase = 'load-public-editor';
try {
  await page.goto(editorUrl, {
    waitUntil: 'domcontentloaded',
    timeout: 60_000,
  });
  await page.waitForFunction(() => Boolean(window.vm && window.ScratchBlocks?.getMainWorkspace()));
  await page
    .getByText(/^(File|ファイル)$/u)
    .first()
    .click();
  const chooser = page.waitForEvent('filechooser');
  await page.getByText(/^(Load from your computer|コンピューターから読み込む)$/u).click();
  await (await chooser).setFiles(input);
  for (let permission = 0; permission < 3; permission += 1) {
    await page.waitForFunction(
      () =>
        document.querySelector('[role=dialog]') ||
        window.vm.runtime.targets.some((target: any) =>
          Object.values(target.blocks?._blocks ?? {}).some(
            (block: any) => block.opcode === 'kubohiroyakamishibaiauthoring4_kamishibai',
          ),
        ),
    );
    const dialog = page.getByRole('dialog');
    if (!(await dialog.count())) break;
    const source = await dialog.locator('textarea').inputValue();
    assert(
      allowedSources.has(createHash('sha256').update(source).digest('hex')),
      'Unexpected extension permission request; source must match the verified SB3.',
    );
    await dialog.locator('input[type=checkbox]').check();
    await dialog.locator('button[class*="allow-button"], button[class*="allowButton"]').click();
    await page.waitForTimeout(250);
  }
  await page.waitForFunction(() =>
    window.vm.runtime.targets.some((target: any) =>
      Object.values(target.blocks?._blocks ?? {}).some(
        (block: any) => block.opcode === 'kubohiroyakamishibaiauthoring4_kamishibai',
      ),
    ),
  );
  const cases = [
    {opcode: 'control_if', name: 'もし', expected: 'なら'},
    {opcode: 'control_repeat', name: '回', expected: '繰り返す'},
    {opcode: 'looks_say', name: 'と言う', expected: 'と言う'},
  ];
  for (const scenario of cases) {
    phase = `insert-${scenario.opcode}`;
    const identity = await page.evaluate(() => {
      window.vm.stopAll();
      const stage = window.vm.runtime.getTargetForStage();
      const sprite = window.vm.runtime.targets.find(
        (target: any) => !target.isStage && target.isOriginal,
      );
      if (!sprite) throw new Error('The public story must have a sprite');
      window.vm.setEditingTarget(sprite.id);
      return {
        stageId: stage.id,
        spriteId: sprite.id,
        spriteName: sprite.getName(),
      };
    });
    await page.waitForFunction(
      (spriteId) =>
        window.vm.editingTarget?.id === spriteId &&
        window.ScratchBlocks.getMainWorkspace()
          .getTopBlocks(false)
          .every((block: any) => window.vm.editingTarget.blocks.getBlock(block.id)),
      identity.spriteId,
    );
    const created = await page.evaluate(
      ({opcode, label}) => {
        const workspace = window.ScratchBlocks.getMainWorkspace();
        const make = (type: string) => {
          const block = workspace.newBlock(type);
          block.initSvg();
          block.render();
          return block;
        };
        const text = (block: any, name: string, value: string) => {
          const shadow = make('text');
          shadow.setShadow(true);
          shadow.setFieldValue(value, 'TEXT');
          block.getInput(name).connection.connect(shadow.outputConnection);
        };
        const hat = make('kubohiroyakamishibaiauthoring4_kamishibai');
        text(hat, 'VERSION', '4.0');
        text(hat, 'LABEL', label);
        const scene = make('kubohiroyakamishibaiauthoring4_scene');
        text(scene, 'SCENE', 'diagnosticScene');
        text(scene, 'PROPERTIES', '{}');
        hat.nextConnection.connect(scene.previousConnection);
        const bad = make(opcode);
        scene.getInput('SUBSTACK').connection.connect(bad.previousConnection);
        scene.setCollapsed(true);
        return {hatId: hat.id, sceneId: scene.id, blockId: bad.id};
      },
      {opcode: scenario.opcode, label: `診断確認-${scenario.opcode}`},
    );
    await page.waitForFunction(
      ({spriteId, blockId}) =>
        Boolean(
          window.vm.runtime.targets
            .find((target: any) => target.id === spriteId)
            ?.blocks.getBlock(blockId),
        ),
      {...identity, ...created},
    );
    await page.evaluate((stageId) => window.vm.setEditingTarget(stageId), identity.stageId);
    await page.waitForFunction(() =>
      window.ScratchBlocks.getMainWorkspace()
        .getAllBlocks(false)
        .some(
          (block: any) =>
            block.type === 'kubohiroyakamishibaiauthoring4_kamishibai' &&
            block.getInputTargetBlock('LABEL')?.getFieldValue('TEXT') === '',
        ),
    );
    const includeId = await page.evaluate((label) => {
      const workspace = window.ScratchBlocks.getMainWorkspace();
      const root = workspace
        .getAllBlocks(false)
        .find(
          (block: any) =>
            block.type === 'kubohiroyakamishibaiauthoring4_kamishibai' &&
            block.getInputTargetBlock('LABEL')?.getFieldValue('TEXT') === '',
        );
      if (!root) throw new Error('Missing empty-name root');
      const include = workspace.newBlock('kubohiroyakamishibaiauthoring4_includeBlocks');
      include.initSvg();
      include.render();
      const shadow = workspace.newBlock('text');
      shadow.setShadow(true);
      shadow.initSvg();
      shadow.setFieldValue(label, 'TEXT');
      shadow.render();
      include.getInput('LABEL').connection.connect(shadow.outputConnection);
      const next = root.getNextBlock();
      if (next) next.previousConnection.disconnect();
      root.nextConnection.connect(include.previousConnection);
      if (next) include.nextConnection.connect(next.previousConnection);
      return include.id;
    }, `診断確認-${scenario.opcode}`);
    await page.waitForFunction(
      (id) => Boolean(window.vm.runtime.getTargetForStage().blocks.getBlock(id)),
      includeId,
    );
    await page
      .getByRole('tab', {name: /背景|コスチューム/u})
      .first()
      .click();
    phase = `diagnose-${scenario.opcode}`;
    await page.locator('[class*="green-flag_green-flag"]').first().click();
    const indicator = page.locator('[data-dsl4-runtime-error=true]');
    await indicator.waitFor({state: 'visible'});
    await page.waitForFunction(({name, expected}) => {
      const field = document.querySelector('[data-dsl4-runtime-error-blockName]');
      return field?.textContent?.includes(name) && field.textContent.includes(expected);
    }, scenario);
    const blockName = await indicator.locator('[data-dsl4-runtime-error-blockName]').innerText();
    const targetName = await indicator.locator('[data-dsl4-runtime-error-targetName]').innerText();
    report.lastDiagnostic = {
      blockName,
      targetName,
      text: await indicator.innerText(),
      identity,
      created,
    };
    assert(blockName.includes(scenario.name) && blockName.includes(scenario.expected), blockName);
    assert.equal(targetName, identity.spriteName);
    assert((await indicator.innerText()).includes('K4-BLOCK-SOURCE-GRAPH-001'));
    await page.screenshot({
      path: path.join(output, `${scenario.opcode}-error.png`),
    });
    await indicator.getByRole('button', {name: '該当ブロックを表示', exact: true}).click();
    await page.waitForFunction(
      ({blockId, spriteId}) =>
        window.vm.editingTarget.id === spriteId && window.ScratchBlocks.selected?.id === blockId,
      {...identity, ...created},
    );
    const selected = await page.evaluate(({blockId, sceneId}) => {
      const workspace = window.ScratchBlocks.getMainWorkspace();
      const block = workspace.getBlockById(blockId);
      const rect = block.getSvgRoot().getBoundingClientRect();
      const area = workspace.getInjectionDiv().getBoundingClientRect();
      return {
        selected: block.getSvgRoot().classList.contains('blocklySelected'),
        highlightFilter: getComputedStyle(block.getSvgRoot()).filter,
        highlighted: getComputedStyle(block.getSvgRoot()).filter.includes('drop-shadow'),
        expanded: !workspace.getBlockById(sceneId).isCollapsed(),
        visible:
          rect.width > 0 &&
          rect.height > 0 &&
          rect.left < area.right &&
          rect.right > area.left &&
          rect.top < area.bottom &&
          rect.bottom > area.top,
      };
    }, created);
    assert(selected.selected && selected.highlighted && selected.expanded && selected.visible, JSON.stringify(selected));
    assert.equal(await indicator.isVisible(), false);
    await page.screenshot({
      path: path.join(output, `${scenario.opcode}-selected.png`),
    });
    (report.cases as unknown[]).push({
      ...scenario,
      ...identity,
      ...created,
      blockName,
      targetName,
      ...selected,
    });
    await page.evaluate(
      (id) => window.ScratchBlocks.getMainWorkspace().getBlockById(id).dispose(false),
      created.hatId,
    );
    await page.evaluate((stageId) => window.vm.setEditingTarget(stageId), identity.stageId);
    await page.waitForFunction(
      (id) => Boolean(window.ScratchBlocks.getMainWorkspace().getBlockById(id)),
      includeId,
    );
    await page.evaluate((id) => {
      const block = window.ScratchBlocks.getMainWorkspace().getBlockById(id);
      block.unplug(true);
      block.dispose(false);
    }, includeId);
    await page.waitForFunction(
      (id) => !window.vm.runtime.getTargetForStage().blocks.getBlock(id),
      includeId,
    );
  }
  phase = 'recover-valid-story';
  await page.locator('[class*="green-flag_green-flag"]').first().click();
  await page
    .locator('[data-dsl4-title-action=close]')
    .waitFor({state: 'visible', timeout: 120_000});
  assert.equal(await page.locator('[data-dsl4-runtime-error=true]').isVisible(), false);
  await page.screenshot({
    path: path.join(output, 'valid-story-recovered.png'),
  });
  assert.deepEqual(errors, [], 'Unexpected page errors');
  report.recoveredValidStory = true;
  report.status = 'passed';
} catch (error) {
  report.status = 'failed';
  report.phase = phase;
  report.error = String(error)
    .replace(/data:[^\s)]+/gu, 'data:<embedded>')
    .slice(0, 2000);
  await page.screenshot({path: path.join(output, 'failure.png')}).catch(() => {});
  throw error;
} finally {
  report.pageErrors = errors;
  await writeFile(path.join(output, 'result.json'), JSON.stringify(report, null, 2) + '\n');
  await context.tracing.stop({path: path.join(output, 'trace.zip')});
  await browser.close();
  console.log(`Block diagnostic evidence: ${output}`);
}
