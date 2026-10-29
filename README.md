# turbowarp-kamishibai-samples

English | [日本語](README.ja.md)

This repository holds the work catalogue, scripts, per-work assets, generation settings, verification and published artifacts for `TurboWarp-Kamishibai`. The published site presents them as the TurboWarp Kamishibai work library.

Work library: <https://kubohiroya.github.io/turbowarp-kamishibai-samples/>

Each work's listing category, rights information and distribution form are kept in [`site/works.json`](site/works.json), whose format is defined by [`site/works.schema.json`](site/works.schema.json). For how official samples, community works and external works are treated, see [`WORKS_POLICY.md`](WORKS_POLICY.md). External works are listed as links only; this site does not redistribute their data.

The script, source assets and generation settings for the Urashima Tarō sample live in `stories/urashima/`:

- `source.txt`: the build-time script, which refers to source assets with `file:`
- `urashima.txt`: the converted public script shared by editor and player
- `urashima.k4.yml`: DSL 4.0 YAML converted from `urashima.txt` by the official CLI
- `assets/images/`: 24 source image files
- `assets/sounds/`: 22 source audio files, unified to MP3 for web playback compatibility
- `assets.lock.json`: names, targets, hashes and metadata for the 44 embedded assets
- `sample.config.json`: generation settings for `generic` / `editor` / `player` and the web build
- `artifacts.lock.json`: sizes and SHA-256 of the reproducible artifacts
- `base/kamishibai.sb3`: the DSL 3.2 `generic` base, generated from an app commit that already carries the pose-recognition cue sound
- `base/kamishibai-4.0.sb3`: the `generic` base fetched from the app's latest published DSL 4.0 release and verified against it; its provenance is recorded in `app-release.json`

`stories/my-urashima/` is a dependent story for workshops. Besides the DSL 3.2 build, it also produces `my-urashima-4.0.sb3` — which embeds no script, carries a `Princess` sprite whose only costume is the Princess PNG, and includes the Urashima Tarō project assets — and its web build. Its generation rules and how to update it are described in [`stories/my-urashima/README.md`](stories/my-urashima/README.md).

`stories/tutorial/` holds the four-scene work for the DSL 4.0 tutorial, its starter, its addition kit, a self-contained SB3 and the pinned information for the web build. Taking the published TurboWarp-Kamishibai confirmed in `app-release.json` as its input, it publishes Pages and the work list with `publication.enabled` turned on. The docs repository uses that published URL and its integrity to perform its capture and tutorial publication. Its generation rules and how to roll back are described in [`stories/tutorial/README.md`](stories/tutorial/README.md).

The official Urashima Tarō runtime artifact uses DSL 3.2 SVG Text, and demonstrates named styles, relative font sizes and a multi-line Narration actor. The work library also distributes the DSL 4.0 YAML converted and verified by the official CLI, an offline SB3 and a single-file HTML web build. Compatibility with the deprecated older Text Asset is covered by a test fixture kept separate from the official script.

`pnpm build` uses the fully pinned TurboWarp-Kamishibai 3.2 npm builder, a 3.2 generic base with clone-only UI generated from app commit `2b5005d` and pinned by hash, a 4.0 generic base and 4.0 builder pinned by commit and hash, and `@turbowarp/packager` `3.13.0`, to produce:

- `_urashima.sb3` (`editor`): no embedded script, embedded assets; for story authors to edit
- `urashima.sb3` (`player`): script and assets embedded; for distribution and playback
- `my-urashima.sb3` (`dependent editor`): depends on `urashima`, embeds no script, carries the Princess-only sprite; for teaching
- `web/index.html`: a single HTML file with images, audio and script embedded, taking only `player` as its input
- `urashima-4.0.sb3` / `web-4.0/index.html`: offline builds with the DSL 4.0 script, every asset and the pose model embedded
- `my-urashima-4.0.sb3` / `my-urashima/web-4.0/index.html`: the workshop build, which opens an external DSL 4.0 script through a file picker or drag and drop
- `tutorial-4.0.sb3` / starter ZIP / addition kit ZIP / `web-4.0/index.html`: the DSL 4.0 tutorial artifacts, reproduced, verified and published from the same app release

