/**
 * Rehearse the assistant's workshop integration in TurboWarp Plus Editor (external YAML version):
 * open the workshop SB3, upload a participant's two costumes to Suitor, compose the story YAML
 * from a board submission, open it from the story menu, and play into the participant scene.
 *
 * Teachable Machine is replaced by a routed local model, so no participant photo or network
 * model is needed. The template pose `kime` is renamed to a class of that substitute model.
 */
import assert from 'node:assert/strict';
import {copyFile, mkdir, mkdtemp, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

import {chromium, type Page} from 'playwright';
import {strFromU8, unzipSync} from 'fflate';

import {editorControlClick, openBlockEditor} from './block-diagnostic-fixture.ts';
import {sampleSubmission} from './build-tekona.ts';
import type {ScratchProject} from './scratch.ts';
import {
  composeParticipants,
  parseSubmission,
} from '../resources/tekona-workshop/assistant/compose-participants.js';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const editorUrl = process.env.TURBOWARP_PLUS_EDITOR_URL ??
  'https://kubohiroya.github.io/turbowarp-plus-editor/editor.html?lang=en&twPlusYamlEditor=1&twPlusStandardLayout=0';
const substituteModel = path.join(projectRoot, 'stories/urashima/pose-models/3and4');
const substitutePose = 'dance1';

function options() {
  const result = {
    input: path.join(projectRoot, 'stories/tekona/tekona-workshop-4.0.sb3'),
    images: '',
    outputDirectory: path.join(projectRoot, '.tmp/tekona-workshop-editor'),
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

/** Use the costume tab's upload control, as the assistant does with files from the board. */
async function uploadCostumes(page: Page, files: string[]) {
  await page.evaluate(() => {
    const suitor = window.vm.runtime.targets.find((target: any) => target.getName() === 'Suitor');
    window.vm.setEditingTarget(suitor.id);
  });
  await page.getByRole('tab', {name: /コスチューム|Costumes/u}).click(editorControlClick);
  for (const file of files) {
    const before = await page.evaluate(() => window.vm.editingTarget.getCostumes().length);
    await page.locator('[aria-label="Choose a Costume"]').first().hover();
    const upload = page.locator('[aria-label="Upload Costume"]').first();
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), upload.click(editorControlClick)]);
    await chooser.setFiles(file);
    await page.waitForFunction((before) => window.vm.editingTarget.getCostumes().length === before + 1, before,
      {timeout: 30_000});
  }
  return page.evaluate(() => window.vm.editingTarget.getCostumes().map((costume: any) => costume.name));
}

/** Open an SB3 from the File menu and allow its embedded extensions without sandbox. */
async function loadWorkshopProject(page: Page, input: string) {
  await page.evaluate(() => {
    (window as any).__tekonaLoaded = false;
    window.vm.runtime.once('PROJECT_LOADED', () => { (window as any).__tekonaLoaded = true; });
  });
  await page.getByText(/^(File|ファイル)$/u).first().click(editorControlClick);
  const open = page.getByText(/^(?:Open SB3 File…|SB3ファイルを開く…|Load from your computer|コンピューターから読み込む)$/u)
    .filter({visible: true});
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), open.click(editorControlClick)]);
  await chooser.setFiles(input);
  let approvals = 0;
  const deadline = Date.now() + 180_000;
  const loaded = () => page.evaluate(() => (window as any).__tekonaLoaded &&
    window.vm.runtime.targets.some((target: any) => target.getName() === 'Suitor'));
  while (!await loaded()) {
    assert(Date.now() < deadline, 'The workshop SB3 did not finish loading.');
    const dialog = page.getByRole('dialog').filter({has: page.getByRole('button', {name: /^(OK|Allow|許可)$/u})});
    if (await dialog.count() && await dialog.first().isVisible()) {
      assert(approvals++ < 12, 'Too many extension permission dialogs.');
      for (const choice of await dialog.locator('input[type="radio"][value="unsandboxed"]').all())
        if (!await choice.isChecked()) await choice.check();
      const checkbox = dialog.getByLabel(/Run without sandbox|サンドボックスなしで実行する/u);
      if (await checkbox.count()) await checkbox.first().check();
      await dialog.getByRole('button', {name: /^(OK|Allow|許可)$/u}).first().click(editorControlClick);
    }
    await page.waitForTimeout(500);
  }
  return approvals;
}

