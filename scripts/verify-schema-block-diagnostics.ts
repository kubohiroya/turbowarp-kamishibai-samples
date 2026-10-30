import assert from 'node:assert/strict';
import path from 'node:path';
import type {Page} from 'playwright';

const prefix = 'kubohiroyakamishibaiauthoring4_';
const assetName = 'SchemaProbeImage';
const moduleLabel = 'schema-diagnostic-module';
const configLabel = 'schema-diagnostic-config';

async function selectTarget(page: Page, targetId: string) {
  await page.evaluate((id) => window.vm.setEditingTarget(id), targetId);
  await page.waitForFunction(
    (id) =>
      window.vm.editingTarget?.id === id &&
      window.ScratchBlocks.getMainWorkspace()
        .getTopBlocks(false)
        .every((block: any) => window.vm.editingTarget.blocks.getBlock(block.id)),
    targetId,
  );
}

/** Exercise legacy Config/include read compatibility in the explicitly derived three-target fixture. */
export async function verifySchemaBlockDiagnostics(
  page: Page,
  outputDirectory: string,
  report: Record<string, unknown>,
  setPhase: (phase: string) => void,
) {
  setPhase('schema-setup');
  report.schemaFixtureKind = 'legacy-compatibility';
  const identity = await page.evaluate(() => {
    window.vm.stopAll();
    const stage = window.vm.runtime.getTargetForStage();
    const sprites = window.vm.runtime.targets.filter(
      (target: any) => !target.isStage && target.isOriginal,
    );
    if (sprites.length < 2) throw new Error('Schema regression requires two original sprites.');
    return {
      stageId: stage.id,
      stageName: stage.getName(),
      moduleTargetId: sprites[0].id,
      moduleTargetName: sprites[0].getName(),
      configTargetId: sprites[1].id,
      configTargetName: sprites[1].getName(),
    };
  });
  assert.equal(
    new Set([identity.stageId, identity.moduleTargetId, identity.configTargetId]).size,
    3,
  );
  report.schemaSetup = {identity, moduleLabel, configLabel, assetName};

  await selectTarget(page, identity.moduleTargetId);
  const module = await page.evaluate(
    ({prefix, label}) => {
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
        shadow.render();
      };
      const hat = make(`${prefix}kamishibai`);
      text(hat, 'VERSION', '4.0');
      text(hat, 'LABEL', label);
      const scene = make(`${prefix}scene`);
      text(scene, 'SCENE', 'schemaDiagnosticScene');
      text(scene, 'PROPERTIES', '{}');
      hat.nextConnection.connect(scene.previousConnection);
      const wait = make('kubohiroyakamishibai4_kubohiroyakamishibairuntime4__wait');
      const seconds = make('math_number');
      seconds.setShadow(true);
      seconds.setFieldValue('0.1', 'NUM');
      wait.getInput('SECONDS').connection.connect(seconds.outputConnection);
      scene.getInput('SUBSTACK').connection.connect(wait.previousConnection);
      return {hatId: hat.id, sceneId: scene.id, waitId: wait.id};
    },
    {prefix, label: moduleLabel},
  );
  await page.waitForFunction(
    ({targetId, blockId}) =>
      !!window.vm.runtime.targets
        .find((target: any) => target.id === targetId)
        ?.blocks.getBlock(blockId),
    {targetId: identity.moduleTargetId, blockId: module.waitId},
  );

  await selectTarget(page, identity.configTargetId);
  const config = await page.evaluate(
    ({prefix, label, assetName}) => {
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
        shadow.render();
        return shadow.id;
      };
      const hat = make(`${prefix}kamishibaiConfig`);
      text(hat, 'LABEL', label);
      const asset = make(`${prefix}asset`);
      text(asset, 'NAME', assetName);
      const valueId = text(asset, 'VALUE', '{}');
      hat.nextConnection.connect(asset.previousConnection);
      return {hatId: hat.id, assetId: asset.id, valueId};
    },
    {prefix, label: configLabel, assetName},
  );
  await page.waitForFunction(
    ({targetId, blockId}) =>
      !!window.vm.runtime.targets
        .find((target: any) => target.id === targetId)
        ?.blocks.getBlock(blockId),
    {targetId: identity.configTargetId, blockId: config.assetId},
  );

  await selectTarget(page, identity.stageId);
  const include = await page.evaluate(
    ({prefix, label}) => {
      const workspace = window.ScratchBlocks.getMainWorkspace();
      const root = workspace
        .getTopBlocks(false)
        .find(
          (block: any) =>
            block.type === `${prefix}kamishibai` &&
            block.getInputTargetBlock('LABEL')?.getFieldValue('TEXT') === '',
        );
      if (!root) throw new Error('Missing empty-name Stage root.');
      const next = root.getNextBlock();
      const block = workspace.newBlock(`${prefix}includeBlocks`);
      block.initSvg();
      block.render();
      const shadow = workspace.newBlock('text');
      shadow.setShadow(true);
      shadow.initSvg();
      shadow.setFieldValue(label, 'TEXT');
      shadow.render();
      block.getInput('LABEL').connection.connect(shadow.outputConnection);
      if (next) next.previousConnection.disconnect();
      root.nextConnection.connect(block.previousConnection);
      if (next) block.nextConnection.connect(next.previousConnection);
      return {
        rootId: root.id,
        blockId: block.id,
        originalNextId: next?.id ?? null,
      };
    },
    {prefix, label: moduleLabel},
  );
  await page.waitForFunction(
    (id) => !!window.vm.runtime.getTargetForStage().blocks.getBlock(id),
    include.blockId,
  );
  report.schemaSetup = {
    identity,
    module,
    config,
    include,
    moduleLabel,
    configLabel,
    assetName,
  };
  const schemaCases: unknown[] = [];
  report.schemaCases = schemaCases;

  for (const scenario of [
    {
      name: 'schema-object',
      value: {kind: 'invalid-image-kind', file: 'probe.png'},
    },
    {name: 'schema-string', value: 'invalid-asset-kind'},
  ]) {
    setPhase(`${scenario.name}-edit`);
    await selectTarget(page, identity.configTargetId);
    const value = JSON.stringify(scenario.value);
    await page.evaluate(
      ({assetId, value}) => {
        const workspace = window.ScratchBlocks.getMainWorkspace();
        workspace.getBlockById(assetId).getInputTargetBlock('VALUE').setFieldValue(value, 'TEXT');
      },
      {assetId: config.assetId, value},
    );
    // Blockly changes reach the VM asynchronously; switching targets early can discard the edit.
    await page.waitForFunction(
      ({targetId, valueId, value}) => {
        const target = window.vm.runtime.targets.find((target: any) => target.id === targetId);
        return target?.blocks.getBlock(valueId)?.fields.TEXT.value === value;
      },
      {targetId: identity.configTargetId, valueId: config.valueId, value},
    );
    await page.evaluate((hatId) => {
      window.ScratchBlocks.getMainWorkspace().getBlockById(hatId).setCollapsed(true);
    }, config.hatId);
    await selectTarget(page, identity.stageId);
    await page
      .getByRole('tab', {name: /背景|コスチューム/u})
      .first()
      .click();

    setPhase(`${scenario.name}-diagnose`);
    await page.locator('[class*="green-flag_green-flag"]').first().click();
    const indicator = page.locator('[data-dsl4-runtime-error=true]');
    await indicator.waitFor({state: 'visible'});
    const diagnostic = await page.evaluate(() => {
      const root = document.querySelector('[data-dsl4-runtime-error=true]')!;
      const text = (name: string) =>
        root.querySelector(`[data-dsl4-runtime-error-${name}]`)?.textContent ?? '';
      return {
        code: text('code'),
        path: text('path'),
        source: text('source'),
        location: text('location'),
        targetName: text('targetName'),
        blockName: text('blockName'),
        message: text('originalMessage'),
        place: text('where'),
      };
    });
    report.lastDiagnostic = {
      scenario: scenario.name,
      value,
      identity,
      config,
      diagnostic,
    };
    assert.equal(diagnostic.code, 'K4-BLOCK-SOURCE-VALIDATION-001');
    assert.equal(diagnostic.path, `/assets/${assetName}`);
    assert.equal(diagnostic.source, `${identity.stageName}.k4.yml`);
    assert.match(diagnostic.location, /^\d+:\d+$/u);
    assert.equal(diagnostic.targetName, identity.configTargetName);
    assert(
      diagnostic.place.includes(assetName) && diagnostic.place.includes(identity.configTargetName),
    );
    assert.equal(
      await indicator
        .locator('[data-dsl4-runtime-error-technical]')
        .evaluate((element) => (element as HTMLDetailsElement).open),
      false,
    );
    await page.screenshot({
      path: path.join(outputDirectory, `${scenario.name}-error.png`),
    });
    await indicator.locator('[data-dsl4-runtime-error-technical] summary').click();
    await indicator.locator('[data-dsl4-runtime-error-code]').waitFor({state: 'visible'});
    await indicator.locator('[data-dsl4-runtime-error-code]').scrollIntoViewIfNeeded();
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );
    await page.screenshot({
      path: path.join(outputDirectory, `${scenario.name}-details.png`),
    });

    setPhase(`${scenario.name}-locate`);
    await indicator.getByRole('button', {name: '該当ブロックを表示', exact: true}).click();
    await indicator.waitFor({state: 'hidden'});
    const selection = await page.evaluate(
      ({assetId, hatId}) => {
        const workspace = window.ScratchBlocks.getMainWorkspace();
        const block = workspace.getBlockById(assetId);
        const svg = block?.getSvgRoot();
        const rect = svg?.getBoundingClientRect();
        const area = workspace.getInjectionDiv().getBoundingClientRect();
        return {
          targetId: window.vm.editingTarget.id,
          targetName: window.vm.editingTarget.getName(),
          blockId: window.ScratchBlocks.selected?.id ?? null,
          selected: svg?.classList.contains('blocklySelected') ?? false,
          highlighted: !!svg && getComputedStyle(svg).filter.includes('drop-shadow'),
          expanded: workspace.getBlockById(hatId)?.isCollapsed() === false,
          visible:
            !!rect &&
            rect.width > 0 &&
            rect.height > 0 &&
            rect.left < area.right &&
            rect.right > area.left &&
            rect.top < area.bottom &&
            rect.bottom > area.top,
          value: block?.getInputTargetBlock('VALUE')?.getFieldValue('TEXT') ?? null,
        };
      },
      {assetId: config.assetId, hatId: config.hatId},
    );
    const result = {
      category: 'schema',
      name: scenario.name,
      value,
      diagnostic,
      selection,
      expectedTargetId: identity.configTargetId,
      expectedBlockId: config.assetId,
    };
    report.lastDiagnostic = result;
    assert.equal(selection.targetId, identity.configTargetId, 'Selected the wrong sprite.');
    assert.equal(selection.blockId, config.assetId, 'Highlighted the wrong block.');
    assert.equal(selection.value, value, 'The Schema case did not use the edited value.');
    assert(selection.selected && selection.highlighted && selection.expanded && selection.visible);
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );
    await page.screenshot({
      path: path.join(outputDirectory, `${scenario.name}-selected.png`),
    });
    schemaCases.push(result);
    (report.cases as unknown[]).push(result);
  }

  setPhase('schema-recover');
  // An invented asset is absent from the published bundle even after its Schema becomes valid.
  await page.evaluate(
    (id) => window.ScratchBlocks.getMainWorkspace().getBlockById(id).dispose(false),
    config.assetId,
  );
  await page.waitForFunction(
    ({targetId, blockId}) =>
      !window.vm.runtime.targets
        .find((target: any) => target.id === targetId)
        .blocks.getBlock(blockId),
    {targetId: identity.configTargetId, blockId: config.assetId},
  );
  await selectTarget(page, identity.stageId);
  await page.locator('[class*="green-flag_green-flag"]').first().click();
  await page.locator('[data-dsl4-title-action=close]').waitFor({state: 'visible'});
  assert.equal(await page.locator('[data-dsl4-runtime-error=true]').isVisible(), false);
  const retained = await page.evaluate(
    ({configTargetId, configId, includeId}) => ({
      include: !!window.vm.runtime.getTargetForStage().blocks.getBlock(includeId),
      config: !!window.vm.runtime.targets
        .find((target: any) => target.id === configTargetId)
        .blocks.getBlock(configId),
    }),
    {
      configTargetId: identity.configTargetId,
      configId: config.hatId,
      includeId: include.blockId,
    },
  );
  assert(retained.include && retained.config);
  report.schemaRecovery = {
    temporaryAssetRemoved: true,
    ...retained,
    errorVisible: false,
  };
  await page.screenshot({
    path: path.join(outputDirectory, 'schema-recovered.png'),
  });

  setPhase('schema-cleanup');
  await page.evaluate((id) => {
    const block = window.ScratchBlocks.getMainWorkspace().getBlockById(id);
    block.unplug(true);
    block.dispose(false);
  }, include.blockId);
  await page.waitForFunction(
    (id) => !window.vm.runtime.getTargetForStage().blocks.getBlock(id),
    include.blockId,
  );
  assert.equal(
    await page.evaluate(
      (id) => window.vm.runtime.getTargetForStage().blocks.getBlock(id)?.next ?? null,
      include.rootId,
    ),
    include.originalNextId,
  );
  for (const [targetId, blockId] of [
    [identity.moduleTargetId, module.hatId],
    [identity.configTargetId, config.hatId],
  ]) {
    await selectTarget(page, targetId);
    await page.evaluate(
      (id) => window.ScratchBlocks.getMainWorkspace().getBlockById(id).dispose(false),
      blockId,
    );
    await page.waitForFunction(
      ({targetId, blockId}) =>
        !window.vm.runtime.targets
          .find((target: any) => target.id === targetId)
          .blocks.getBlock(blockId),
      {targetId, blockId},
    );
  }
  await selectTarget(page, identity.stageId);
}
