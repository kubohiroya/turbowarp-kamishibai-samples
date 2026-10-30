import {migrateEditableBlockSource} from './migrate-embedded-yaml.ts';
import {simplifyPublishedDsl4Blocks} from './simplify-published-dsl4-blocks.ts';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {writeFile} from 'node:fs/promises';
import path from 'node:path';

import {createDeterministicSb3, importSb3} from '@kubohiroya/sb3-toolchain';
import {strFromU8, unzipSync} from 'fflate';
import {parse} from 'yaml';

import {createMyUrashimaPoseVariant, workshopPoseCounts} from './my-urashima-workshop.ts';
import type {WorkshopPoseCount} from './my-urashima-workshop.ts';
import type {DependencyRecord, ProjectAssetSpecification} from './story-config.ts';
import type {ScratchProject} from './scratch.ts';
import {verifyStructuredBlockSource} from './verify-structured-block-source.ts';

export interface WorkshopBlockRecord extends DependencyRecord {
  poseCount: WorkshopPoseCount;
  sourceSha256: string;
}
const sha256 = (bytes: Uint8Array | string) => createHash('sha256').update(bytes).digest('hex');

/** Prepare complete pose choices while leaving the YAML workshop and its runner unchanged. */
export async function buildMyUrashimaWorkshopBlocks(options: {
  source: string;
  basePath: string;
  storyDirectory: string;
  temporaryDirectory: string;
  princess: ProjectAssetSpecification;
  authoring: {
    cli: string; root: string; authorOptions: readonly string[];
    refreshRuntime?: (sourceDirectory: string) => Promise<void>;
  };
}): Promise<{record: WorkshopBlockRecord; bytes: Buffer}[]> {
  const outputs: {record: WorkshopBlockRecord; bytes: Buffer}[] = [];
  for (const poseCount of workshopPoseCounts) {
    const source = createMyUrashimaPoseVariant(options.source, poseCount);
    const prefix = path.join(options.temporaryDirectory, `poses-${poseCount}`);
    const sourcePath = prefix + '.k4.yml';
    await writeFile(sourcePath, source);
    const poseNames = Array.from({length: poseCount}, (_, i) => `p${i + 1}`);
    const assetsPath = prefix + '-assets.json';
    await writeFile(assetsPath, JSON.stringify({
      formatVersion: 1,
      assets: Object.fromEntries(poseNames.map((name) => [name, {
        ...options.princess,
        file: path.relative(path.dirname(assetsPath), path.resolve(options.storyDirectory, options.princess.file)),
        name,
      }])),
    }));
    const importedBase = prefix + '-base-source';
    await importSb3({inputPath: options.basePath, outputDirectory: importedBase});
    const base = await createDeterministicSb3(importedBase, {
      projectAssetsPath: assetsPath,
      allowedAssetRoots: [path.join(options.storyDirectory, 'assets')],
    });
    const basePath = prefix + '-base.sb3';
    await writeFile(basePath, base.archive);
    const authoredPath = prefix + '-authored.sb3';
    const authored = spawnSync(process.execPath, [
      options.authoring.cli, 'author-block-dsl', ...options.authoring.authorOptions, '--input', sourcePath,
      '--base', basePath, '--output', authoredPath, '--max-source-bytes', '262144',
    ], {cwd: options.authoring.root, encoding: 'utf8'});
    if (authored.error) throw authored.error;
    assert.equal(authored.status, 0, authored.stdout + authored.stderr);
    const imported = prefix + '-source';
    await simplifyPublishedDsl4Blocks(authoredPath, options.authoring.root, options.authoring.authorOptions[options.authoring.authorOptions.indexOf('--block-sections') + 1] === 'true', path.dirname(sourcePath));
    await importSb3({inputPath: authoredPath, outputDirectory: imported});
    await options.authoring.refreshRuntime?.(imported);
    const first = await createDeterministicSb3(imported);
    const second = await createDeterministicSb3(imported);
    assert.deepEqual(Buffer.from(first.archive), Buffer.from(second.archive));
    const bytes = await migrateEditableBlockSource(first.archive, {
      appRoot: options.authoring.root, entryFile: `my-urashima-${poseCount}-poses.k4.yml`,
    });
    const project = JSON.parse(strFromU8(unzipSync(bytes)['project.json']!)) as ScratchProject;
    verifyStructuredBlockSource(project, source);
    const princess = project.targets.find(({name}) => name === 'Princess');
    assert(princess);
    for (const name of poseNames) assert(princess.costumes.some((costume) => costume.name === name));
    const story = parse(source);
    const steps = story.scenes['welcome to dragon castle'].actions.find(
      (action: Record<string, unknown>) => Object.hasOwn(action, 'Princess.pose'),
    )['Princess.pose'].steps;
    assert.deepEqual(steps.map((step: {pose: string}) => step.pose), [...poseNames, ...poseNames]);
    outputs.push({bytes, record: {
      poseCount,
      path: `my-urashima-${poseCount}-poses-blocks-4.0.sb3`,
      size: bytes.length,
      sha256: sha256(bytes),
      sourceSha256: sha256(source),
    }});
  }
  return outputs;
}
