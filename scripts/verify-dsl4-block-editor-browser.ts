import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdir, mkdtemp, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

import {chromium, type Browser, type BrowserContext, type Page} from 'playwright';
import {parse, stringify} from 'yaml';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const editorUrl = 'https://turbowarp.org/editor';
const authoringScene = 'kubohiroyakamishibaiauthoring4_scene';
const actionPrefix = 'kubohiroyakamishibai4_kubohiroyakamishibairuntime4__';
const editedSeconds = '2.75';

function argumentsFromCli(): {input: string; outputDirectory: string} {
  const options = {
    input: path.join(projectRoot, 'dist/stories/urashima/urashima-blocks-4.0.sb3'),
    outputDirectory: path.join(projectRoot, '.tmp/block-editor-browser'),
  };
  for (let i = 2; i < process.argv.length; i += 2) {
    const flag = process.argv[i];
    const value = process.argv[i + 1];
    assert(value, `${flag} requires a path.`);
    if (flag === '--input') options.input = path.resolve(value);
    else if (flag === '--output-dir') options.outputDirectory = path.resolve(value);
    else throw new Error(`Unknown argument: ${flag}`);
  }
  return options;
}

function conciseFailure(value: unknown): string {
  return String(value)
    .replace(/data:[^\s)]+/gu, 'data:<embedded-extension>')
    .slice(0, 1800);
}

function builderOutput(arguments_: string[]): string {
  const builderRoot = path.resolve(
    process.env.TURBOWARP_KAMISHIBAI_BLOCK_AUTHORING_ROOT ??
      process.env.TURBOWARP_KAMISHIBAI_APP_ROOT ??
      path.join(projectRoot, '../turbowarp-kamishibai-app'),
  );
  const result = spawnSync(
    process.execPath,
    [path.join(builderRoot, 'bin/turbowarp-kamishibai.mjs'), ...arguments_],
    {encoding: 'utf8', timeout: 30_000},
  );
  if (result.error) throw result.error;
  assert.equal(result.status, 0, conciseFailure(result.stdout + result.stderr));
  return result.stdout;
}

interface SceneEvidence {
  id: string;
  name: string;
  commands: number;
}

async function alignScene(page: Page, id: string): Promise<void> {
  await page.evaluate((id) => {
    const workspace = window.ScratchBlocks.getMainWorkspace();
    const block = workspace.getBlockById(id);
    const position = block.getRelativeToSurfaceXY();
    const metrics = workspace.getMetrics();
    workspace.scrollbar.set(
      position.x * workspace.scale - metrics.contentLeft - 30,
      position.y * workspace.scale - metrics.contentTop - 30,
    );
  }, id);
}

const options = argumentsFromCli();
await mkdir(options.outputDirectory, {recursive: true});
const outputDirectory = await mkdtemp(path.join(options.outputDirectory, 'run-'));
const consoleErrors: string[] = [];
const fatalErrors: string[] = [];
const report: Record<string, unknown> = {editorUrl, input: options.input, outputDirectory};
let phase = 'read-input';
let browser: Browser | undefined;
let context: BrowserContext | undefined;
let page: Page | undefined;
let failure: unknown;

