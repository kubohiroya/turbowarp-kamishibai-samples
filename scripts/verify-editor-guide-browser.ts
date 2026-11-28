import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium, type Page } from "playwright";

import {
  editorGuideBaseUrl,
  editorGuideLessons,
  editorGuideStartUrl,
} from "./build-editor-guide.ts";

/**
 * Play both Editor guide lessons in TurboWarp Plus Editor, headless, as a learner would:
 * start the story, advance the speech, do each operation the guide asks for, and press the
 * next-lesson button. The lesson SB3 files are served from stories/editor-guide/ in place of their
 * published URLs, so this checks the files that are about to be published.
 *
 * TURBOWARP_PLUS_EDITOR_BUILD may name a local Editor build directory (for an Editor that is not
 * published yet); otherwise the published Editor is used.
 */
const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const storyRoot = path.join(projectRoot, "stories/editor-guide");
const publishedEditor = "https://kubohiroya.github.io/turbowarp-plus-editor/";

async function localEditorOrigin(directory: string) {
  const root = path.resolve(directory);
  const server = createServer(async (request, response) => {
    try {
      const relative = decodeURIComponent(
        new URL(request.url!, "http://local").pathname,
      ).replace(/^\/turbowarp-plus-editor\//u, "");
      const target = path.resolve(root, relative || "editor.html");
      if (!target.startsWith(root + path.sep))
        return void response.writeHead(403).end();
      const types: Record<string, string> = {
        ".html": "text/html",
        ".js": "text/javascript",
        ".css": "text/css",
        ".json": "application/json",
        ".svg": "image/svg+xml",
        ".wasm": "application/wasm",
      };
      response.setHeader(
        "Content-Type",
        types[path.extname(target)] ?? "application/octet-stream",
      );
      response.end(await readFile(target));
    } catch {
      response.writeHead(404).end();
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert(address && typeof address !== "string");
  return {
    origin: `http://127.0.0.1:${address.port}/turbowarp-plus-editor/`,
    close: () => server.close(),
  };
}

async function waitForProject(page: Page, chapterTarget: string) {
  // The kamishibai runtime is an unsandboxed extension, so the Editor asks the learner first.
  await page
    .getByRole("button", { name: "すべて有効にして実行" })
    .click({ timeout: 60_000 });
  await page.waitForFunction(
    (name) =>
      Boolean(
        (window as any).vm?.runtime?.targets?.some(
          (target: any) => target.getName?.() === name,
        ),
      ),
    chapterTarget,
    { timeout: 60_000 },
  );
  await page.waitForFunction(
    () =>
      Boolean(
        (window as any).vm.runtime._primitives[
          "kubohiroyaeditorguide_spriteAndWait"
        ],
      ),
    undefined,
    { timeout: 30_000 },
  );
}

const runtimeReporter = "kubohiroyakamishibai4_kubohiroyakamishibairuntime4__";

/** The story's position, read through the kamishibai runtime's own state reporter. */
async function actionPath(page: Page): Promise<string> {
  return page.evaluate(
    (prefix) =>
      String(
        (window as any).vm.runtime._primitives[
          prefix + "currentActionPathReporter"
        ]({}, {}),
      ),
    runtimeReporter,
  );
}

async function atAction(page: Page, index: number) {
  await page.waitForFunction(
    ([prefix, expected]) =>
      String(
        (window as any).vm.runtime._primitives[
          prefix + "currentActionPathReporter"
        ]({}, {}),
      ) === expected,
    [runtimeReporter, `/scenes/tour/actions/${index}`] as const,
    { timeout: 30_000 },
  );
}

/**
 * In the Editor the embedded story takes advance input from the keyboard (Space is
 * navigation.nextAction); a press on the Stage only moves focus away from an input.
 */
async function advance(page: Page, from: number) {
  await atAction(page, from);
  const box = await page.evaluate(() => {
    const rect = (
      window as any
    ).vm.runtime.renderer.canvas.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height * 0.2 };
  });
  await page.mouse.click(box.x, box.y);
  await page.keyboard.press("Space");
  await page.waitForFunction(
    ([prefix, current]) =>
      String(
        (window as any).vm.runtime._primitives[
          prefix + "currentActionPathReporter"
        ]({}, {}),
      ) !== current,
    [runtimeReporter, `/scenes/tour/actions/${from}`] as const,
    { timeout: 5_000 },
  );
}

/** The guide holds the story at its broadcast until the learner does the operation. */
async function guide(page: Page, broadcast: number, text: RegExp) {
  const element = page.locator("[data-tw-guide-speech]");
  await element.waitFor({ state: "visible", timeout: 30_000 });
  assert.match((await element.textContent()) ?? "", text);
  // Longer than the speech fallback is not needed: a broadcast has no timeout of its own.
  await page.waitForTimeout(1000);
  assert.equal(
    await actionPath(page),
    `/scenes/tour/actions/${broadcast}`,
    "The story must wait for the operation.",
  );
}

async function moveOneBlock(page: Page) {
  await page.evaluate(() => {
    const workspace = (window as any).ScratchBlocks.getMainWorkspace();
    const [block] = workspace.getTopBlocks(false);
    if (!block) throw new Error("The editing target has no script to move.");
    block.moveBy(24, 16);
  });
}

async function startStory(page: Page) {
  await page.evaluate(() => (window as any).vm.greenFlag());
  // The kamishibai title waits for a press on the Stage before the story starts.
  await page.getByText("紙芝居を始める").click({ timeout: 30_000 });
}

export async function verifyEditorGuideBrowser() {
  const local = process.env.TURBOWARP_PLUS_EDITOR_BUILD
    ? await localEditorOrigin(process.env.TURBOWARP_PLUS_EDITOR_BUILD)
    : null;
  const editorBase = local?.origin ?? publishedEditor;
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 960 },
    });
    page.on("pageerror", (error) =>
      console.log("Browser error:", error.message),
    );
    for (const lesson of editorGuideLessons) {
      const bytes = await readFile(path.join(storyRoot, lesson.output));
      await page.route(editorGuideBaseUrl + lesson.output, (route) =>
        route.fulfill({
          body: bytes,
          contentType: "application/octet-stream",
          headers: { "Access-Control-Allow-Origin": "*" },
        }),
      );
    }
    const start = new URL(editorGuideStartUrl());
    const first = new URL("editor.html" + start.search, editorBase);
    await page.goto(first.href);
    await waitForProject(page, "ガイド");
    assert.equal(new URL(page.url()).searchParams.get("twPlusLocalGit"), "0");

    // Lesson 1. Actions 0-2 set the Stage and show the actors.
    await startStory(page);
    for (const index of [3, 4, 5]) await advance(page, index);
    await guide(page, 6, /スプライトがならぶよ/u);
    await page
      .locator('[class*="sprite-selector_items-wrapper"]')
      .getByText("ほし", { exact: true })
      .click();
    await page.locator("[data-tw-guide-speech]").waitFor({ state: "detached" });
    for (const index of [7, 8]) await advance(page, index);
    await guide(page, 9, /ブロックをひとつうごかしてみよう/u);
    await moveOneBlock(page);
    await page.locator("[data-tw-guide-speech]").waitFor({ state: "detached" });
    for (const index of [10, 11]) await advance(page, index);
    const next = page.getByRole("link", { name: "次の教材へ" });
    await next.waitFor({ state: "visible", timeout: 30_000 });
    const href = new URL((await next.getAttribute("href"))!);
    assert.equal(
      href.searchParams.get("project_url"),
      editorGuideBaseUrl + editorGuideLessons[1]!.output,
    );
    assert.equal(href.searchParams.get("twPlusLocalGit"), "1");
    assert.equal(href.searchParams.get("locale"), "ja");
    for (const index of [13]) await advance(page, index);
    await atAction(page, 14);
    await next.click();

    // Lesson 2 keeps the language and switches Git on.
    await page.waitForURL(
      (url) => url.searchParams.get("twPlusLocalGit") === "1",
      { timeout: 30_000 },
    );
    await waitForProject(page, "ガイド");
    assert.equal(new URL(page.url()).searchParams.get("locale"), "ja");
    assert.equal(
      await page.getByRole("link", { name: "次の教材へ" }).count(),
      0,
    );
    await startStory(page);
    for (const index of [3, 4]) await advance(page, index);
    await guide(page, 5, /コードのなかをけんさく/u);
    await page.locator("input.sa-find-input").click();
    await page.locator("[data-tw-guide-speech]").waitFor({ state: "detached" });
    for (const index of [6, 7]) await advance(page, index);
    await guide(page, 8, /ブロックをもうひとつうごかしてみよう/u);
    // Skipping with the story's own navigation ends the wait and leaves no guide behind.
    await page.keyboard.press("Space");
    await atAction(page, 9);
    await page.locator("[data-tw-guide-speech]").waitFor({ state: "detached" });
    await page.locator("[data-tw-guide-sprite]").waitFor({ state: "detached" });
    assert.equal(
      await page.evaluate(
        () =>
          (window as any).vm.runtime.targets.find(
            (t: any) => t.getName() === "ガイド",
          ).visible,
      ),
      true,
    );
    for (const index of [9, 10, 11]) await advance(page, index);
    await atAction(page, 12);
    assert.equal(
      await page.getByRole("link", { name: "次の教材へ" }).count(),
      0,
    );
    await page.screenshot({
      path: path.join(projectRoot, ".tmp/editor-guide-lesson-02.png"),
    });
  } catch (error) {
    const [page] = browser.contexts()[0]?.pages() ?? [];
    await page?.screenshot({
      path: path.join(projectRoot, ".tmp/editor-guide-failure.png"),
    });
    throw error;
  } finally {
    await browser.close();
    local?.close();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await verifyEditorGuideBrowser();
  console.log("Played both Editor guide lessons in TurboWarp Plus Editor.");
}
