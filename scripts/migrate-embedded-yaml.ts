import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { strFromU8, unzipSync } from "fflate";

import type { ScratchProject } from "./scratch.ts";

const runtimePrefix = "kubohiroyakamishibai4_kubohiroyakamishibairuntime4__";

/** Check the editable document shape without reimplementing the App's migration or DSL parser. */
export function assertEmbeddedYamlBlockSource(project: ScratchProject): void {
  const stage = project.targets.find((target) => target.isStage);
  assert(stage, "The migrated block source must keep its Stage.");
  const roots = Object.values(stage.blocks).filter(
    ({ opcode }) => opcode === `${runtimePrefix}embeddedYamlRoot`,
  );
  assert.equal(
    roots.length,
    1,
    "The migrated story must have one explicit embedded YAML root.",
  );
  assert.equal(
    project.targets
      .flatMap((target) => Object.values(target.blocks))
      .filter(({ opcode }) => opcode === `${runtimePrefix}embeddedYamlRoot`)
      .length,
    1,
    "The only root must belong to the Stage.",
  );
  const root = roots[0]!;
  assert.equal(root.parent, null);
  assert.equal(root.next, null);
  assert.equal(root.topLevel, true);
  assert.deepEqual(root.inputs ?? {}, {});
  assert.deepEqual(root.fields?.VERSION, ["4.0", null]);
  const reference = root.fields?.DOCUMENT?.[0];
  assert(typeof reference === "string" && reference.length > 0);
  const documents = Object.values(stage.blocks).filter(
    ({ opcode, fields }) =>
      opcode === `${runtimePrefix}embeddedYaml` &&
      fields?.DOCUMENT?.[0] === reference,
  );
  assert.equal(
    documents.length,
    1,
    "The root must refer to one named document containing the script.",
  );
  assert.equal(documents[0]!.parent, null);
  assert.equal(documents[0]!.topLevel, true);
  assert(
    typeof documents[0]!.next === "string",
    "The migrated script must keep its editable block body.",
  );
  for (const target of project.targets) {
    for (const block of Object.values(target.blocks)) {
      assert(
        !/_(?:kamishibai|kamishibaiConfig|includeBlocks)$/u.test(block.opcode),
        "New sample artifacts must not contain retired script or configuration hats.",
      );
    }
  }
}

/** Use the pinned App's official migration command after the sample's asset materialization. */
export async function migrateEditableBlockSource(
  input: Uint8Array,
  { appRoot, entryFile }: { appRoot: string; entryFile: string },
): Promise<Buffer> {
  const directory = await mkdtemp(
    path.join(tmpdir(), "samples-embedded-yaml-"),
  );
  try {
    const inputPath = path.join(directory, "legacy.sb3");
    const outputPath = path.join(directory, "migrated.sb3");
    await writeFile(inputPath, input);
    const command = spawnSync(
      process.execPath,
      [
        path.join(appRoot, "bin/turbowarp-kamishibai.mjs"),
        "migrate-embedded-yaml",
        "--input",
        inputPath,
        "--output",
        outputPath,
        "--entry-file",
        entryFile,
        "--report",
        path.join(directory, "migration.json"),
      ],
      { cwd: appRoot, encoding: "utf8" },
    );
    if (command.error) throw command.error;
    assert.equal(
      command.status,
      0,
      `The pinned App migration failed.\n${command.stdout}${command.stderr}`,
    );
    const output = await readFile(outputPath);
    const before = unzipSync(input),
      after = unzipSync(output);
    assert.deepEqual(
      Object.keys(after).sort(),
      Object.keys(before).sort(),
      "Migration must preserve every archived asset.",
    );
    for (const [name, bytes] of Object.entries(before)) {
      if (name !== "project.json")
        assert.deepEqual(
          after[name],
          bytes,
          `Migration changed asset ${name}.`,
        );
    }
    const original = JSON.parse(
      strFromU8(before["project.json"]!),
    ) as ScratchProject;
    const migrated = JSON.parse(
      strFromU8(after["project.json"]!),
    ) as ScratchProject;
    assertEmbeddedYamlBlockSource(migrated);
    assert.equal(migrated.targets.length, original.targets.length);
    for (let index = 0; index < original.targets.length; index++) {
      const {
        blocks: _oldBlocks,
        comments: _oldComments,
        ...oldTarget
      } = original.targets[index]!;
      const {
        blocks: _newBlocks,
        comments: _newComments,
        ...newTarget
      } = migrated.targets[index]!;
      assert.deepEqual(
        newTarget,
        oldTarget,
        "Migration must preserve target media, variables and layout.",
      );
    }
    return output;
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