async function main() {
  const {input, images, outputDirectory: root} = options();
  await mkdir(root, {recursive: true});
  const outputDirectory = await mkdtemp(path.join(root, 'run-'));
  const submission = parseSubmission(sampleSubmission);
  const nn = submission.nn;
  const costumeFiles = [];
  for (const kind of ['stand', 'pose']) {
    const target = path.join(outputDirectory, `s${nn}-${kind}${images ? '.png' : '.svg'}`);
    await copyFile(
      images ? path.join(images, `s${nn}-${kind}.png`)
        : path.join(projectRoot, `stories/tekona/assets/newcomer-${kind}.svg`),
      target,
    );
    costumeFiles.push(target);
  }
  const storyPath = path.join(outputDirectory, 'tekona.k4.yml');
  // The substitute model only knows its own classes; rename the prepared suitors' poses too.
  const half = (await readFile(path.join(projectRoot, 'stories/tekona/tekona.k4.yml'), 'utf8'))
    .replace('pose: heart', `pose: ${substitutePose}`)
    .replace('pose: offer', `pose: ${substitutePose}`)
    .replace('pose: wide', `pose: ${substitutePose}`);
  await writeFile(storyPath, composeParticipants(half, [submission], {pose: substitutePose}));
  const browser = await chromium.launch({
    args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
  });
  const report: Record<string, unknown> = {input, editorUrl, participant: nn};
  try {
    const context = await browser.newContext({
      locale: 'en-US', viewport: {width: 1500, height: 1000}, permissions: ['camera'],
    });
    // Native file inputs exercise the GUI's supported fallback without OS picker dialogs.
    await context.addInitScript(() => {
      delete (window as any).showOpenFilePicker;
      delete (window as any).showSaveFilePicker;
    });
    // Serve the substitute model for every Teachable Machine model URL of the story.
    await context.route(/https:\/\/teachablemachine\.withgoogle\.com\/models\/[^/]+\/(model\.json|metadata\.json|weights\.bin)(\?.*)?$/u,
      async (route) => {
        const name = new URL(route.request().url()).pathname.split('/').pop()!;
        await route.fulfill({body: await readFile(path.join(substituteModel, name)),
          contentType: name.endsWith('.bin') ? 'application/octet-stream' : 'application/json',
          headers: {'access-control-allow-origin': '*'}});
      });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(String(error).slice(0, 500)));
    await openBlockEditor(page, editorUrl);
    await page.waitForFunction(() => Boolean(window.vm && window.ScratchBlocks?.getMainWorkspace()), undefined,
      {timeout: 120_000});
    report.extensionApprovals = await loadWorkshopProject(page, input);

    let started = Date.now();
    report.suitorCostumes = await uploadCostumes(page, costumeFiles);
    assert((report.suitorCostumes as string[]).includes(`s${nn}-stand`));
    assert((report.suitorCostumes as string[]).includes(`s${nn}-pose`));
    report.uploadSeconds = (Date.now() - started) / 1000;

    // Return Suitor to its initial hidden state; the costume tab selected the last upload.
    await page.evaluate(() => {
      const suitor = window.vm.runtime.targets.find((target: any) => target.getName() === 'Suitor');
      suitor.setVisible(false);
      suitor.setCostume(0);
      window.vm.setEditingTarget(window.vm.runtime.getTargetForStage().id);
    });
    // Start, close the title, then open the composed YAML from the story menu.
    await page.locator('[class*="green-flag_green-flag"]').first().click(editorControlClick);
    const close = page.locator('[data-dsl4-title-action=close]');
    await close.waitFor({state: 'visible', timeout: 60_000});
    await close.click(editorControlClick);
    await page.waitForFunction(
      () => document.querySelector<HTMLElement>('[data-dsl4-application-menu=true]')?.style.display === 'block',
      undefined, {timeout: 60_000});
    // Edge provides the File System Access picker; hand it the composed YAML as the chosen file.
    await page.evaluate((text) => {
      (window as any).showOpenFilePicker = async () => [{
        kind: 'file', name: 'tekona.k4.yml',
        getFile: async () => new File([text], 'tekona.k4.yml', {type: 'application/yaml'}),
      }];
    }, await readFile(storyPath, 'utf8'));
    await page.locator('[data-dsl4-menu-action=open]').click(editorControlClick);
    const chooser = page.locator('[data-dsl4-source-chooser=true]');
    await chooser.waitFor({state: 'visible', timeout: 30_000});
    started = Date.now();
    await chooser.locator('[data-dsl4-source-choice=file]').click(editorControlClick);

    const stageCanvas = page.locator('canvas').first();
    const runtimeError = page.locator('[data-dsl4-runtime-error=true]');
    const stage = page.locator('[class*="stage-wrapper"], [class*="stage_stage"]').first();
    const frames = path.join(outputDirectory, 'frames');
    await mkdir(frames, {recursive: true});
    const deadline = Date.now() + 240_000;
    let frame = 0;
    await page.waitForTimeout(2_000);
    while (Date.now() < deadline) {
      if (await runtimeError.isVisible()) {
        report.runtimeError = await runtimeError.innerText();
        break;
      }
      await stage.screenshot({path: path.join(frames, `${String(frame++).padStart(3, '0')}.png`)});
      // The story returns to the application menu after its last scene.
      const menu = await page.evaluate(() =>
        document.querySelector<HTMLElement>('[data-dsl4-application-menu=true]')?.style.display === 'block');
      if (menu && frame > 5) break;
      // Skip only pose recognition; every scene plays in its written order.
      await stageCanvas.focus().catch(() => undefined);
      await page.keyboard.press('Space');
      await page.waitForTimeout(1_500);
    }
    // The frames are the visual evidence that the participant scene plays before `quarrel`.
    report.playback = {frames: frame, seconds: (Date.now() - started) / 1000, framesDirectory: frames};
    assert(!report.runtimeError, `Story failed: ${report.runtimeError}`);
    assert(frame > 5, 'The story must play.');
    // The assistant's saved SB3 must keep the uploaded costumes for the next composition.
    const bytes = await page.evaluate(async () => {
      const blob = await window.vm.saveProjectSb3();
      return [...new Uint8Array(await blob.arrayBuffer())];
    });
    const saved = JSON.parse(strFromU8(unzipSync(Uint8Array.from(bytes))['project.json']!)) as ScratchProject;
    const suitor = saved.targets.find((target) => target.name === 'Suitor');
    assert(suitor?.costumes.some((costume) => costume.name === `s${nn}-pose`),
      'The saved shared SB3 must keep the participant costumes.');
    await writeFile(path.join(outputDirectory, 'tekona-shared.sb3'), Uint8Array.from(bytes));
    report.pageErrors = errors;
    report.status = 'passed';
  } catch (error) {
    for (const page of browser.contexts().flatMap((context) => context.pages()))
      await page.screenshot({path: path.join(outputDirectory, 'failure.png')}).catch(() => undefined);
    report.error = String(error).slice(0, 2000);
    throw error;
  } finally {
    await writeFile(path.join(outputDirectory, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
    await browser.close();
  }
  console.log(`Tekona workshop integration rehearsal passed: ${outputDirectory}`);
}

await main();
