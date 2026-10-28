import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { parse, stringify } from "yaml";
import { unzipSync, zipSync, strFromU8, strToU8 } from "fflate";
import {
  dsl4ExecutableValue,
  record,
  simplifyDsl4Source,
} from "./simplify-dsl4-source.ts";
import type { RecordValue, SourceReferences } from "./simplify-dsl4-source.ts";

const root = path.resolve(import.meta.dirname, "..");
const digest = (bytes: Uint8Array | string) =>
  createHash("sha256").update(bytes).digest("hex");

/** Development candidates always have a fresh output directory and explicit App provenance. */
export async function buildSimplifiedDsl4Candidates({
  appRoot,
  outputDir,
}: {
  appRoot: string;
  outputDir: string;
}) {
  const output = path.resolve(outputDir);
  assert(
    output !== root &&
      !output.startsWith(path.join(root, "stories") + path.sep),
    "Candidates must not replace published samples.",
  );
  const load = (file: string) =>
    import(pathToFileURL(path.join(appRoot, file)).href);
  const frontendModule = await load("dist/builder/dsl4-source-frontend.js");
  const schema = JSON.parse(
    await readFile(path.join(appRoot, "schema/dsl-4.schema.json"), "utf8"),
  );
  const frontend = frontendModule.createDsl4ProductionSourceFrontend(schema, {
    narrativeControlEnabled: true,
  });
  const { collectDsl4DefinitionReferences } = await load(
    "dist/dsl4/definition-references.js",
  );
  const { extractDsl4BlockSourcesFromProject } = await load(
    "dist/dsl4/turbowarp-yaml-json-block-source.js",
  );
  const { removeDsl4BlockSourceDeclarations } = await load(
    "dist/dsl4/compiled-project.js",
  );
  const { authorDsl4BlockSourceSb3 } = await load(
    "dist/builder/dsl4-block-source-author.js",
  );
  const { prepareDsl4EmbeddedBlockStoryProject } = await load(
    "dist/dsl4/platform/embedded-block-story.js",
  );
  const { loadDsl4RuntimeComponent } = await load(
    "dist/dsl4/runtime-artifact-loader.js",
  );
  const { createDsl4RuntimeBundleSource } = await load(
    "scripts/sb3/dsl4-downloadable-release.ts",
  );
  const runtime = String(
    await createDsl4RuntimeBundleSource({
      profile: "authoring",
      narrativeControlEnabled: true,
    }),
  );
  assert(runtime.includes("// Kamishibai capabilities: simple-speech-v1"));
  const limits = {
    maxSourceBytes: 1024 * 1024,
    maxAssetFiles: 2048,
    maxTotalAssetBytes: 256 * 1024 * 1024,
    subtleCrypto: globalThis.crypto.subtle,
  };
  const provenance = {
    status: "unpublished-development",
    implementationIssues: [1083, 1084],
    appCommit: execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: appRoot,
      encoding: "utf8",
    }).trim(),
    appDiffSha256: digest(
      execFileSync("git", ["diff", "HEAD", "--binary"], {
        cwd: appRoot,
        maxBuffer: 128 * 1024 * 1024,
      }),
    ),
    runtimeSha256: digest(runtime),
  };
  const entries = [];
  for (const directory of (await readdir(path.join(root, "stories"))).sort()) {
    const storyDir = path.join(root, "stories", directory);
    for (const filename of (await readdir(storyDir)).sort()) {
      if (!/blocks.*4\.0\.sb3$/u.test(filename)) continue;
      const inputPath = path.join(storyDir, filename);
      const input = await readFile(inputPath);
      const archive = unzipSync(input);
      const project = JSON.parse(strFromU8(archive["project.json"]!));
      const graph = extractDsl4BlockSourcesFromProject(project);
      assert.equal(
        Object.keys(graph.sources).length,
        1,
        "Multi-module candidates must preserve their source graph.",
      );
      const text = graph.sources[graph.entryPath];
      assert(
        !text.includes("# kamishibai-block-sections-v1:"),
        "Disabled section recovery data must be preserved.",
      );
      const normalize = (source: RecordValue): RecordValue => {
        const parsed = frontend.parse(stringify(source), { project });
        assert(parsed.ok, JSON.stringify(parsed.diagnostics));
        return parsed.storyDocument;
      };
      const original = parse(text) as RecordValue;
      const simplified = simplifyDsl4Source(original, {
        normalize,
        references: (source) =>
          collectDsl4DefinitionReferences(source, schema) as SourceReferences,
      });
      removeDsl4BlockSourceDeclarations(project);
      project.meta = {
        ...record(project.meta),
        kamishibaiDevelopmentCandidate: provenance,
      };
      archive["project.json"] = strToU8(JSON.stringify(project));
      const sourceText = stringify(simplified.source);
      const authored = authorDsl4BlockSourceSb3({
        baseBytes: zipSync(archive),
        sourceText,
        sourceFrontend: frontend,
        narrativeRuntimeSource: runtime,
      });
      assert(authored.ok, JSON.stringify(authored.diagnostics));
      const authoredArchive = unzipSync(authored.bytes);
      const authoredProject = JSON.parse(
        strFromU8(authoredArchive["project.json"]!),
      );
      const prepared = await prepareDsl4EmbeddedBlockStoryProject(
        authoredProject,
        frontend,
        limits,
      );
      const loaded = await loadDsl4RuntimeComponent(prepared, frontend, limits);
      assert(loaded.ok, JSON.stringify(loaded.diagnostics));
      assert.equal(
        dsl4ExecutableValue(loaded.storyDocument),
        dsl4ExecutableValue(normalize(original)),
        "Candidate must preserve all executable values.",
      );
      const blocks = authoredProject.targets.flatMap((target: RecordValue) =>
        Object.values(record(target.blocks)),
      );
      const opcodes = blocks.map((block: unknown) =>
        String(record(block).opcode),
      );
      const count = (suffix: string) =>
        opcodes.filter((opcode: string) => opcode.endsWith("__" + suffix))
          .length;
      const resultPath = path.join(
        directory,
        filename.replace(".sb3", "-simple-candidate.sb3"),
      );
      const yamlPath = resultPath.replace(".sb3", ".k4.yml");
      entries.push({
        inputPath: path.relative(root, inputPath),
        outputPath: resultPath,
        yamlPath,
        inputSha256: digest(input),
        outputSha256: digest(authored.bytes),
        removed: simplified.removed,
        retained: simplified.retained,
        simpleSpeech: count("sayText") + count("thinkText"),
        specSpeech: count("say") + count("think"),
        bytes: authored.bytes,
        sourceText,
      });
    }
  }
  assert(entries.length > 0, "No DSL4 block samples found.");
  await mkdir(path.dirname(output), { recursive: true });
  await mkdir(output);
  for (const entry of entries) {
    await mkdir(path.dirname(path.join(output, entry.outputPath)), {
      recursive: true,
    });
    await writeFile(path.join(output, entry.outputPath), entry.bytes);
    await writeFile(path.join(output, entry.yamlPath), entry.sourceText);
  }
  const report = {
    formatVersion: 1,
    ...provenance,
    samplesCommit: execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: root,
      encoding: "utf8",
    }).trim(),
    samples: entries.map(
      ({ bytes: _bytes, sourceText: _source, ...entry }) => entry,
    ),
  };
  await writeFile(
    path.join(output, "verification.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
  await writeFile(
    path.join(output, "README.md"),
    [
      "# DSL4 簡易方式の検証候補",
      "",
      "App #1083・#1084に対応する開発候補です。公開済みの版とは別物です。元のSB3・YAML・lockを保持しています。",
      "",
      `App commit: ${provenance.appCommit}`,
      "",
      "| サンプル | 省略した宣言 | 簡易say/think | SPEC版を保持 |",
      "| --- | ---: | ---: | ---: |",
      ...entries.map(
        (entry) =>
          `| [${entry.inputPath}](${entry.outputPath}) | ${entry.removed.length} | ${entry.simpleSpeech} | ${entry.specSpeech} |`,
      ),
      "",
      "全候補で、生成前後の実行内容の比較・台本の読戻し・埋込素材の整合・ランタイム読込を検証しました。ブラウザーでの目視再生やカメラ・実音声の確認は別途必要です。",
      "",
      "同じディレクトリのYAMLで編集内容を確認できます。省略項目・保持理由・入力と出力のハッシュはverification.jsonに記録しています。file・remote素材、独自初期値、既定値と異なるcover、必要な操作・認識設定は保持します。",
      "",
    ].join("\n"),
  );
  return report;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const args = process.argv.slice(2);
  assert.equal(
    args.length,
    4,
    "Usage: --app-root APP_CHECKOUT --output-dir NEW_DIRECTORY",
  );
  assert.equal(args[0], "--app-root");
  assert.equal(args[2], "--output-dir");
  const report = await buildSimplifiedDsl4Candidates({
    appRoot: path.resolve(args[1]!),
    outputDir: path.resolve(args[3]!),
  });
  console.log(
    JSON.stringify(
      report.samples.map(
        ({ inputPath, removed, simpleSpeech, specSpeech }) => ({
          inputPath,
          omitted: removed.length,
          simpleSpeech,
          specSpeech,
        }),
      ),
      null,
      2,
    ),
  );
}
