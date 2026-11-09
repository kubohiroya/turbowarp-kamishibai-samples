/**
 * Prepare the per-seat Teachable Machine models of the block-script tekona workshop.
 *
 *   node scripts/tekona-seat-models.ts fresh BASE.tm FRESH.tm
 *     Remove the upload identity from a project, so uploading it creates a new model link.
 *   node scripts/tekona-seat-models.ts collect SEATS_DIR [--write]
 *     Read seat-NN.tm files, check their labels and links, and (with --write) store the links in
 *     stories/tekona/workshop.config.json as blockWorkshop.slotModelUrls.
 *
 * A .tm file holds a manifest.json and samples named "<label>-!-<index>.jpg". After uploading,
 * manifest.appdata.publishResults.tensorflowjs keeps the model name and an update token, so a
 * reopened project updates the same link. Treat seat files as secrets: they contain the token
 * and the samples' photos. They are never committed.
 */
import assert from 'node:assert/strict';
import {readdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

import {strFromU8, strToU8, unzipSync, zipSync} from 'fflate';

import {costumeNames} from '../resources/tekona-workshop/assistant/compose-participants.js';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const configPath = path.join(projectRoot, 'stories/tekona/workshop.config.json');
/** Class names of every seat model; the same names as the suitor's costumes. */
export const seatLabels: readonly string[] = costumeNames;

interface Manifest {
  type?: string;
  appdata?: {publishResults?: {tensorflowjs?: {name?: string; token?: string}}};
}

export interface SeatModel {
  file: string;
  seat: string;
  labels: Record<string, number>;
  url?: string;
}

function readProject(bytes: Uint8Array) {
  const archive = unzipSync(bytes);
  assert(archive['manifest.json'], 'A Teachable Machine project must contain manifest.json.');
  const manifest = JSON.parse(strFromU8(archive['manifest.json'])) as Manifest;
  const labels: Record<string, number> = {};
  for (const name of Object.keys(archive)) {
    const match = /^(.+)-!-\d+\.(?:jpe?g|png)$/u.exec(name);
    if (match) labels[match[1]!] = (labels[match[1]!] ?? 0) + 1;
  }
  return {archive, manifest, labels};
}

/** A copy without the upload identity: uploading it creates a new, separate model link. */
export function freshProject(bytes: Uint8Array): Uint8Array {
  const {archive, manifest, labels} = readProject(bytes);
  assert.equal(manifest.type, 'pose', 'The seat model must be a pose project.');
  for (const label of seatLabels) assert(labels[label], `The project needs samples of class "${label}".`);
  if (manifest.appdata) delete manifest.appdata.publishResults;
  archive['manifest.json'] = strToU8(JSON.stringify(manifest));
  return zipSync(archive, {level: 0});
}

/** Inspect one uploaded seat project. */
export function seatModel(file: string, bytes: Uint8Array): SeatModel {
  const match = /^seat-(\d{2})\.tm$/u.exec(path.basename(file));
  assert(match, `Seat project names must be seat-NN.tm: ${file}`);
  const {manifest, labels} = readProject(bytes);
  const name = manifest.appdata?.publishResults?.tensorflowjs?.name;
  return {
    file,
    seat: match[1]!,
    labels,
    ...(name ? {url: `https://teachablemachine.withgoogle.com/models/${name}/`} : {}),
  };
}

/** Problems that keep a seat model from being registered. */
export function seatProblems(models: SeatModel[], slots: number): string[] {
  const problems: string[] = [];
  const links = new Map<string, string>();
  for (const model of models) {
    if (Number(model.seat) < 1 || Number(model.seat) > slots)
      problems.push(`${model.file}: seat ${model.seat} has no slot (slots: ${slots}).`);
    if (!model.url) problems.push(`${model.file}: not uploaded yet (no model link in the project).`);
    if (model.url && !/^https:\/\/teachablemachine\.withgoogle\.com\/models\/[A-Za-z0-9_-]+\/$/u.test(model.url))
      problems.push(`${model.file}: unexpected model link ${model.url}.`);
    if (model.url && links.has(model.url))
      problems.push(`${model.file}: same model link as ${links.get(model.url)} (upload a fresh copy).`);
    if (model.url) links.set(model.url, model.file);
    for (const label of seatLabels)
      if (!model.labels[label]) problems.push(`${model.file}: class "${label}" has no samples.`);
    for (const label of Object.keys(model.labels))
      if (!seatLabels.includes(label))
        problems.push(`${model.file}: unexpected class "${label}" (use only ${seatLabels.join(' / ')}).`);
  }
  return problems;
}

async function main() {
  const [command, ...args] = process.argv.slice(2).filter((arg) => arg !== '--');
  if (command === 'fresh') {
    const [input, output] = args;
    assert(input && output, 'usage: fresh BASE.tm FRESH.tm');
    await writeFile(output, freshProject(await readFile(input)));
    console.log(`Wrote ${output} without its upload identity.`);
    return;
  }
  assert.equal(command, 'collect', 'usage: fresh BASE.tm FRESH.tm | collect SEATS_DIR [--write]');
  const directory = args.find((arg) => !arg.startsWith('--'));
  assert(directory, 'usage: collect SEATS_DIR [--write]');
  const config = JSON.parse(await readFile(configPath, 'utf8'));
  const files = (await readdir(directory)).filter((name) => name.endsWith('.tm')).sort();
  const models = await Promise.all(files.map(async (name) =>
    seatModel(name, await readFile(path.join(directory, name)))));
  for (const model of models)
    console.log(`${model.seat}  ${model.url ?? '(not uploaded)'}  ${JSON.stringify(model.labels)}`);
  const problems = seatProblems(models, config.blockWorkshop.slots);
  const missing = Array.from({length: config.blockWorkshop.slots}, (_, index) => String(index + 1).padStart(2, '0'))
    .filter((seat) => !models.some((model) => model.seat === seat));
  if (missing.length) console.log(`Seats without a project use the sample model: ${missing.join(', ')}`);
  if (problems.length) throw new Error(problems.join('\n'));
  if (args.includes('--write')) {
    config.blockWorkshop.slotModelUrls = Object.fromEntries(models.map((model) => [model.seat, model.url]));
    await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`);
    console.log(`Stored ${models.length} seat model links in ${path.relative(projectRoot, configPath)}. Run pnpm update:tekona.`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