A leading `_` marks a file for a story author's own use. `player` means "for playback", not "playback only" in the sense of forbidding edits. When Pages builds, every artifact is generated into an empty `dist/` from pinned inputs. The checked-in DSL 4.0 SB3 files are both the distribution source and the subject of reproducibility checks; the web HTML builds are generated rather than committed.

## License

The source code in this repository, and any content without its own license notice, is provided under the [Mozilla Public License 2.0](LICENSE) (SPDX: `MPL-2.0`). What that covers for the Urashima Tarō sample is stated in [`stories/urashima/LICENSES.md`](stories/urashima/LICENSES.md).

The images and the Teachable Machine project under `resources/20260801/` are licensed CC BY-SA 4.0. The teaching PDF added to the workshop distribution at build time is All rights reserved, Hiroya Kubo. For the exact boundaries, see [`resources/20260801/LICENSES.md`](resources/20260801/LICENSES.md).

## Build and verification

```bash
npm install --global corepack@latest
corepack enable
pnpm install --frozen-lockfile
pnpm exec playwright install chromium
pnpm typecheck
pnpm test
pnpm build
pnpm test:web
pnpm verify
pnpm run check
pnpm run release:check
```

The build and verification scripts and the tests are written in TypeScript 6. Node's native type stripping runs the `.ts` files as they are, so there is no build output and no transpilation step beforehand (`node scripts/build-site.ts`). `pnpm typecheck` only type-checks, through `tsc --noEmit`, and `pnpm test` runs the tests with Vitest. Vite is used in this repository — which has no browser bundle — as the host for the Vitest configuration (`vite.config.ts`). A build that includes the pinned CLI needs Node 24 or newer.

The site header, navigation contract and `site-shell.css` come from the shared package `@kubohiroya/turbowarp-kamishibai-site-navigation`, which TurboWarp-Kamishibai also uses. `pnpm build` copies the package's `site-shell.css` into the published site, and `pnpm verify` checks that the published copy is byte-identical to the package. To change how the navigation renders, change and release the package, then update the dependency here. `.github/workflows/navigation-contract.yml` checks that no local copy of the renderer, contract or shell has come back.

`pnpm build` generates the DSL 3.2 and 4.0 SB3 files, the Packager web builds and the published site from an empty `dist/`, and verifies scripts, SB3 files, HTML, every asset, licenses, links and SHA-256. It also generates each web build twice from the same input and confirms the hashes match. `pnpm test:web` opens each web build through an HTTP server equivalent to Pages. In headless Chromium it verifies that DSL 4.0 Urashima Tarō starts its embedded script from the title screen with outside network access blocked; that my-urashima moves from the title to the menu, opens a `.k4.yml` through a file picker and starts the story; and that the published tutorial build can be played through all four scenes with a fake camera.

`pnpm test:web` also includes a regression test that opens the block script in the real TurboWarp editor. It loads `dist/stories/urashima/urashima-blocks-4.0.sb3`, generated in CI, from the file menu, and allows the embedded extension with "run extension without sandbox". It confirms 10 scenes and 174 instructions and the absence of undefined blocks, and moves each scene's heading into view to photograph it. It then edits the opening wait from `2` to `2.75` in a number input, saves the SB3 from the file menu, converts it back to YAML with the official CLI, and verifies that nothing but the changed wait has changed in meaning. File operations use the standard file-input and download paths rather than an OS-specific picker.

This editor regression test is an online check that connects to `https://turbowarp.org/editor`. It does not depend on a published work — it verifies the SB3 generated in that run — but it can also fail because of an editor outage or a UI change. It runs even on pull requests that skip the DSL 3.2 verification. On its own it is `pnpm test:block-editor`, and to check a checked-in SB3 without building, `pnpm test:block-editor --input stories/urashima/urashima-blocks-4.0.sb3`. The YAML comparison uses the same pinned builder as the other DSL 4.0 checks.

The acceptance criteria are that loading, displaying 10 scenes, editing on screen and the semantic comparison of the saved script all succeed. The per-scene images, the post-edit image, the interaction trace, the saved SB3 and the YAML written back are stored under `.tmp/block-editor-browser/run-*/`. On failure the last screen, the failing phase and the error log are stored too, and the shared action used by CI, Pages and the scheduled verification keeps them as the `block-editor-regression` artifact for 7 days. To roll back, restore the editor-check registration in `run-web-checks.ts` and the artifact-storing step of the shared action to their state before this change.

