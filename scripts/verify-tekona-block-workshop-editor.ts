/**
 * Rehearse the assistant's block-script workshop integration in TurboWarp Plus Editor:
 * replace a pre-registered slot's placeholder costumes and model URL, fill its texts, turn its
 * `if` condition to true, reflect the document, play the story, then save and read it back.
 *
 * Teachable Machine is replaced by a routed local four-class model whose labels are rewritten
 * per URL, so the story's pose names stay unchanged and no participant photo is needed.
 */
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {copyFile, mkdir, mkdtemp, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

import {chromium, type Page} from 'playwright';
import {parse} from 'yaml';
import {strFromU8, unzipSync} from 'fflate';

import {editorControlClick, loadVerifiedBlockProject, openBlockEditor} from './block-diagnostic-fixture.ts';
import {sampleSubmission} from './build-tekona.ts';
import type {ScratchProject} from './scratch.ts';
import {parseSubmission} from '../resources/tekona-workshop/assistant/compose-participants.js';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const editorUrl = process.env.TURBOWARP_PLUS_EDITOR_URL ??
  'https://kubohiroya.github.io/turbowarp-plus-editor/editor.html?lang=en&twPlusYamlEditor=1&twPlusStandardLayout=0';
const appRoot = path.resolve(
  process.env.TURBOWARP_KAMISHIBAI_APP_ROOT ?? path.join(projectRoot, '../turbowarp-kamishibai-app'),
);
const substituteModel = path.join(projectRoot, 'stories/urashima/pose-models/3and4');

function options() {
  const result = {
    input: path.join(projectRoot, 'stories/tekona/tekona-workshop-blocks-4.0.sb3'),
    images: '',
    outputDirectory: path.join(projectRoot, '.tmp/tekona-block-workshop-editor'),
  };
  const args = process.argv.slice(2).filter((arg) => arg !== '--');
  for (let i = 0; i < args.length; i += 2) {
    const value = args[i + 1];
    assert(value, `${args[i]} requires a value.`);
    if (args[i] === '--input') result.input = path.resolve(value);
    else if (args[i] === '--images') result.images = path.resolve(value);
    else if (args[i] === '--output-dir') result.outputDirectory = path.resolve(value);
    else throw new Error(`Unknown argument: ${args[i]}`);
  }
  return result;
}

/** Upload the replacement, delete the placeholder, and give the upload the placeholder's name. */
async function replaceCostumes(page: Page, files: {name: string; file: string}[]) {
  await page.evaluate(() => {
    const suitor = window.vm.runtime.targets.find((target: any) => target.getName() === 'Suitor');
    window.vm.setEditingTarget(suitor.id);
  });
  await page.getByRole('tab', {name: /コスチューム|Costumes/u}).click(editorControlClick);
  for (const {name, file} of files) {
    const before = await page.evaluate(() => window.vm.editingTarget.getCostumes().length);
    await page.locator('[aria-label="Choose a Costume"]').first().hover();
    const upload = page.locator('[aria-label="Upload Costume"]').first();
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), upload.click(editorControlClick)]);
    await chooser.setFiles(file);
    await page.waitForFunction((before) => window.vm.editingTarget.getCostumes().length === before + 1, before,
      {timeout: 30_000});
    // Same as the costume tab's "delete" on the placeholder and typing its name into the upload.
    await page.evaluate((name) => {
      const target = window.vm.editingTarget;
      const names = () => target.getCostumes().map((costume: any) => costume.name);
      const placeholder = names().indexOf(name);
      if (placeholder < 0) throw new Error(`Placeholder costume ${name} is missing.`);
      window.vm.deleteCostume(placeholder);
      window.vm.renameCostume(target.getCostumes().length - 1, name);
      if (names().filter((value: string) => value === name).length !== 1)
        throw new Error(`Costume ${name} must remain unique.`);
    }, name);
  }
  return page.evaluate(() => window.vm.editingTarget.getCostumes().map((costume: any) => costume.name));
}

