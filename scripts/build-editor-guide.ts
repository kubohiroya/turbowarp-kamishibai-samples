import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  appBasePath,
  appRuntimeIdentity,
  readAppRelease,
} from "./app-dependency.ts";
import { requireFresh } from "./artifact-freshness.ts";
import { resolveBlockAuthoringBuilder } from "./block-authoring-builder.ts";

/**
 * Editor guide tutorials (kubohiroya/turbowarp-plus-editor#724).
 *
 * Each lesson is a DSL 4.0 story whose `broadcastMessageAndWait` actions hand over to Scratch
 * receivers on the guide sprite. Those receivers call the Editor Guide extension
 * (`kubohiroyaeditorguide`), which TurboWarp Plus Editor provides as a built-in extension, to
 * point at Editor UI outside the Stage and wait for the learner's real operation. The story
 * continues when the receiver finishes. The last receiver of a lesson offers the next lesson as a
 * button; the learner presses it to open the next SB3 with more Editor features switched on.
 *
 * The lessons only run their guide in TurboWarp Plus Editor, so no packaged web version is built.
 */
const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const storyRoot = path.join(projectRoot, "stories/editor-guide");
export const GUIDE_EXTENSION_ID = "kubohiroyaeditorguide";
export const editorGuideBaseUrl =
  "https://kubohiroya.github.io/turbowarp-kamishibai-samples/stories/editor-guide/";
const assetFiles = ["guide.svg", "practice.svg", "backdrop.svg"];

type Receiver =
  | {
      message: string;
      wait: { target: string; side: string; message: string; action: string };
    }
  | {
      message: string;
      next: { project: string; label: string; features: string };
    };

export interface EditorGuideLesson {
  id: string;
  source: string;
  output: string;
  receivers: Receiver[];
}

export const editorGuideLessons: EditorGuideLesson[] = [
  {
    id: "lesson-01",
    source: "lesson-01.k4.yml",
    output: "editor-guide-01-4.0.sb3",
    receivers: [
      {
        message: "案内:スプライト一覧",
        wait: {
          target: "sprite.list",
          side: "left",
          message: "ここにスプライトがならぶよ。ほしのスプライトをおしてみよう",
          action: "click",
        },
      },
      {
        message: "案内:コード",
        wait: {
          target: "code.workspace",
          side: "center",
          message: "ここがコードのばしょ。ブロックをひとつうごかしてみよう",
          action: "event:workspace.changed",
        },
      },
      {
        message: "案内:次の教材",
        next: {
          project: editorGuideBaseUrl + "editor-guide-02-4.0.sb3",
          label: "次の教材へ",
          // The first lesson starts with Git switched off; the second switches it on.
          features: "twPlusLocalGit",
        },
      },
    ],
  },
  {
    id: "lesson-02",
    source: "lesson-02.k4.yml",
    output: "editor-guide-02-4.0.sb3",
    receivers: [
      {
        message: "案内:コードの検索",
        wait: {
          target: "code.find",
          side: "bottom",
          message: "ここで、コードのなかをけんさくできるよ。おしてみよう",
          action: "click",
        },
      },
      {
        message: "案内:コード",
        wait: {
          target: "code.workspace",
          side: "center",
          message: "ブロックをもうひとつうごかしてみよう",
          action: "event:workspace.changed",
        },
      },
    ],
  },
];

/** The URL that opens the first lesson in TurboWarp Plus Editor. */
export function editorGuideStartUrl(locale = "ja") {
  const url = new URL(
    "https://kubohiroya.github.io/turbowarp-plus-editor/editor.html",
  );
  url.searchParams.set("locale", locale);
  url.searchParams.set("twPlusLocalGit", "0");
  url.searchParams.set(
    "project_url",
    editorGuideBaseUrl + editorGuideLessons[0]!.output,
  );
  return url.href;
}