try {
  const inputBytes = await readFile(options.input);
  report.inputSha256 = createHash('sha256').update(inputBytes).digest('hex');
  const story = parse(
    await readFile(path.join(projectRoot, 'stories/urashima/urashima.k4.yml'), 'utf8'),
  );
  const expectedScenes = Object.entries(story.scenes).map(([name, scene]: [string, any]) => ({
    name,
    commands: (Array.isArray(scene) ? scene : scene.actions).length,
  }));
  assert.equal(expectedScenes.length, 10);
  assert.equal(
    expectedScenes.reduce((total, scene) => total + scene.commands, 0),
    174,
  );

  phase = 'launch-editor';
  browser = await chromium.launch({headless: true});
  context = await browser.newContext({locale: 'en-US', viewport: {width: 1500, height: 1000}});
  // Native file inputs/downloads exercise the GUI's supported fallback without OS picker dialogs.
  await context.addInitScript(() => {
    delete window.showOpenFilePicker;
    delete window.showSaveFilePicker;
  });
  // DOM snapshots of permission dialogs contain the entire embedded runtime. Capture actions and
  // screenshots instead, so a trace does not duplicate megabytes of extension source per action.
  await context.tracing.start({screenshots: true, snapshots: false});
  page = await context.newPage();
  page.setDefaultTimeout(15_000);
  page.setDefaultNavigationTimeout(60_000);
  let rejectFatal: (error: Error) => void = () => {};
  const fatal = new Promise<never>((_, reject) => {
    rejectFatal = reject;
  });
  void fatal.catch(() => {});
  page.on('pageerror', (error) => {
    const message = conciseFailure(error.message);
    consoleErrors.push(message);
    fatalErrors.push(message);
    rejectFatal(new Error(message));
  });
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const text = conciseFailure(message.text());
    if (consoleErrors.length < 50) consoleErrors.push(text);
    if (/extension-bootstrap failed|read-only and non-configurable/u.test(text)) {
      fatalErrors.push(text);
      rejectFatal(new Error(text));
    }
  });
  await Promise.race([page.goto(editorUrl, {waitUntil: 'domcontentloaded'}), fatal]);
  await page.waitForFunction(() => Boolean(window.vm && window.ScratchBlocks?.getMainWorkspace()));

  phase = 'open-project';
  await page.getByText('File', {exact: true}).click();
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByText('Load from your computer', {exact: true}).click(),
  ]);
  await chooser.setFiles(options.input);

  phase = 'load-project';
  let permissions = 0;
  while (true) {
    await Promise.race([
      page.waitForFunction(
        () => {
          const stage = window.vm.runtime.getTargetForStage();
          return (
            Boolean(document.querySelector('[role=dialog]')) ||
            Object.values(stage?.blocks?._blocks ?? {}).some(
              (block: any) => block.opcode === 'kubohiroyakamishibaiauthoring4_kamishibai',
            )
          );
        },
        null,
        {timeout: 30_000},
      ),
      fatal,
    ]);
    const dialog = page.getByRole('dialog');
    if (!(await dialog.count())) break;
    const prefix = await dialog
      .locator('textarea')
      .evaluate((element) => (element as HTMLTextAreaElement).value.slice(0, 130));
    assert(
      prefix.startsWith('(function(Scratch)') ||
        prefix.startsWith('// SPDX-License-Identifier: MPL-2.0\n// Kamishibai block script'),
      'Unexpected extension permission request.',
    );
    assert(permissions++ < 2, 'Unexpected additional extension permission request.');
    await dialog.getByLabel('Run without sandbox', {exact: true}).check();
    await dialog.getByRole('button', {name: 'Allow', exact: true}).click();
  }
  await page.locator('[class*="stage-selector_stage-selector_"]').click();
  await Promise.race([
    page.waitForFunction(() =>
      window.ScratchBlocks.getMainWorkspace()
        .getAllBlocks(false)
        .some((block: any) => block.type === 'kubohiroyakamishibaiauthoring4_scene'),
    ),
    fatal,
  ]);

  phase = 'display-scenes';
  const scenes: SceneEvidence[] = await page.evaluate(
    ({authoringScene, actionPrefix}) => {
      const workspace = window.ScratchBlocks.getMainWorkspace();
      workspace.setScale(0.85);
      const blocks = workspace.getAllBlocks(false);
      const unknown = blocks.filter((block: any) => !window.ScratchBlocks.Blocks[block.type]);
      if (unknown.length) throw new Error('Undefined block types in the editor.');
      return blocks
        .filter((block: any) => block.type === authoringScene)
        .sort((a: any, b: any) => a.getRelativeToSurfaceXY().y - b.getRelativeToSurfaceXY().y)
        .map((block: any) => ({
          id: block.id,
          name: block.getInputTargetBlock('SCENE').getFieldValue('TEXT'),
          commands: block
            .getInputTargetBlock('SUBSTACK')
            .getDescendants(false)
            .filter((child: any) => child.type.startsWith(actionPrefix)).length,
        }));
    },
    {authoringScene, actionPrefix},
  );
  assert.deepEqual(
    scenes.map(({name, commands}) => ({name, commands})),
    expectedScenes,
  );
  report.scenes = scenes;
  for (const [index, scene] of scenes.entries()) {
    await alignScene(page, scene.id);
    await page.screenshot({path: path.join(outputDirectory, `scene-${index + 1}.png`)});
    const visible: boolean = await page.evaluate((id) => {
      const heading = window.ScratchBlocks.getMainWorkspace()
        .getBlockById(id)
        .getInputTargetBlock('SCENE')
        .getSvgRoot()
        .getBoundingClientRect();
      return (
        heading.width > 0 &&
        heading.height > 0 &&
        heading.x >= 300 &&
        heading.right <= 1000 &&
        heading.y >= 90 &&
        heading.bottom <= 950
      );
    }, scene.id);
    assert(visible, `${scene.name}: scene heading must be visible in the code pane.`);
  }

  phase = 'edit-visible-field';
  await alignScene(page, scenes[0]!.id);
  const field = await page.evaluate((id) => {
    const workspace = window.ScratchBlocks.getMainWorkspace();
    let command = workspace.getBlockById(id).getInputTargetBlock('SUBSTACK');
    while (command && !command.type.endsWith('__wait')) command = command.getNextBlock();
    if (!command) throw new Error('The opening scene must contain a wait command.');
    const number = command.getInputTargetBlock('SECONDS');
    const rect = number.getField('NUM').getSvgRoot().getBoundingClientRect();
    return {
      id: number.id,
      before: number.getFieldValue('NUM'),
      x: rect.x + rect.width / 2,
      y: rect.y + rect.height / 2,
    };
  }, scenes[0]!.id);
  assert.equal(field.before, '2');
  assert(field.x >= 300 && field.x < 1000 && field.y >= 90 && field.y < 950);
  await page.mouse.click(field.x, field.y);
  await page.locator('input.blocklyHtmlInput').fill(editedSeconds);
  await page.locator('input.blocklyHtmlInput').press('Enter');
  assert.equal(
    await page.evaluate(
      (id) => window.ScratchBlocks.getMainWorkspace().getBlockById(id).getFieldValue('NUM'),
      field.id,
    ),
    editedSeconds,
  );
  report.edit = {before: field.before, after: editedSeconds, via: 'visible numeric field'};
  await page.screenshot({path: path.join(outputDirectory, 'edited-field.png')});

  phase = 'save-project';
  await page.getByText('File', {exact: true}).click();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page
      .locator('[class*="menu_menu-item_"]')
      .filter({hasText: /^Save to your computer$/u})
      .click(),
  ]);
  const savedPath = path.join(outputDirectory, 'edited.sb3');
  await download.saveAs(savedPath);
  assert.equal(await download.failure(), null);

  phase = 'validate-saved-source';
  builderOutput([
    'export-block-dsl',
    '--input',
    savedPath,
    '--output-dir',
    outputDirectory,
    '--name',
    'edited',
  ]);
  const opening = Array.isArray(story.scenes.opening)
    ? story.scenes.opening
    : story.scenes.opening.actions;
  const firstWait = opening.find((action: Record<string, unknown>) => 'wait' in action);
  assert(firstWait);
  firstWait.wait = Number(editedSeconds);
  const expectedPath = path.join(outputDirectory, 'expected.k4.yml');
  await writeFile(expectedPath, stringify(story));
  const canonical = (input: string) =>
    builderOutput(['validate-dsl4', '--input', input, '--format', 'canonical-json']);
  assert.equal(
    canonical(path.join(outputDirectory, 'edited.k4.yml')),
    canonical(expectedPath),
    'The saved SB3 must preserve the edit and all remaining story semantics.',
  );
  assert.deepEqual(
    fatalErrors,
    [],
    'The editor must not report a fatal initialization or page error.',
  );
  report.savedStoryMatches = true;
  report.status = 'passed';
} catch (error) {
  failure = error;
  report.status = 'failed';
  report.error = conciseFailure(error instanceof Error ? error.message : error);
  await page?.screenshot({path: path.join(outputDirectory, 'failure.png')}).catch(() => {});
} finally {
  report.phase = phase;
  report.consoleErrors = consoleErrors;
  report.fatalErrors = fatalErrors;
  await context?.tracing.stop({path: path.join(outputDirectory, 'trace.zip')}).catch(() => {});
  await browser?.close();
  await writeFile(
    path.join(outputDirectory, 'result.json'),
    `${JSON.stringify(report, null, 2)}\n`,
  );
}
if (failure) {
  throw new Error(
    `Block editor regression failed at ${phase}: ${report.error}\nEvidence: ${outputDirectory}`,
  );
}
process.stdout.write(
  `Block editor regression passed: 10 scenes, 174 commands, UI edit 2 -> ${editedSeconds}, saved YAML verified.\nEvidence: ${outputDirectory}\n`,
);