/** Fill the slot's text placeholders, model URL and condition through its Blockly inputs. */
async function fillSlot(page: Page, nn: string, values: Record<string, string>, modelUrl: string) {
  await page.evaluate(() => window.vm.setEditingTarget(window.vm.runtime.getTargetForStage().id));
  await page.getByRole('tab', {name: /コード|Code/u}).click(editorControlClick);
  await page.waitForFunction(() => window.ScratchBlocks.getMainWorkspace().getTopBlocks(false).length > 0);
  return page.evaluate(({nn, values, modelUrl}) => {
    const workspace = window.ScratchBlocks.getMainWorkspace();
    const all = workspace.getAllBlocks(false);
    const textOf = (block: any, input: string) => block.getInputTargetBlock(input);
    const scene = all.find((block: any) => block.type === 'kubohiroyakamishibaiauthoring4_scene' &&
      textOf(block, 'SCENE')?.getFieldValue('TEXT') === `suitor-${nn}`);
    if (!scene) throw new Error(`Slot suitor-${nn} is missing.`);
    const changed: string[] = [];
    // Only the slot's own statements: the scene's next blocks are the following scenes.
    const body = scene.getInputTargetBlock('SUBSTACK');
    for (const block of body ? body.getDescendants(false) : []) {
      if (block.type === 'kubohiroyakamishibaiauthoring4_narrativeIf') {
        textOf(block, 'CONDITION').setFieldValue('true', 'TEXT');
        changed.push('condition');
      }
      if (block.type !== 'text') continue;
      const before = String(block.getFieldValue('TEXT'));
      const after = before.replace(/（([^）]+)）/gu, (whole: string, label: string) => values[label] ?? whole);
      if (after !== before) {
        block.setFieldValue(after, 'TEXT');
        changed.push(before);
      }
    }
    if (!modelUrl) return changed;
    const model = all.find((block: any) => block.type === 'kubohiroyakamishibaiauthoring4_asset' &&
      textOf(block, 'NAME')?.getFieldValue('TEXT') === `Pose${nn}`);
    const value = textOf(model, 'VALUE');
    const declaration = JSON.parse(value.getFieldValue('TEXT'));
    declaration.source.url = modelUrl;
    value.setFieldValue(JSON.stringify(declaration), 'TEXT');
    changed.push('model');
    return changed;
  }, {nn, values, modelUrl});
}

/** Reflect the edited blocks into the story document: hat icon → "convert, validate and save". */
async function reflectDocument(page: Page, evidence: string) {
  const before = await page.evaluate(() => {
    const workspace = window.ScratchBlocks.getMainWorkspace();
    const hat = workspace.getTopBlocks(false).find((block: any) => block.type.endsWith('__embeddedYaml'));
    const position = hat.getRelativeToSurfaceXY();
    const metrics = workspace.getMetrics();
    workspace.scrollbar.set(position.x * workspace.scale - metrics.contentLeft - 30,
      position.y * workspace.scale - metrics.contentTop - 30);
    const owner = window.vm.runtime.extensionStorage.kubohiroyakamishibai4.components.kubohiroyakamishibairuntime4;
    return {id: hat.id, filename: owner.sourceDocuments.entryPath,
      source: owner.sourceDocuments.files[owner.sourceDocuments.entryPath].source};
  });
  await page.waitForFunction((id) => window.ScratchBlocks.getMainWorkspace().getBlockById(id)
    ?.inputList?.[0]?.fieldRow?.[0]?.fieldGroup_?.hasAttribute('data-twpe-yaml-hat-icon'), before.id);
  const point = await page.evaluate((id) => {
    const rect = window.ScratchBlocks.getMainWorkspace().getBlockById(id).inputList[0].fieldRow[0].fieldGroup_
      .getBoundingClientRect();
    return {x: rect.x + rect.width / 2, y: rect.y + rect.height / 2};
  }, before.id);
  await page.mouse.click(point.x, point.y);
  const saveButton = {name: /^(Convert, validate and save the displayed format|表示されている形式に変換して検証・保存)$/u};
  const dialog = page.getByRole('dialog').filter({has: page.getByRole('button', saveButton)});
  await dialog.waitFor({timeout: 60_000});
  try {
    await page.waitForFunction(() => !document.querySelector<HTMLButtonElement>('button.twpe-yaml-save')?.disabled,
      undefined, {timeout: 60_000});
  } catch (error) {
    await page.screenshot({path: path.join(evidence, 'document-dialog.png')});
    throw new Error(`Document save stayed disabled: ${(await dialog.innerText()).slice(0, 1500)}`, {cause: error});
  }
  await dialog.getByRole('button', saveButton).click(editorControlClick);
  const outcome = await (await page.waitForFunction(({filename, original}) => {
    const owner = window.vm.runtime.extensionStorage.kubohiroyakamishibai4.components.kubohiroyakamishibairuntime4;
    const error = document.querySelector('.twpe-yaml-error')?.textContent;
    if (error) return {error};
    const source = owner.sourceDocuments.files[filename].source;
    return source !== original ? {source} : false;
  }, {filename: before.filename, original: before.source}, {timeout: 120_000, polling: 250})).jsonValue() as
    {error?: string; source?: string};
  assert(!outcome.error, `Document save failed: ${outcome.error}`);
  await dialog.waitFor({state: 'hidden', timeout: 60_000});
  return parse(outcome.source!);
}

