import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir, mkdtemp, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright';
import {strFromU8, unzipSync} from 'fflate';

import {downloadPublishedBlockProject} from './verify-published-block-editor.ts';
import {verifySchemaBlockDiagnostics} from './verify-schema-block-diagnostics.ts';

const root = path.resolve(import.meta.dirname, '..');
const editorUrl =
  'https://kubohiroya.github.io/turbowarp-plus-editor/editor.html?lang=ja';
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
const allowedExtensionIds = Object.keys(inputProject.extensionURLs).filter(
  (id) => inputProject.extensionURLs[id].startsWith('data:text/javascript;base64,'),
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
  const approvedExtensionIds = new Set<string>();
  const permissionChecks: unknown[] = [];
  report.extensionPermissions = permissionChecks;
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
    if (!(await page.getByRole('dialog').count())) break;
    await dialog.waitFor({state: 'visible'});
    const rows = dialog.getByRole('article');
    await rows.first().waitFor({state: 'visible'});
    const count = await rows.count();
    assert(count > 0 && count <= allowedSources.size, 'Unexpected extension permission rows.');
    for (let index = 0; index < count; index += 1) {
      const row = rows.nth(index);
      const rowText = await row.innerText();
      const ids = allowedExtensionIds.filter((id) => rowText.includes(id));
      assert.equal(ids.length, 1, 'Permission must identify an extension in the verified input.');
      const id = ids[0]!;
      assert(!approvedExtensionIds.has(id), 'Duplicate extension permission request.');
      const details = row.getByRole('button', {name: /^(詳細|Details)$/u});
      let dialogSourceChecked = false;
      if (await details.count()) {
        await details.click();
        const source = await row.locator('textarea[readonly]').inputValue();
        const expected = Buffer.from(inputProject.extensionURLs[id].split(',')[1], 'base64');
        assert.equal(
          createHash('sha256').update(source).digest('hex'),
          createHash('sha256').update(expected).digest('hex'),
          'Extension permission source must match its ID in the verified SB3.',
        );
        dialogSourceChecked = true;
      }
      // Current Plus Editor identifies the extensions loaded from the verified local SB3.
      await row.getByRole('radio', {name: /サンドボックスなし$/u}).check();
      approvedExtensionIds.add(id);
      permissionChecks.push({id, verifiedInput: true, dialogSourceChecked});
    }
    await dialog.getByRole('button', {name: 'OK', exact: true}).click();
    await dialog.waitFor({state: 'hidden'});
  }
  assert.equal(approvedExtensionIds.size, allowedExtensionIds.length);
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
    const blockName = await indicator.locator('[data-dsl4-runtime-error-blockName]').textContent() ?? '';
    const targetName = await indicator.locator('[data-dsl4-runtime-error-targetName]').textContent() ?? '';
    const explanation = await indicator.locator('[data-dsl4-runtime-error-message]').innerText();
    const place = await indicator.locator('[data-dsl4-runtime-error-where]').innerText();
    const recovery = await indicator.locator('[data-dsl4-runtime-error-recovery]').innerText();
    const technical = indicator.locator('[data-dsl4-runtime-error-technical]');
    assert.equal(await technical.evaluate((element) => (element as HTMLDetailsElement).open), false);
    assert(explanation.includes('台本として読み取れない'), explanation);
    assert(place.includes(identity.spriteName) && place.includes(blockName), place);
    assert(recovery.includes('接続') && recovery.includes('対応ブロック'), recovery);
    assert.equal(await indicator.getByRole('button', {name: '診断情報をコピー', exact: true}).isVisible(), true);
    report.lastDiagnostic = {
      blockName,
      targetName,
      explanation,
      place,
      recovery,
      text: await indicator.innerText(),
      identity,
      created,
    };
    assert(blockName.includes(scenario.name) && blockName.includes(scenario.expected), blockName);
    assert.equal(targetName, identity.spriteName);
    await page.screenshot({
      path: path.join(output, `${scenario.opcode}-error.png`),
    });
    await technical.locator('summary').click();
    assert.equal(await indicator.locator('[data-dsl4-runtime-error-code]').innerText(), 'K4-BLOCK-SOURCE-GRAPH-001');
    assert.equal(await indicator.locator('[data-dsl4-runtime-error-blockName]').innerText(), blockName);
    assert.equal(await indicator.locator('[data-dsl4-runtime-error-targetName]').innerText(), targetName);
    await page.screenshot({path: path.join(output, `${scenario.opcode}-details.png`)});
    await technical.locator('summary').click();
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
      explanation,
      place,
      recovery,
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
  await verifySchemaBlockDiagnostics(page, output, report, (next) => {
    phase = next;
  });
  phase = 'recover-valid-story';
  await page.locator('[class*="green-flag_green-flag"]').first().click();
  await page
    .locator('[data-dsl4-title-action=close]')
    .waitFor({state: 'visible', timeout: 120_000});
  assert.equal(await page.locator('[data-dsl4-runtime-error=true]').isVisible(), false);
  const appRelease = JSON.parse(await readFile(path.join(root, 'app-release.json'), 'utf8'));
  const renderedTitle = await page.evaluate(() => {
    const stage = window.vm.runtime.getTargetForStage();
    const costume = stage.sprite.costumes[stage.currentCostume];
    return {costume: costume.name, text: costume.asset.decodeText()};
  });
  assert.match(renderedTitle.costume, /^Title(?:Runtime)?$/u);
  assert.match(renderedTitle.text, /TurboWarp Kamishibai|TurboWarp紙芝居/u);
  assert(!renderedTitle.text.includes('Participatory AI Kamishibai'));
  assert(renderedTitle.text.includes(appRelease.version));
  report.title = {costume: renderedTitle.costume, version: appRelease.version, currentName: true};
  await page.screenshot({
    path: path.join(output, 'valid-story-recovered.png'),
  });
  assert.deepEqual(errors, [], 'Unexpected page errors');
  assert.equal(
    createHash('sha256').update(await readFile(input)).digest('hex'),
    report.inputSha256,
    'Browser fixtures must not change the input SB3.',
  );
  report.recoveredValidStory = true;
  report.status = 'passed';
} catch (error) {
  report.status = 'failed';
  report.phase = phase;
  report.failedSelection = await page
    .evaluate(() => ({
      targetId: window.vm?.editingTarget?.id ?? null,
      targetName: window.vm?.editingTarget?.getName() ?? null,
      blockId: window.ScratchBlocks?.selected?.id ?? null,
    }))
    .catch(() => null);
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
