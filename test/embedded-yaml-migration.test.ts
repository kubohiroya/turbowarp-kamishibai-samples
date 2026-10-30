import assert from "node:assert/strict";
import { readFile, writeFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { createLegacyBlockDiagnosticFixture } from "../scripts/block-diagnostic-fixture.ts";
import { test } from "vitest";

import { assertEmbeddedYamlBlockSource } from "../scripts/migrate-embedded-yaml.ts";
import type { ScratchProject } from "../scripts/scratch.ts";
import { verifyStructuredBlockSource } from "../scripts/verify-structured-block-source.ts";

const prefix = "kubohiroyakamishibai4_kubohiroyakamishibairuntime4__";
const archive = unzipSync(
  await readFile(
    new URL("../stories/tutorial/tutorial-blocks-4.0.sb3", import.meta.url),
  ),
);
const original = JSON.parse(
  strFromU8(archive["project.json"]!),
) as ScratchProject;
const source = await readFile(
  new URL("../stories/tutorial/story.kamishibai.yaml", import.meta.url),
  "utf8",
);

/** Retain a real script body while testing the new document/root shape independently of the CLI. */
function fixture(): ScratchProject {
  const project = structuredClone(original);
  const blocks = project.targets.find((target) => target.isStage)!.blocks;
  if (
    Object.values(blocks).some(
      ({ opcode }) => opcode === prefix + "embeddedYamlRoot",
    )
  )
    return project;
  const [id, body] = Object.entries(blocks).find(([, block]) =>
    block.opcode.endsWith("_kamishibai"),
  )!;
  const reference = "fixture-document";
  body.opcode = prefix + "embeddedYaml";
  body.inputs = {};
  body.fields = { DOCUMENT: [reference, null] };
  for (const [configId, config] of Object.entries(blocks).filter(([, block]) =>
    block.opcode.endsWith("_kamishibaiConfig"),
  )) {
    if (config.next) {
      const first = config.next;
      let tail = first;
      while (blocks[tail]!.next) tail = blocks[tail]!.next!;
      blocks[tail]!.next = body.next ?? null;
      if (body.next) blocks[body.next]!.parent = tail;
      body.next = first;
      blocks[first]!.parent = id;
    }
    delete blocks[configId];
  }
  blocks.explicitRoot = {
    opcode: prefix + "embeddedYamlRoot",
    fields: { VERSION: ["4.0", null], DOCUMENT: [reference, null] },
    inputs: {},
    parent: null,
    next: null,
    shadow: false,
    topLevel: true,
    x: 32,
    y: -140,
  };
  return project;
}

test("explicit independent root and named document retain the complete real scene and action graph", () => {
  const project = fixture();
  assertEmbeddedYamlBlockSource(project);
  verifyStructuredBlockSource(project, source);
});

test("rejects missing/duplicate roots, wrong versions, a connected root and unknown document references", () => {
  for (const mutate of [
    (project: ScratchProject) => {
      const blocks = project.targets.find((target) => target.isStage)!.blocks;
      delete blocks[
        Object.keys(blocks).find((id) =>
          blocks[id]!.opcode.endsWith("__embeddedYamlRoot"),
        )!
      ];
    },
    (project: ScratchProject) => {
      const blocks = project.targets.find((target) => target.isStage)!.blocks;
      blocks.duplicate = structuredClone(
        Object.values(blocks).find(({ opcode }) =>
          opcode.endsWith("__embeddedYamlRoot"),
        )!,
      );
    },
    (project: ScratchProject) => {
      const root = Object.values(project.targets[0]!.blocks).find(
        ({ opcode }) => opcode.endsWith("__embeddedYamlRoot"),
      )!;
      root.fields!.VERSION = ["3.2", null];
    },
    (project: ScratchProject) => {
      const root = Object.values(project.targets[0]!.blocks).find(
        ({ opcode }) => opcode.endsWith("__embeddedYamlRoot"),
      )!;
      root.next = "unrelated";
    },
    (project: ScratchProject) => {
      const root = Object.values(project.targets[0]!.blocks).find(
        ({ opcode }) => opcode.endsWith("__embeddedYamlRoot"),
      )!;
      root.fields!.DOCUMENT = ["missing", null];
    },
  ]) {
    const project = fixture();
    mutate(project);
    assert.throws(() => assertEmbeddedYamlBlockSource(project));
  }
});

test("new output rejects retired Config declarations and a detached editable body", () => {
  const project = fixture(),
    blocks = project.targets[0]!.blocks;
  blocks.retiredConfig = {
    opcode: "kubohiroyakamishibaiauthoring4_kamishibaiConfig",
  };
  assert.throws(() => assertEmbeddedYamlBlockSource(project), /retired/);
  delete blocks.retiredConfig;
  Object.values(blocks).find(
    ({ opcode }) => opcode === prefix + "embeddedYaml",
  )!.next = null;
  assert.throws(
    () => assertEmbeddedYamlBlockSource(project),
    /editable block body/,
  );
});

test("compatibility diagnostics derive a separate legacy fixture and preserve original script and asset bytes", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "samples-legacy-test-"));
  try {
    const input = path.join(directory, "new.sb3");
    const entries = {
      ...archive,
      "project.json": strToU8(JSON.stringify(fixture())),
    };
    const bytes = zipSync(entries);
    await writeFile(input, bytes);
    const result = await createLegacyBlockDiagnosticFixture(input, directory);
    assert.equal(result.converted, true);
    assert.notEqual(result.input, input);
    assert.deepEqual(await readFile(input), Buffer.from(bytes));
    const legacyArchive = unzipSync(await readFile(result.input));
    for (const [name, value] of Object.entries(entries))
      if (name !== "project.json")
        assert.deepEqual(legacyArchive[name], value, name);
    const legacy = JSON.parse(
      strFromU8(legacyArchive["project.json"]!),
    ) as ScratchProject;
    verifyStructuredBlockSource(legacy, source);
    assert.equal(
      Object.values(legacy.targets[0]!.blocks).filter((b) =>
        b.opcode.endsWith("_kamishibaiConfig"),
      ).length,
      1,
    );
    assert.equal(
      Object.values(legacy.targets[0]!.blocks).some((b) =>
        b.opcode.endsWith("__embeddedYamlRoot"),
      ),
      false,
    );
    assert.equal(
      (await createLegacyBlockDiagnosticFixture(result.input, directory))
        .converted,
      false,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