async function main() {
  const {input, images, outputDirectory: root} = options();
  await mkdir(root, {recursive: true});
  const outputDirectory = await mkdtemp(path.join(root, 'run-'));
  const submission = parseSubmission(sampleSubmission);
  const nn = submission.nn;
  const costumes = [];
  for (const kind of ['stand', 'pose']) {
    const file = path.join(outputDirectory, `s${nn}-${kind}${images ? '.png' : '.svg'}`);
    await copyFile(images ? path.join(images, `s${nn}-${kind}.png`)
      : path.join(projectRoot, `stories/tekona/assets/${kind === 'stand' ? 'kokufu' : 'miyako'}-${kind}.svg`), file);
    costumes.push({name: `s${nn}-${kind}`, file});
  }
  const values: Record<string, string> = {
    作者の名前: submission.author!, 求婚者の名前: submission.name!, 決めポーズの説明: submission.hint!,
    求婚の言葉: submission.proposal!, 手児奈のことわりの言葉: submission.refusal!, ことわられたときのひとこと: submission.after!,
  };
  const project = JSON.parse(strFromU8(unzipSync(await readFile(input))['project.json']!)) as ScratchProject;
  const browser = await chromium.launch({
    args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
  });
  const report: Record<string, unknown> = {input, editorUrl, participant: nn};
  try {
    const context = await browser.newContext({
      locale: 'en-US', viewport: {width: 1500, height: 1000}, permissions: ['camera'],
    });
    await context.addInitScript(() => {
      delete (window as any).showOpenFilePicker;
      delete (window as any).showSaveFilePicker;
    });
    const metadata = JSON.parse(await readFile(path.join(substituteModel, 'metadata.json'), 'utf8'));
    await context.route(/https:\/\/teachablemachine\.withgoogle\.com\/models\/([^/]+)\/(model\.json|metadata\.json|weights\.bin)(\?.*)?$/u,
      async (route) => {
        const [, id, name] = /models\/([^/]+)\/([^/?]+)/u.exec(route.request().url())!;
        const labels = id === 'REPLACE-WITH-YOUR-MODEL' ? ['stand', 'heart', 'offer', 'wide'] : ['stand', 'kime', 'other1', 'other2'];
        const body = name === 'metadata.json' ? JSON.stringify({...metadata, labels})
          : await readFile(path.join(substituteModel, name));
        await route.fulfill({body, contentType: name.endsWith('.bin') ? 'application/octet-stream' : 'application/json',
          headers: {'access-control-allow-origin': '*'}});
      });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(String(error).slice(0, 500)));
    await openBlockEditor(page, editorUrl);
    await page.waitForFunction(() => Boolean(window.vm && window.ScratchBlocks?.getMainWorkspace()), undefined,
      {timeout: 120_000});
    await loadVerifiedBlockProject(page, input, project);

    let started = Date.now();
    report.suitorCostumes = await replaceCostumes(page, costumes);
    // rc.79 cannot reflect a changed remote model URL ("Remote asset source does not match"), so the
    // slot keeps its pre-registered URL. TEKONA_REPLACE_MODEL_URL=1 re-checks the replacement.
    const replaceModel = Boolean(process.env.TEKONA_REPLACE_MODEL_URL);
    report.replaceModel = replaceModel;
    report.changed = await fillSlot(page, nn, values, replaceModel ? submission.model! : '');
    const reflected = await reflectDocument(page, outputDirectory);
    report.integrationSeconds = (Date.now() - started) / 1000;
    const scenes = Object.keys(reflected.scenes);
    report.reflectedOrder = scenes.slice(scenes.indexOf('proposals'), scenes.indexOf('proposals') + 3);
    assert.deepEqual(report.reflectedOrder, ['proposals', `suitor-${nn}`, 'suitor-02']);
    if (replaceModel) assert.equal(reflected.assets[`Pose${nn}`].source.url, submission.model);

    // Play: close the title, skip poses with Space, and keep stage frames as visual evidence.
    await page.evaluate(() => {
      const suitor = window.vm.runtime.targets.find((target: any) => target.getName() === 'Suitor');
      suitor.setVisible(false);
      suitor.setCostume(0);
    });
    await page.locator('[class*="green-flag_green-flag"]').first().click(editorControlClick);
    const close = page.locator('[data-dsl4-title-action=close]');
    await close.waitFor({state: 'visible', timeout: 60_000});
    await close.click(editorControlClick);
    started = Date.now();
    const stageCanvas = page.locator('canvas').first();
    const runtimeError = page.locator('[data-dsl4-runtime-error=true]');
    const stage = page.locator('[class*="stage-wrapper"], [class*="stage_stage"]').first();
    const frames = path.join(outputDirectory, 'frames');
    await mkdir(frames, {recursive: true});
    const deadline = Date.now() + 300_000;
    let frame = 0;
    while (Date.now() < deadline) {
      if (await runtimeError.isVisible()) {
        report.runtimeError = await runtimeError.innerText();
        break;
      }
      await stage.screenshot({path: path.join(frames, `${String(frame++).padStart(3, '0')}.png`)});
      const menu = await page.evaluate(() =>
        document.querySelector<HTMLElement>('[data-dsl4-application-menu=true]')?.style.display === 'block');
      if (menu && frame > 5) break;
      await stageCanvas.focus().catch(() => undefined);
      await page.keyboard.press('Space');
      await page.waitForTimeout(1_500);
    }
    report.playback = {frames: frame, seconds: (Date.now() - started) / 1000, framesDirectory: frames};
    assert(!report.runtimeError, `Story failed: ${report.runtimeError}`);

    // The saved SB3 must read back with the filled slot and the replaced costumes.
    const bytes = await page.evaluate(async () => {
      const blob = await window.vm.saveProjectSb3();
      return [...new Uint8Array(await blob.arrayBuffer())];
    });
    const saved = path.join(outputDirectory, 'tekona-shared-blocks.sb3');
    await writeFile(saved, Uint8Array.from(bytes));
    const exported = path.join(outputDirectory, 'exported');
    const result = spawnSync(process.execPath, [path.join(appRoot, 'bin/turbowarp-kamishibai.mjs'),
      'export-block-dsl', '--input', saved, '--output-dir', exported, '--name', 'tekona'], {encoding: 'utf8'});
    assert.equal(result.status, 0, result.stdout + result.stderr);
    const story = parse(await readFile(path.join(exported, 'tekona.k4.yml'), 'utf8'));
    const slot = story.scenes[`suitor-${nn}`];
    assert.equal(slot.actions[0].if.condition, true);
    assert.equal(story.scenes['suitor-02'].actions[0].if.condition, false);
    report.status = 'passed';
    report.pageErrors = errors;
  } catch (error) {
    for (const page of browser.contexts().flatMap((context) => context.pages()))
      await page.screenshot({path: path.join(outputDirectory, 'failure.png')}).catch(() => undefined);
    report.error = String(error).slice(0, 2000);
    throw error;
  } finally {
    await writeFile(path.join(outputDirectory, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
    await browser.close();
  }
  console.log(`Tekona block workshop rehearsal passed: ${outputDirectory}`);
}

await main();
