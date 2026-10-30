import {createLegacyBlockDiagnosticFixture, loadVerifiedBlockProject, inspectLoadedEmbeddedYamlRoot} from './block-diagnostic-fixture.ts';
import {canonicalDsl4ProjectStory} from './simplify-published-dsl4-blocks.ts';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdir, mkdtemp, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

import {chromium, type Browser, type BrowserContext, type Page} from 'playwright';
import {parse, stringify} from 'yaml';
import {strFromU8, unzipSync} from 'fflate';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const editorUrl = process.env.TURBOWARP_PLUS_EDITOR_URL ??
  'https://kubohiroya.github.io/turbowarp-plus-editor/editor.html?lang=en&twPlusYamlEditor=1';
const authoringScene = 'kubohiroyakamishibaiauthoring4_scene';
const actionPrefix = 'kubohiroyakamishibai4_kubohiroyakamishibairuntime4__';
const editedSeconds = '2.75';

function argumentsFromCli(): {input: string; outputDirectory: string; skipLegacyDiagnostics: boolean} {
  const options = {
    input: path.join(projectRoot, 'dist/stories/urashima/urashima-blocks-4.0.sb3'),
    outputDirectory: path.join(projectRoot, '.tmp/block-editor-browser'),
    skipLegacyDiagnostics: false,
  };
  for (let i = 2; i < process.argv.length; i++) {
    const flag = process.argv[i];
    if (flag === '--skip-legacy-diagnostics') {
      assert(!options.skipLegacyDiagnostics, 'The skip flag must not be repeated.');
      options.skipLegacyDiagnostics = true;
      continue;
    }
    const value = process.argv[++i];
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

const builderRoot = path.resolve(
  process.env.TURBOWARP_KAMISHIBAI_BLOCK_AUTHORING_ROOT ??
    process.env.TURBOWARP_KAMISHIBAI_APP_ROOT ??
    path.join(projectRoot, '../turbowarp-kamishibai-app'),
);

function builderOutput(arguments_: string[]): string {
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

/** Audit the already-loaded VM; Scratch may normalize bitmap costumes while loading an SB3. */
async function beginDocumentSaveAudit(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const vm = window.vm, runtime = vm.runtime;
    const ownerAssets = runtime.extensionStorage.kubohiroyakamishibai4.components.kubohiroyakamishibairuntime4.assets;
    const ownerFiles = ownerAssets.files.map((file: Record<string, unknown>) => ({...file}));
    const ownerManifest = JSON.parse(JSON.stringify(ownerAssets.manifest));
    const stable = (value: any): any => Array.isArray(value) ? value.map(stable) :
      value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])])) : value;
    const ownerIntegrity = ownerAssets.integrity, ownerVersion = ownerAssets.formatVersion;
    const ownerKeys = Object.keys(ownerAssets).sort().join(',');
    const targets = [...runtime.targets];
    const editable = new Set<string>();
    const root = Object.values(runtime.getTargetForStage().blocks._blocks)
      .find((block: any) => block.opcode.endsWith('__embeddedYamlRoot')) as {fields: {DOCUMENT: {value: string}}};
    const reference = root.fields.DOCUMENT.value;
    for (const target of targets) {
      const visit = (id: string | null) => {
        if (!id || editable.has(id)) return;
        editable.add(id);
        const block = target.blocks.getBlock(id);
        if (!block) return;
        visit(block.next);
        for (const input of Object.values(block.inputs ?? {}) as {block?: string; shadow?: string}[]) {
          visit(input.block ?? null); visit(input.shadow ?? null);
        }
      };
      for (const block of Object.values(target.blocks._blocks) as {opcode: string; next: string | null; fields: {DOCUMENT?: {value: string}}}[])
        if (block.opcode.endsWith('__embeddedYaml') && block.fields.DOCUMENT?.value === reference) visit(block.next);
    }
    const unrelated = targets.flatMap(target => Object.values(target.blocks._blocks)
      .filter((block: any) => !editable.has(block.id))
      .map((block: any) => ({target, id: block.id, block})));
    const fingerprint = (item: any) => JSON.stringify(Object.fromEntries(
      ['name', 'assetId', 'dataFormat', 'bitmapResolution', 'rotationCenterX', 'rotationCenterY', 'md5ext', 'rate', 'sampleCount', 'format']
        .map(key => [key, item[key]])));
    const digest = async (bytes: Uint8Array) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes as Uint8Array<ArrayBuffer>))]
      .map(byte => byte.toString(16).padStart(2, '0')).join('');
    const media = await Promise.all(targets.flatMap(target => [...target.getCostumes(), ...target.getSounds()]
      .map(async (item: any) => ({target, item, asset: item.asset, bytes: item.asset.data,
        metadata: fingerprint(item), name: item.name, targetName: target.getName(), bitmapResolution: item.bitmapResolution, filename: `${item.asset.assetId}.${item.asset.dataFormat}`,
        sha256: await digest(item.asset.data)}))));
    const methods = {stopAll: vm.stopAll, saveProjectSb3: vm.saveProjectSb3, loadProject: vm.loadProject};
    const counts = {stop: 0, save: 0, load: 0};
    vm.stopAll = () => { counts.stop++; throw new Error('Document Save must not stop unrelated scripts.'); };
    vm.saveProjectSb3 = () => { counts.save++; throw new Error('Document Save must not serialize the complete SB3.'); };
    vm.loadProject = () => { counts.load++; throw new Error('Document Save must not reload the complete project.'); };
    Reflect.set(window, Symbol.for('samples/document-save-audit'), {
      restore() { Object.assign(vm, methods); },
      async verify() {
        const assets = runtime.extensionStorage.kubohiroyakamishibai4.components.kubohiroyakamishibairuntime4.assets;
        const mediaUnchanged = (await Promise.all(media.map(async saved =>
          saved.item.asset === saved.asset && saved.asset.data === saved.bytes &&
          fingerprint(saved.item) === saved.metadata && await digest(saved.asset.data) === saved.sha256))).every(Boolean);
        const ownerAssetPayloadsUnchanged = assets.files.length === ownerFiles.length && ownerFiles.every((file: Record<string, unknown>, index: number) => {
          const current = assets.files[index];
          return Object.keys(file).length === Object.keys(current).length && Object.keys(file).every(key => file[key] === current[key]);
        });
        const ownerAssetsUnchanged = assets.formatVersion === ownerVersion && assets.integrity === ownerIntegrity &&
          Object.keys(assets).sort().join(',') === ownerKeys &&
          JSON.stringify(stable(assets.manifest)) === JSON.stringify(stable(ownerManifest));
        return {counts, mediaUnchanged, ownerAssetsIdentity: assets === ownerAssets, ownerAssetsUnchanged,
          ownerAssetPayloadsUnchanged,
          targetsIdentity: targets.length === runtime.targets.length && targets.every((target, index) => runtime.targets[index] === target),
          unrelatedBlocksIdentity: unrelated.every(saved => saved.target.blocks.getBlock(saved.id) === saved.block),
          media: media.map(({filename, sha256}) => ({filename, sha256}))};
      },
    });
  });
}