CI and Pages fetch the app's latest published DSL 4.0 release automatically, release candidates included. They verify the commit, the release metadata and the SB3 size and SHA-256 of the same tag, line the base SB3 itself up with the player and editor builders on that one release, and then regenerate and verify every DSL 4 distribution. The whole base is updated, title and menu images included; there is no practice of swapping only the extension.

The provenance is recorded in `app-release.json` and in each artifact lock, and `app-release.json` is placed on the published site as well.

To update to upstream locally, run `pnpm update:app-release`, then point `TURBOWARP_KAMISHIBAI_APP_ROOT` at an app checkout of the recorded commit and run `pnpm update:dsl4-artifacts`. The block-authoring CLI uses that same commit. Node.js 24 or newer is required. An ordinary local build uses the recorded dependencies and does not need to resolve the latest version every time.

Pages runs on updates to main, on manual dispatch, and on an `app-release-published` repository dispatch. There is no scheduled poll of the app's published version. Every run fetches, verifies and checks the published app, and publishes only artifacts that passed. If fetching, verification, regeneration or checking fails, publication stops and the previously verified published artifacts stay in place.

`app-release-published` is a receiving end. Releases in other repositories do not propagate automatically, and at the time this was investigated the app had no code to send that notification. After the app publishes a new version, Docs and Samples are updated by an approved manual dispatch or by an update to main, and the publication is confirmed as actually live.

Each run records in its job summary the time of the check, the verified release, the source commit, the SB3 hash, what it was compared against, and the difference verdict. The summary is the result of comparing dependencies; publication itself is confirmed from the deploy job and the published URL.

