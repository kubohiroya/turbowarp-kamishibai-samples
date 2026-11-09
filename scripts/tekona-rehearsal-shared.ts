/** Shared steps of the tekona workshop rehearsals in TurboWarp Plus Editor. */
import assert from 'node:assert/strict';
import {copyFile, readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

import type {BrowserContext, Page} from 'playwright';

import {editorControlClick} from './block-diagnostic-fixture.ts';
import {costumeNames} from '../resources/tekona-workshop/assistant/compose-participants.js';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const substituteModel = path.join(projectRoot, 'stories/urashima/pose-models/3and4');

/**
 * Serve a local four-class model for every Teachable Machine model URL, with the labels of the
 * workshop convention (stand, kime, rejected), so the story's pose names stay unchanged.
 */
export async function routeSubstituteModels(context: BrowserContext) {
  const metadata = JSON.parse(await readFile(path.join(substituteModel, 'metadata.json'), 'utf8'));
  assert.equal(metadata.labels.length, 4, 'The substitute model must have four classes.');
  const labels = [...costumeNames, 'other'];
  await context.route(
    /https:\/\/teachablemachine\.withgoogle\.com\/models\/[^/]+\/(model\.json|metadata\.json|weights\.bin)(\?.*)?$/u,
    async (route) => {
      const name = new URL(route.request().url()).pathname.split('/').pop()!;
      const body = name === 'metadata.json' ? JSON.stringify({...metadata, labels})
        : await readFile(path.join(substituteModel, name));
      await route.fulfill({body, contentType: name.endsWith('.bin') ? 'application/octet-stream' : 'application/json',
        headers: {'access-control-allow-origin': '*'}});
    });
}

/** The participant's three pictures, named stand / kime / rejected like the handout asks. */
export async function participantPictures(outputDirectory: string, images: string) {
  const fallback: Record<string, string> = {stand: 'kokufu-stand', kime: 'miyako-kime', rejected: 'kokufu-rejected'};
  const files = [];
  for (const name of costumeNames) {
    const extension = images ? '.png' : '.svg';
    const file = path.join(outputDirectory, `${name}${extension}`);
    await copyFile(images ? path.join(images, `${name}.png`)
      : path.join(projectRoot, `stories/tekona/assets/${fallback[name]}.svg`), file);
    files.push({name, file});
  }
  return files;
}

/**
 * Replace a sprite's placeholder costumes: delete the placeholder, then upload the picture of the
 * same name from the costume tab, so the uploaded costume keeps the file name (stand, kime, rejected).
 */
export async function replaceCostumes(page: Page, sprite: string, files: {name: string; file: string}[]) {
  await page.evaluate((sprite) => {
    const target = window.vm.runtime.targets.find((candidate: any) => candidate.getName() === sprite);
    if (!target) throw new Error(`Sprite ${sprite} is missing.`);
    window.vm.setEditingTarget(target.id);
  }, sprite);
  await page.getByRole('tab', {name: /コスチューム|Costumes/u}).click(editorControlClick);
  for (const {name, file} of files) {
    // Same as the costume tab's "delete" on the placeholder costume.
    await page.evaluate((name) => {
      const index = window.vm.editingTarget.getCostumes().findIndex((costume: any) => costume.name === name);
      if (index < 0) throw new Error(`Placeholder costume ${name} is missing.`);
      window.vm.deleteCostume(index);
    }, name);
    const before = await page.evaluate(() => window.vm.editingTarget.getCostumes().length);
    await page.locator('[aria-label="Choose a Costume"]').first().hover();
    const upload = page.locator('[aria-label="Upload Costume"]').first();
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), upload.click(editorControlClick)]);
    await chooser.setFiles(file);
    await page.waitForFunction((before) => window.vm.editingTarget.getCostumes().length === before + 1, before,
      {timeout: 30_000});
  }
  const names = await page.evaluate(() => window.vm.editingTarget.getCostumes().map((costume: any) => costume.name));
  assert.deepEqual([...names].sort(), [...costumeNames].sort(),
    `${sprite} must hold exactly the costumes ${costumeNames.join(', ')}.`);
  // Return the sprite to its initial hidden state; the costume tab selected the last upload.
  await page.evaluate((sprite) => {
    const target = window.vm.runtime.targets.find((candidate: any) => candidate.getName() === sprite);
    target.setVisible(false);
    window.vm.setEditingTarget(window.vm.runtime.getTargetForStage().id);
  }, sprite);
  return names;
}