async function finishDocumentSaveAudit(page: Page) {
  return page.evaluate(async () => {
    const key = Symbol.for('samples/document-save-audit'), audit = Reflect.get(window, key);
    try { return await audit.verify(); }
    finally { audit.restore(); Reflect.deleteProperty(window, key); }
  });
}

/** Commit edited declaration blocks through the document owner before ordinary SB3 persistence. */
async function saveCurrentScriptDocument(page: Page) {
  const selectedDocument = await page.evaluate(() => {
    const workspace = window.ScratchBlocks.getMainWorkspace();
    const root = workspace.getTopBlocks(false).find((block: any) => block.type.endsWith('__embeddedYamlRoot'));
    if (!root) return null;
    const reference = root.getFieldValue('DOCUMENT');
    const body = workspace.getTopBlocks(false).find((block: any) =>
      block.type.endsWith('__embeddedYaml') && block.getFieldValue('DOCUMENT') === reference);
    if (!body) throw new Error('The explicit root must resolve to its named document.');
    const component = window.vm.runtime.extensionStorage.kubohiroyakamishibai4.components.kubohiroyakamishibairuntime4;
    return {id: body.id, reference, source: component.sourceDocuments.files[component.sourceDocuments.entryPath].source};
  });
  if (!selectedDocument) return {legacy: true as const};
  await alignScene(page, selectedDocument.id);
  await page.waitForFunction((id) => {
    const block = window.ScratchBlocks.getMainWorkspace().getBlockById(id);
    return block?.inputList?.[0]?.fieldRow?.[0]?.fieldGroup_?.hasAttribute('data-twpe-yaml-hat-icon');
  }, selectedDocument.id);
  const menuCapability = await page.evaluate(async () => {
    const scratch = window.Scratch;
    if (typeof scratch?.gui?.getBlockly !== 'function') throw new Error('The public Blockly API is unavailable.');
    const B = await scratch.gui.getBlockly();
    const port = Reflect.get(window.vm, Symbol.for('@kubohiroya/turbowarp-embedded-yaml/project-patch-workspace/v1'));
    const type = 'kubohiroyakamishibai4_menu_kubohiroyakamishibairuntime4__dsl4TransitionEffect';
    return {type, registered: typeof B.Blocks[type]?.init === 'function',
      accepted: port?.hasBlockDefinition?.(type) === true,
      unknownRejected: port?.hasBlockDefinition?.('kubohiroyakamishibai4_menu___samples_missing_menu') === false,
      inheritedRejected: port?.hasBlockDefinition?.('__proto__') === false};
  });
  assert(menuCapability.registered && menuCapability.accepted && menuCapability.unknownRejected && menuCapability.inheritedRejected,
    'The workspace capability must accept the registered menu shadow and reject unregistered block types.');
  const point = await page.evaluate((id) => {
    const rect = window.ScratchBlocks.getMainWorkspace().getBlockById(id).inputList[0].fieldRow[0].fieldGroup_.getBoundingClientRect();
    return {x: rect.x + rect.width / 2, y: rect.y + rect.height / 2};
  }, selectedDocument.id);
  await page.mouse.click(point.x, point.y);
  const dialog = page.getByRole('dialog', {name: /^(Embedded document|組み込み文書)$/u});
  await dialog.waitFor();
  const tab = dialog.getByRole('tab', {name: /^(?:💽.*)?(?:Script blocks|台本ブロック)$/u});
  assert.equal(await tab.getAttribute('aria-selected'), 'true');
  const save = dialog.getByRole('button', {name: /^(Convert, validate and save the displayed format|表示されている形式に変換して検証・保存)$/u});
  await save.waitFor();
  await page.waitForFunction(() => !document.querySelector<HTMLButtonElement>('.twpe-yaml-save')?.disabled);
  await beginDocumentSaveAudit(page);
  let audit, outcome, failure;
  try {
    await save.click();
    const result = await page.waitForFunction(() => {
      const modal = document.querySelector<HTMLDialogElement>('.twpe-yaml-dialog');
      const error = modal?.querySelector('.twpe-yaml-error')?.textContent;
      if (error) return {error};
      const close = modal?.querySelector<HTMLButtonElement>('.twpe-yaml-close');
      return modal && !modal.open && close && !close.disabled ? {saved: true} : false;
    }, undefined, {timeout: 120_000, polling: 250});
    outcome = await result.jsonValue();
  } catch (cause) {
    failure = cause;
  } finally {
    audit = await finishDocumentSaveAudit(page);
  }
  assert.deepEqual(audit.counts, {stop: 0, save: 0, load: 0});
  assert(audit.mediaUnchanged, 'Document Save must preserve loaded, normalized media bytes, IDs and metadata.');
  assert(audit.ownerAssetsIdentity && audit.ownerAssetsUnchanged && audit.ownerAssetPayloadsUnchanged,
    'Document Save must retain the complete input asset bundle; late-bound project media normalization must not rewrite it.');
  assert(audit.targetsIdentity && audit.unrelatedBlocksIdentity, 'Document Save must retain unrelated VM objects.');
  const saveError = outcome && typeof outcome === 'object' ? outcome.error : undefined;
  if (failure || saveError) throw Object.assign(failure instanceof Error ? failure : new Error(saveError || 'Document Save failed.'), {documentSaveAudit: audit});
  assert.equal(await page.getByRole('dialog', {name: /形式に変換しますか？$|^Convert to .+\?$/u}).count(), 0,
    'Saving the current block format must not request a different-format conversion.');
  const result = await page.evaluate((reference) => {
    const component = window.vm.runtime.extensionStorage.kubohiroyakamishibai4.components.kubohiroyakamishibairuntime4;
    return {source: component.sourceDocuments.files[component.sourceDocuments.entryPath].source,
      activeKind: component.editorViews.views[reference].activeKind};
  }, selectedDocument.reference);
  assert.equal(result.activeKind, 'schema-blocks');
  assert.notEqual(result.source, selectedDocument.source, 'Document Save must reflect the edited blocks into canonical YAML.');
  const saved = parse(result.source);
  const opening = Array.isArray(saved.scenes.opening) ? saved.scenes.opening : saved.scenes.opening.actions;
  assert.equal(opening.find((action: Record<string, unknown>) => 'wait' in action).wait, Number(editedSeconds));
  return {legacy: false as const, activeKind: result.activeKind, canonicalEditReflected: true, sameFormatConfirmation: false, menuCapability, audit, sourceBefore: selectedDocument.source as string};
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
  const inputProject = JSON.parse(strFromU8(unzipSync(inputBytes)['project.json']!));
  report.inputSha256 = createHash('sha256').update(inputBytes).digest('hex');
  const legacyFixture = options.skipLegacyDiagnostics ? null :
    await createLegacyBlockDiagnosticFixture(options.input, outputDirectory);
  report.legacyDiagnosticFixture = legacyFixture;
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
  report.extensionPermissions = await loadVerifiedBlockProject(page, options.input, inputProject);
  report.documentRoot = await inspectLoadedEmbeddedYamlRoot(page);
  await page.screenshot({path: path.join(outputDirectory, 'explicit-document-root.png')});
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

  phase = 'save-current-document';
  const documentSave = await saveCurrentScriptDocument(page);
  report.documentSave = {...documentSave};
  if (!documentSave.legacy) {
    await writeFile(path.join(outputDirectory, 'loaded-canonical-before.k4.yml'), documentSave.sourceBefore);
    Reflect.deleteProperty(report.documentSave as object, 'sourceBefore');
  }

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
  const nativeSavedEntries = unzipSync(await readFile(savedPath));
  const savedProject = JSON.parse(strFromU8(nativeSavedEntries['project.json']!));
  if (!documentSave.legacy) {
    for (const asset of documentSave.audit.media) {
      assert(nativeSavedEntries[asset.filename], `The saved SB3 must retain loaded asset ${asset.filename}.`);
      assert.equal(createHash('sha256').update(nativeSavedEntries[asset.filename]!).digest('hex'), asset.sha256,
        'Ordinary SB3 persistence must preserve the post-load media used by document Save.');
    }
  }

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
  // The offline generation checks authored file media against the pre-load project. Native
  // Save starts from the loaded canonical document, whose implicit media may be normalized.
  const expectedStory = documentSave.legacy ? story : parse(documentSave.sourceBefore);
  const opening = Array.isArray(expectedStory.scenes.opening)
    ? expectedStory.scenes.opening
    : expectedStory.scenes.opening.actions;
  const firstWait = opening.find((action: Record<string, unknown>) => 'wait' in action);
  assert(firstWait);
  firstWait.wait = Number(editedSeconds);
  const expectedPath = path.join(outputDirectory, 'expected.k4.yml');
  await writeFile(expectedPath, stringify(expectedStory));
  const canonical = async (input: string) =>
    canonicalDsl4ProjectStory(await readFile(input, 'utf8'), documentSave.legacy ? inputProject : savedProject,
      documentSave.legacy ? unzipSync(inputBytes) : nativeSavedEntries,
      builderRoot, path.join(projectRoot, 'stories/urashima'));
  assert.equal(
    await canonical(path.join(outputDirectory, 'edited.k4.yml')),
    await canonical(expectedPath),
    'The saved SB3 must preserve the edit and all remaining story semantics.',
  );
  report.savedStoryMatches = true;

  phase = 'reload-saved-document';
  await page.evaluate(() => {
    document.documentElement.dataset.samplesSavedProjectLoaded = 'false';
    window.vm.runtime.once('PROJECT_LOADED', () => { document.documentElement.dataset.samplesSavedProjectLoaded = 'true'; });
  });
  await loadVerifiedBlockProject(page, savedPath, savedProject);
  await page.waitForFunction(() => document.documentElement.dataset.samplesSavedProjectLoaded === 'true',
    undefined, {timeout: 120_000, polling: 250});
  report.savedDocumentRoot = await inspectLoadedEmbeddedYamlRoot(page);
  report.savedProjectReloaded = true;

  phase = 'start-edited-block-story';
  const openingBackdrop = opening.find(
    (action: Record<string, unknown>) => 'stage' in action,
  )?.stage;
  assert.equal(typeof openingBackdrop, 'string', 'The opening scene must declare its backdrop.');
  // Use the editor's visible controls so this covers the same startup path as a reader's click.
  await page.locator('[class*="green-flag_green-flag"]').first().click();
  await Promise.race([
    page.locator('[data-dsl4-title-action=close]').waitFor({state: 'visible', timeout: 120_000}),
    fatal,
  ]);
  await page.locator('[data-dsl4-title-action=close]').click();

  phase = 'render-opening-block-story';
  await Promise.race([
    page.waitForFunction(
      () => {
        const visible = (selector: string) => {
          const element = document.querySelector<HTMLElement>(selector);
          return Boolean(
            element &&
            getComputedStyle(element).display !== 'none' &&
            element.getBoundingClientRect().width > 0,
          );
        };
        const error = document.querySelector<HTMLElement>('[data-dsl4-runtime-error=true]');
        if (visible('[data-dsl4-runtime-error=true]')) {
          throw new Error(`Block story startup failed: ${error?.textContent}`);
        }
        const stage = window.vm.runtime.getTargetForStage();
        const drawableSkinId =
          window.vm.runtime.renderer._allDrawables[stage?.drawableID]?._skin?._id;
        const shellSkinIds = stage
          ?.getCostumes()
          .filter(({name}: any) => /^(?:Title|Menu)/u.test(name))
          .map(({skinId}: any) => skinId);
        // Story images must replace shell art, including renderers that keep the VM costume index.
        return (
          !visible('[data-dsl4-title-controls=true]') &&
          !visible('[data-dsl4-application-menu=true]') &&
          !visible('[data-dsl4-source-chooser=true]') &&
          Number.isInteger(drawableSkinId) &&
          !shellSkinIds?.includes(drawableSkinId)
        );
      },
      undefined,
      {timeout: 120_000},
    ),
    fatal,
  ]);
  report.blockStoryPlayback = {
    startedVia: 'visible green flag and title close',
    expectedOpeningBackdrop: openingBackdrop,
    drawableUsesStorySkin: true,
    menuVisible: await page.locator('[data-dsl4-application-menu=true]').isVisible(),
    sourceChooserVisible: await page.locator('[data-dsl4-source-chooser=true]').isVisible(),
    errorVisible: await page.locator('[data-dsl4-runtime-error=true]').isVisible(),
  };
  await page.screenshot({
    path: path.join(outputDirectory, 'block-story-opening.png'),
  });
  if (!options.skipLegacyDiagnostics) {
    if (legacyFixture?.converted) {
      phase = 'load-explicit-legacy-compatibility-fixture';
      await loadVerifiedBlockProject(page, legacyFixture.input, inputProject, true);
      await page.locator('[class*="stage-selector_stage-selector_"]').click();
    }
    phase = 'reject-duplicate-config-names';
    const configurationErrors: {label: string; code: string}[] = [];
    for (const label of ['', 'shared']) {
      const duplicateId = await page.evaluate((label) => {
        const workspace = window.ScratchBlocks.getMainWorkspace();
        const config = workspace.getAllBlocks(false).find(
          (block: any) => block.type === 'kubohiroyakamishibaiauthoring4_kamishibaiConfig',
        );
        if (!config) throw new Error('The published block project must contain a config hat.');
        config.getInputTargetBlock('LABEL').setFieldValue(label, 'TEXT');
        const duplicate = workspace.newBlock(config.type);
        const name = workspace.newBlock('text');
        name.setShadow(true);
        name.setFieldValue(label, 'TEXT');
        duplicate.getInput('LABEL').connection.connect(name.outputConnection);
        name.initSvg();
        duplicate.initSvg();
        duplicate.render();
        return duplicate.id;
      }, label);
      await page.waitForFunction(() => {
        const blocks = window.vm.runtime.getTargetForStage().blocks._blocks;
        return Object.values(blocks).filter(
          (block: any) => block.opcode === 'kubohiroyakamishibaiauthoring4_kamishibaiConfig',
        ).length === 2;
      });
      await page.locator('[class*="green-flag_green-flag"]').first().click();
      const indicator = page.locator('[data-dsl4-runtime-error=true]');
      await indicator.waitFor({state: 'visible', timeout: 30_000});
      const text = await indicator.textContent();
      assert(text?.includes('K4-BLOCK-SOURCE-DUPLICATE-001'), text ?? 'Missing duplicate diagnostic.');
      configurationErrors.push({label, code: 'K4-BLOCK-SOURCE-DUPLICATE-001'});
      await page.screenshot({path: path.join(outputDirectory, label ? 'duplicate-named-config.png' : 'duplicate-empty-config.png')});
      await page.evaluate((id) => window.ScratchBlocks.getMainWorkspace().getBlockById(id).dispose(false), duplicateId);
    }
    report.configurationErrors = configurationErrors;
  } else {
    report.legacyDiagnosticsSkipped = true;
  }
  assert.deepEqual(
    fatalErrors,
    [],
    'The editor must not report a fatal initialization or page error.',
  );
  report.status = 'passed';
} catch (error) {
  failure = error;
  report.status = 'failed';
  report.error = conciseFailure(error instanceof Error ? error.message : error);
  if (error && typeof error === 'object' && Reflect.has(error, 'documentSaveAudit')) report.documentSaveAudit = Reflect.get(error, 'documentSaveAudit');
  report.documentDialogError = await page?.locator('.twpe-yaml-error').textContent().catch(() => null);
  report.playbackState = await page
    ?.evaluate(() => {
      const stage = window.vm?.runtime?.getTargetForStage();
      return {
        titleDisplay: document.querySelector<HTMLElement>('[data-dsl4-title-controls=true]')?.style
          .display,
        menuDisplay: document.querySelector<HTMLElement>('[data-dsl4-application-menu=true]')?.style
          .display,
        sourceChooserDisplay: document.querySelector<HTMLElement>('[data-dsl4-source-chooser=true]')
          ?.style.display,
        errorText: document.querySelector<HTMLElement>('[data-dsl4-runtime-error=true]')
          ?.textContent,
        stageCostume: stage?.getCostumes()[stage.currentCostume]?.name,
        drawableSkinId:
          window.vm?.runtime?.renderer?._allDrawables?.[stage?.drawableID]?._skin?._id,
      };
    })
    .catch(() => null);
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
  `Block editor regression passed: 10 scenes, 174 commands, UI edit 2 -> ${editedSeconds}, saved YAML verified, block story started directly, ${options.skipLegacyDiagnostics ? 'legacy negatives reused from earlier proof' : 'duplicate config names rejected'}.\nEvidence: ${outputDirectory}\n`,
);
