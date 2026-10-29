/**
 * Compare block and YAML stories with the published frontend and concrete SB3 context.
 * Formatting, declaration storage and media locations may differ, but executable values
 * and image/audio hashes must match. Check every work declaring both source-yaml and sb3-blocks.
 *
 * @see https://github.com/kubohiroya/turbowarp-kamishibai-samples/issues/132
 */
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtemp, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

import {strFromU8, unzipSync} from 'fflate';

import {canonicalDsl4ProjectStory} from './simplify-published-dsl4-blocks.ts';
import {readDsl4StoryConfig} from './story-config.ts';
import type {ScratchProject} from './scratch.ts';
import {verifyStructuredBlockSource} from './verify-structured-block-source.ts';
import {resolveBlockAuthoringBuilder} from './block-authoring-builder.ts';
import {readWorksCatalog, type WorkEntry} from './works-catalog.ts';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));

export interface BlockSourceRoundTrip {
  workId: string;
  sourcePath: string;
  blocksPath: string;
  canonicalBytes: number;
}

function commandOutput(command: string, arguments_: readonly string[], cwd: string): string {
  const result = spawnSync(command, [...arguments_], {encoding: 'utf8', cwd});
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      `Command failed (${result.status}): ${command} ${arguments_.join(' ')}\n${result.stdout}${result.stderr}`,
    );
  }
  return result.stdout;
}

/** 作品が宣言する標準4形式のうち、YAML台本とブロック台本SB3の両方を持つものだけ。 */
function roundTrippableWorks(works: readonly WorkEntry[]) {
  return works.flatMap((work) => {
    const sourceHref = work.artifacts?.['source-yaml']?.href;
    const blocksHref = work.artifacts?.['sb3-blocks']?.href;
    return sourceHref && blocksHref ? [{work, sourceHref, blocksHref}] : [];
  });
}

export async function verifyDsl4BlockSourceRoundTrip({
  kamishibaiRoot: rootOverride,
}: {kamishibaiRoot?: string} = {}): Promise<BlockSourceRoundTrip[]> {
  const {root: kamishibaiRoot} = await resolveBlockAuthoringBuilder(rootOverride);
  const builderCli = path.join(kamishibaiRoot, 'bin/turbowarp-kamishibai.mjs');
  const catalog = await readWorksCatalog(path.join(projectRoot, 'site/works.json'));
  const tutorialConfig = await readDsl4StoryConfig(path.join(projectRoot, 'stories/tutorial'));
  const works = [...catalog.works, tutorialConfig.work as unknown as WorkEntry];
  const candidates = roundTrippableWorks(works);
  assert(
    candidates.length > 0,
    'No work declares both a YAML source and a block source SB3; the round trip would check nothing.',
  );

  const verified: BlockSourceRoundTrip[] = [];
  const temporaryDirectory = await mkdtemp(path.join(tmpdir(), 'dsl4-block-round-trip-'));
  try {
    for (const {work, sourceHref, blocksHref} of candidates) {
      const archive = unzipSync(new Uint8Array(await readFile(path.join(projectRoot, blocksHref))));
      const project = JSON.parse(strFromU8(archive['project.json']!));
      const canonical = async (sourcePath: string) =>
        canonicalDsl4ProjectStory(
          await readFile(sourcePath, 'utf8'), project, archive, kamishibaiRoot,
          path.dirname(path.join(projectRoot, sourceHref)),
        );
      verifyStructuredBlockSource(
        JSON.parse(strFromU8(archive['project.json']!)) as ScratchProject,
        await readFile(path.join(projectRoot, sourceHref), 'utf8'),
      );
      const exportDirectory = path.join(temporaryDirectory, work.id);
      commandOutput(
        process.execPath,
        [
          builderCli,
          'export-block-dsl',
          '--input',
          path.join(projectRoot, blocksHref),
          '--output-dir',
          exportDirectory,
          '--name',
          work.id,
        ],
        kamishibaiRoot,
      );
      const exportedPath = path.join(exportDirectory, `${work.id}.k4.yml`);
      const authored = await canonical(path.join(projectRoot, sourceHref));
      const exported = await canonical(exportedPath);
      assert.equal(
        exported,
        authored,
        `${work.id}: the YAML exported from ${blocksHref} does not mean the same as ${sourceHref}.`,
      );
      verified.push({
        workId: work.id,
        sourcePath: sourceHref,
        blocksPath: blocksHref,
        canonicalBytes: authored.length,
      });
    }
  } finally {
    await rm(temporaryDirectory, {recursive: true, force: true});
  }
  return verified;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const verified = await verifyDsl4BlockSourceRoundTrip();
  for (const {workId, blocksPath, canonicalBytes} of verified) {
    process.stdout.write(
      `Verified ${workId}: ${blocksPath} round-trips to the authored story (${canonicalBytes} canonical bytes).\n`,
    );
  }
}