Compare the [Actions history](https://github.com/kubohiroya/turbowarp-kamishibai-samples/actions) with the [published `app-release.json`](https://kubohiroya.github.io/turbowarp-kamishibai-samples/app-release.json). A maintainer with write access who updates it by hand runs the following, then confirms that deploy succeeded and checks the version, commit and hash at the published URL:

```bash
gh workflow run deploy.yml --repo kubohiroya/turbowarp-kamishibai-samples --ref main
```

To roll back dependency information, distributions or the generation process, line them all up with the last verified set. Do not let the scheduled poll come back on its own.

A block-script SB3 reads, at startup, the script whose name on the Stage is empty, as its root, and starts that story when the title is closed. Starting again after an edit picks the change up. The actual data behind a `file:` asset is shipped as the matching asset bundle.

Loading a block-script SB3 into the [Extension Data Editor](https://kubohiroya.github.io/turbowarp-extension-data-editor/editor.html?blockEditorDialogs=1&lang=ja) and allowing the embedded extension without the sandbox lets you edit the JSON of a placed block as a form, from the block's icon. Besides the eight definitions, it covers `STEPS` of `recognize actor … pose steps` and `SPEC` of `actor … say spec` and `actor … think spec`. The 11 form registrations are verified by running the embedded extension, and both works are converted back to YAML to confirm they match their original scripts. To back the form UI out, drop `blockEditorDialogs=1` from the URL; the artifacts themselves are restored by reverting this change.

The canonical command for deliberately updating the DSL 4.0 SB3 files and web locks together is `pnpm update:dsl4-artifacts`. To update only the tutorial, use `pnpm update:tutorial-dsl4`.

The DSL 4.0 web builds of Urashima Tarō and my-urashima use `dsl4.web.enabled` in their own `sample.config.json` as a feature flag fixed at startup. Left unset or `false`, Packager generation and the web lock update are skipped, the checked-in lock of the working version is kept, and the published route returns to a disabled "coming soon". To publish again, set it back to `true`; the match against the kept lock is then verified again.

The `# date:` line in a script is not updated by hand. `pnpm build` compares the SHA-256 of the script content excluding the date line against the artifact lock, and updates the date to the local date of the build environment only for scripts whose substance changed. If the content is the same, rebuilding the next day keeps the existing date and artifact hashes. The published script, SB3 and artifact lock that follow from a script change are all updated in the same build. A local run uses the OS time zone; CI and Pages releases on GitHub Actions state `Asia/Tokyo` explicitly.

When an artifact input other than a script — an asset, a generation setting — is changed deliberately, regenerate `stories/urashima/artifacts.lock.json` with `pnpm update:artifacts-lock` before running `pnpm build`. The update command actually generates the SB3 and web builds, and replaces the lock file only after two generations of the web build match. An ordinary build continues to report unintended differences in the generation environment, other than the date, as errors.

On a pull request, `.github/workflows/ci.yml` only generates and verifies. After a merge to `main`, `.github/workflows/deploy.yml` runs the same verification again and publishes only a `dist/` that passed to GitHub Pages.

After a successful Pages deployment, the Urashima Tarō block-script SB3 is fetched fresh from the deployment's output URL, its size and SHA-256 are confirmed to match the SB3 in the `dist/` just published, and then the same real-screen regression test runs. Propagation delay and temporary fetch failures are waited out with a 15-second fetch timeout, a 10-second interval and at most 12 attempts. A persistent hash mismatch, or a failure in the screen interaction or the script comparison, fails the workflow. The screen test itself is not retried.

The acceptance criteria are that, with a matching SB3 fetched from the published URL, the 10 scenes and 174 instructions display, an instruction block can be edited and saved, and the saved script compares equal. The fetch URL, time, hash and retry history go to `.tmp/published-block-editor/run-*/download.json`, with the screen test's evidence underneath it, and both are kept as the `published-block-editor-regression` artifact for 7 days, failures included. By hand it is `node scripts/verify-published-block-editor.ts --base-url https://kubohiroya.github.io/turbowarp-kamishibai-samples/`, which needs the pinned builder and a `dist/` containing the SB3 just published. To roll back, restore the two steps at the end of the deploy workflow: the published-version verification and the artifact storage. The deployed site stays up even after a failed verification, so backing a work out means redeploying the earlier artifacts separately.

## Workshop distribution for 1 August 2026

The source material for the workshop is kept in `resources/20260801/`. The command below regenerates the published site, then collects the teaching PDF, the scripts and SB3 files of Urashima Tarō and my-urashima, and the license notices, into a directory and a ZIP:

```bash
pnpm run build-workshop-20260801
```

The output goes to `dist/workshop/20260801/` and `dist/workshop/20260801.zip`. The teaching PDF is taken by default from the neighbouring `turbowarp-kamishibai-app` repository, at `output/pdf/workshops/2026-08-01/tm-kamishibai-20260801.pdf`. To use another location, give an absolute path in `TURBOWARP_KAMISHIBAI_WORKSHOP_PDF`.

## Manual deployment

Install the GitHub CLI, authenticate with an account that may run Actions in this repository, then run:

```bash
gh auth status
pnpm deploy
```

`pnpm deploy` starts the existing `Deploy GitHub Pages` workflow against the remote `main`. The Actions run URL printed by the command shows its progress. Local uncommitted changes, and commits not pushed to `main`, are not published.

If something is wrong with a publication, stop the deploy workflow and revert the offending change. If only the web build is affected, set `web.enabled` to `false` in `sample.config.json`: that stops the web output and its route while the existing SB3 and script distribution carry on. If `player` is affected, stop the general route and fall back to the `editor`, which opens an external script. For a builder defect, return the dependency tags and the base SB3 to the last verified set, and verify and publish again from `workflow_dispatch` after the fix.

The implementation plan is tracked in these issues:

- [Sample generation and GitHub Pages publication](https://github.com/kubohiroya/turbowarp-kamishibai-samples/issues/1)
- [Generating, verifying and publishing Urashima Tarō](https://github.com/kubohiroya/turbowarp-kamishibai-samples/issues/2)
- [Generating and publishing the Packager web build](https://github.com/kubohiroya/turbowarp-kamishibai-samples/issues/7)
- [Generating DSL 4.0 SB3 and web builds automatically](https://github.com/kubohiroya/turbowarp-kamishibai-samples/issues/90)
- [The DSL 4.0 tutorial work, starter and addition kit](https://github.com/kubohiroya/turbowarp-kamishibai-samples/issues/94)

## Turning part of a script on and off

In a published block-script SB3, the purple "Kamishibai Block Script" palette offers "use this section [on/off]". Wrap a definition, or a run of instructions inside a scene; turning it off leaves the inside in place but takes it out of what runs. Save, then start the story again to see the effect. See the [illustrated instructions](https://kubohiroya.github.io/turbowarp-kamishibai-docs/4.0/block-author-guides/dsl-4.0-block-author-guide/#use-section).

The app's own default stays OFF; here, `dsl4.blockAuthoring.sourceSections: true` in `stories/urashima/sample.config.json` passes `--block-sections true` at generation time. The 2-, 3- and 4-pose builds of my-urashima use the same setting. To back it out, revert that setting, the generation and verification changes, and the block SB3 files and locks together, then publish Pages again.

The YAML-to-blocks conversion separates the control, asset, cover, textStyle, variable, loading and recognition definitions into `kamishibaiConfig [name]`. The setting with an empty name comes first, then the rest in name order, loaded implicitly from the Stage's empty-named `kamishibai`. Two setting hats with the same name — including two empty ones — are a startup error. The app side is [app #916](https://github.com/kubohiroya/turbowarp-kamishibai-app/issues/916), and the distribution update is tracked in [samples #184](https://github.com/kubohiroya/turbowarp-kamishibai-samples/issues/184). The six block-script SB3 files distributed here are generated from the same authoring pin, including the embedded runtime that can read the setting hats. The rc.25 runtime pin for playback stays as it is. To back out, return the authoring pin, the six SB3 files and the locks as one set.

### Block and Schema diagnostics in the published distribution

`pnpm test:block-diagnostics` fetches the Urashima Tarō block-script SB3 currently being served, checks its hash and size against the generated artifact, and loads it into the published editor. It injects an "if", a "repeat" and a "say" into a sprite's script in turn, and confirms the Japanese block and sprite names, switching to the code tab, expanding the parent, moving to and highlighting the target, and clean recovery once they are removed. The evidence is stored under `.tmp/published-block-diagnostics/`.

The same browser regression combines `includeBlocks` on the Stage, an included script on one sprite, and `kamishibaiConfig` on another. An asset definition is tested with an object whose `kind` is invalid, then an invalid string. Even when the diagnostic names the generated Stage YAML, the selected target and block IDs must match the original configuration sprite and asset block. Each edit must reach the VM before restarting, so both cases cannot accidentally inspect the previous value. It also checks parent expansion, scrolling, highlighting and normal startup after removing the temporary definition.

The test uses the published [TurboWarp-Plus-Editor](https://kubohiroya.github.io/turbowarp-plus-editor/editor.html?lang=ja). Failures retain the phase, diagnostics, expected and actual IDs, screenshots and trace. The shared verify action runs all five cases for PR CI and scheduled verification; the Pages workflow repeats them against the actually published SB3.

In CI on a pull request the same check is given the locally generated SB3; after Pages publishes, it uses the SB3 actually being served. The test blocks and values exist only inside that browser, and are never saved into a distributed SB3 or an original script.

### App dependency information and work settings

The only source of truth for the DSL 4.0 dependency version and commit, and for the source identity, size and SHA-256 of the Standard SB3, is `app-release.json` at the root. The playback CLI, the block-authoring CLI, the CI checkout and artifact verification all read that one manifest. Syncing a published release updates only the manifest and the base SB3; it does not rewrite work settings. The dependency information in a generated artifact lock is verification evidence, not a build input pin.

Per-work output names, size limits and the flags for web and teaching publication are consolidated under `dsl4` in each `sample.config.json`. `runtime`, `version` or `releaseDependency` in a work setting, and a separate commit for authoring, are errors. Locally, the checked-in manifest is used, so the same published version builds without a network connection. To update the dependency version, run `pnpm update:app-release` and check the manifest and the base as one set.

Rolling this migration back means reverting, as a whole, the pull request that carries the settings, the shared reader and the CI changes. It does not change artifacts of the same published app version.

## Audio example for the next 4.0 prerelease

The [audio playback sample](stories/audio-playback/README.md) is a script aimed at the 4.0 prerelease after rc.38. It exercises fadeIn, volume and fadeOut during playback, fadeOut on stop, and per-ID control. The existing published build and distribution lock are kept; the artifacts will be lined up once the supporting version is published.

## Repetition and branching in a story (Standard in the 4.0 RCs)

[Three Visits](stories/three-visits/README.md) is a published sample for the Standard available from App 4.0.0-rc.44 onwards. The visit the three share is written once, and the endings are compared through each round's list and its conditions. No extra experimental flag is needed. The YAML build, the block build and both web builds are generated from the official base SB3 and a CLI at the same release commit, and the table can be edited in the published editor. App rc.59 is published to npm; reproducible sample generation uses the CLI from the matching release tag. The samples for the stable 3.2 series are kept as they are.

## What rc.59 is generated from, and extension security

The earlier rc.59 samples were generated with a CLI at the same commit as published App `4.0.0-rc.59`. Camera Source 0.21.0, Asset Cache 0.5.0 and Bubble 0.15.0 reach directly into the editor's internals, so they have to run outside the sandbox. The published editor does not support "with sandbox" for them, and shows "Required to run" beside "without sandbox". Check where the extension came from and choose it deliberately. Granting camera access is a separate step in the browser.

See the [explanation of the dialogs and run modes, in English and Japanese](https://kubohiroya.github.io/turbowarp-kamishibai-docs/4.0/user-guides/user-guide-4.0/#extension-security). The works and published routes for the stable 3.2 series are kept.

rc.59 includes the builder preview teardown of App PR #1045 and the removal of sealed in #1042. The source and compiled distributions remain available. Older sealed works from rc.51 to rc.55 are not supported, so regenerate them as source or compiled from the original YAML and material. For reproducible generation, prepare the generating CLI from the commit of the published tag named in `app-release.json`, and line it up with the same version as the base SB3. The stable 3.2 works are not regenerated by this update.

## DSL4の宣言省略・簡易セリフの候補

[App #1083](https://github.com/kubohiroya/turbowarp-kamishibai-app/issues/1083)・[#1084](https://github.com/kubohiroya/turbowarp-kamishibai-app/issues/1084)に対応するCLI・ランタイムを使い、DSL4のブロック台本サンプル全8本を簡易方式で生成・検証できます。公開済み成果物とlockを保持し、別ディレクトリへ開発候補を出します。

```sh
node scripts/build-simplified-dsl4-candidates.ts \
  --app-root ../turbowarp-kamishibai-app \
  --output-dir .tmp/simple-native-dsl4
```

App側は対象実装を含むcheckoutで、先に`pnpm run build:lib`を実行します。出力先は新しいディレクトリを指定します。生成したSB3とYAMLは`*-simple-candidate`という別名になり、`verification.json`にAppのcommit・作業差分のハッシュ、runtimeのハッシュ、入力・出力のハッシュ、省略した宣言、保持した理由を記録します。候補を現在の公開版として扱いません。

SB3内に実在する背景・衣装・音は、実名への置換と宣言省略を試し、共通frontendで正規化した実行内容が等しい場合だけ適用します。同名spriteの最初の衣装と初期状態が一致するactor、既定値と一致するcover、初期値1のstartSceneIndexも同様です。動的・外部参照を確定できない宣言、file・remote素材、独自初期値、表紙の選択、必要な操作・認識設定を保持します。

textとsecondsだけのsay/thinkは簡易版になります。装飾・入力待ちなどを使うものはSPEC版を保持します。生成後は台本を読み戻して実行内容を比較し、埋込アセットの整合とランタイム読込も検証します。既存の公開版参照を更新する際は、対応Appの公開を確認してから従来の公開版追従経路で成果物とlockを揃えます。切戻しは既存の公開SB3・YAML・lockを使います。

## rc.68公開版と標準素材によるブロック台本

現在の対応Appと生成元commitは`app-release.json`を参照してください。rc.68以降の公開版に追従する生成では、ブロック台本の背景・衣装・音のfile素材をStage／スプライトの標準素材へ設定し、画像・音の実バイトと初期状態を照合してからasset・actor等の宣言を省略します。`Urashima`の`Urashima-walk-1`は元のPNGをそのコスチュームへ設定して実名参照します。YAML制作元のfile指定やposeモデル等の必要な宣言は保持します。

元のYAMLと生成ブロックの比較は、SB3実体を文脈として正規化した実行値と素材のSHA-256で行います。媒体の保持形式が変わっても画像・音・命令・初期状態が変わらないこと、text／secondsだけのsay/thinkは簡易版になり、高度なSPEC版は保持されることを検証します。Stageに音を追加した場合も、元の表紙が無音ならそれを保つcoverを明示します。旧file素材の配信用データは整合性を検証してから除き、保持するモデル等だけでbundleを作り直します。DSL4のWeb版は標準音のバイト列を音声命令から取得できるようPackagerのpackagedRuntimeをfalseにし、その設定をlockに記録します。公開前候補の生成コマンドは引き続き別出力用であり、公開済み成果物の上書きには使いません。