async function record(root: string, filename: string) {
  const bytes = await readFile(path.join(root, filename));
  return {
    path: filename,
    size: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
}

type Block = Record<string, unknown>;

function receiverBlocks(receivers: Receiver[]) {
  const blocks: Record<string, Block> = {};
  receivers.forEach((receiver, index) => {
    const hat = `receiver-${index}`;
    const body = `body-${index}`;
    blocks[hat] = {
      opcode: "event_whenbroadcastreceived",
      next: body,
      parent: null,
      inputs: {},
      fields: { BROADCAST_OPTION: [receiver.message, `broadcast-${index}`] },
      shadow: false,
      topLevel: true,
      x: 40,
      y: 40 + index * 180,
    };
    if ("wait" in receiver) {
      const call = `guide-${index}`;
      blocks[body] = {
        opcode: "data_setvariableto",
        next: null,
        parent: hat,
        inputs: { VALUE: [3, call, [10, ""]] },
        fields: { VARIABLE: ["案内の結果", "guide-result"] },
        shadow: false,
        topLevel: false,
      };
      blocks[call] = {
        opcode: `${GUIDE_EXTENSION_ID}_spriteAndWait`,
        next: null,
        parent: body,
        inputs: {
          TARGET: [1, [10, receiver.wait.target]],
          SIDE: [1, [10, receiver.wait.side]],
          MESSAGE: [1, [10, receiver.wait.message]],
          ACTION: [1, [10, receiver.wait.action]],
        },
        fields: {},
        shadow: false,
        topLevel: false,
      };
    } else {
      blocks[body] = {
        opcode: `${GUIDE_EXTENSION_ID}_offerNext`,
        next: null,
        parent: hat,
        inputs: {
          PROJECT: [1, [10, receiver.next.project]],
          LABEL: [1, [10, receiver.next.label]],
          FEATURES: [1, [10, receiver.next.features]],
        },
        fields: {},
        shadow: false,
        topLevel: false,
      };
    }
  });
  return blocks;
}

async function costume(
  name: string,
  file: string,
  rotationCenterX: number,
  rotationCenterY: number,
) {
  const bytes = await readFile(path.join(storyRoot, file));
  const assetId = createHash("md5").update(bytes).digest("hex");
  return {
    bytes,
    entry: {
      name,
      assetId,
      md5ext: `${assetId}.svg`,
      dataFormat: "svg",
      rotationCenterX,
      rotationCenterY,
    },
  };
}

/** Add the practice and guide sprites with their Guide receivers to the verified base. */
export async function createEditorGuideBase(
  base: Uint8Array,
  lesson: EditorGuideLesson,
) {
  const archive = unzipSync(base);
  const project = JSON.parse(strFromU8(archive["project.json"]!));
  const stage = project.targets.find(
    (target: { isStage: boolean }) => target.isStage,
  );
  assert(stage, "The base has no Stage.");
  for (const [index, receiver] of lesson.receivers.entries()) {
    assert(!Object.values(stage.broadcasts).includes(receiver.message));
    stage.broadcasts[`broadcast-${index}`] = receiver.message;
  }
  const practice = await costume("ほし", "practice.svg", 40, 40);
  const guide = await costume("GuideIdle", "guide.svg", 50, 65);
  archive[practice.entry.md5ext] = practice.bytes;
  archive[guide.entry.md5ext] = guide.bytes;
  const sprite = (fields: Record<string, unknown>) => ({
    isStage: false,
    variables: {},
    lists: {},
    broadcasts: {},
    comments: {},
    currentCostume: 0,
    sounds: [],
    volume: 100,
    visible: true,
    direction: 90,
    draggable: false,
    rotationStyle: "all around",
    ...fields,
  });
  // The practice sprite comes first, so the Editor opens on a short script the learner may move.
  project.targets.push(
    sprite({
      name: "ほし",
      blocks: {
        "practice-hat": {
          opcode: "event_whenthisspriteclicked",
          next: "practice-turn",
          parent: null,
          inputs: {},
          fields: {},
          shadow: false,
          topLevel: true,
          x: 60,
          y: 60,
        },
        "practice-turn": {
          opcode: "motion_turnright",
          next: null,
          parent: "practice-hat",
          inputs: { DEGREES: [1, [4, "15"]] },
          fields: {},
          shadow: false,
          topLevel: false,
        },
      },
      costumes: [practice.entry],
      layerOrder: 1,
      x: 170,
      y: -110,
      size: 80,
    }),
    sprite({
      name: "ガイド",
      variables: { "guide-result": ["案内の結果", ""] },
      blocks: receiverBlocks(lesson.receivers),
      costumes: [guide.entry],
      layerOrder: 2,
      x: -150,
      y: -60,
      size: 100,
    }),
  );
  if (!project.extensions.includes(GUIDE_EXTENSION_ID))
    project.extensions.push(GUIDE_EXTENSION_ID);
  archive["project.json"] = strToU8(JSON.stringify(project));
  // ZIP encodes local calendar fields, so construct the same local midnight in every timezone.
  return zipSync(archive, { mtime: new Date(1980, 0, 1) });
}

/** Build every lesson from the same published base and CLI. */
export async function buildEditorGuide({
  writeLock = false,
  outputDirectory,
}: { writeLock?: boolean; outputDirectory?: string } = {}) {
  const release = await readAppRelease();
  const builder = await resolveBlockAuthoringBuilder();
  const packageJson = JSON.parse(
    await readFile(path.join(builder.root, "package.json"), "utf8"),
  );
  assert.equal(packageJson.version, release.version);
  const base = await readFile(appBasePath(release.version));
  assert.equal(base.length, release.artifact.size);
  assert.equal(
    createHash("sha256").update(base).digest("hex"),
    release.artifact.sha256,
  );
  const temporary = await mkdtemp(
    path.join(tmpdir(), "kamishibai-editor-guide-"),
  );
  const run = (args: string[]) =>
    execFileSync(process.execPath, [builder.cli, ...args], {
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
    });
  try {
    const outputs: Record<string, Awaited<ReturnType<typeof record>>> = {};
    for (const lesson of editorGuideLessons) {
      const basePath = path.join(temporary, `${lesson.id}-base.sb3`);
      await writeFile(basePath, await createEditorGuideBase(base, lesson));
      run(["validate-dsl4", "--input", path.join(storyRoot, lesson.source)]);
      run([
        "build-dsl4",
        "--embedded-source-documents",
        "--base",
        basePath,
        "--project-root",
        storyRoot,
        "--source",
        lesson.source,
        "--output",
        path.join(temporary, lesson.output),
        "--control-profile",
        "production",
        "--channel",
        "bundled",
        "--replace-existing",
      ]);
      outputs[lesson.id] = await record(temporary, lesson.output);
    }
    const lock = {
      formatVersion: 1,
      runtime: appRuntimeIdentity(release),
      builder: {
        package: packageJson.name,
        version: packageJson.version,
        commit: release.commit,
      },
      sources: await Promise.all(
        [...editorGuideLessons.map(({ source }) => source), ...assetFiles].map(
          (name) => record(storyRoot, name),
        ),
      ),
      outputs,
    };
    const lockPath = path.join(storyRoot, "dsl4-artifacts.lock.json");
    if (writeLock) {
      for (const lesson of editorGuideLessons) {
        await copyFile(
          path.join(temporary, lesson.output),
          path.join(storyRoot, lesson.output),
        );
      }
      await writeFile(lockPath, JSON.stringify(lock, null, 2) + "\n");
    } else {
      await requireFresh(async () =>
        assert.deepEqual(
          lock,
          JSON.parse(await readFile(lockPath, "utf8")),
          "Editor guide artifacts are stale; run update:editor-guide.",
        ),
      );
    }
    if (outputDirectory) {
      await mkdir(outputDirectory, { recursive: true });
      for (const name of [
        ...editorGuideLessons.map(({ source }) => source),
        ...assetFiles,
        "README.md",
        "LICENSES.md",
        "dsl4-artifacts.lock.json",
      ]) {
        await copyFile(
          path.join(storyRoot, name),
          path.join(outputDirectory, name),
        );
      }
      for (const lesson of editorGuideLessons) {
        await copyFile(
          path.join(temporary, lesson.output),
          path.join(outputDirectory, lesson.output),
        );
      }
    }
    return lock;
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const lock = await buildEditorGuide({
    writeLock: process.argv.includes("--write-lock"),
  });
  console.log(`Verified editor guide lessons ${lock.builder.version}.`);
}
