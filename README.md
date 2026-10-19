# turbowarp-kamishibai-samples

`TurboWarp-Kamishibai` の作品カタログ、台本、作品固有アセット、生成設定、検証、公開物を管理するリポジトリです。公開ページでは「TurboWarp紙芝居 作品ライブラリ」として提供します。

作品ライブラリ: <https://kubohiroya.github.io/turbowarp-kamishibai-samples/>

作品の掲載区分、権利情報、配布形態は[`site/works.json`](site/works.json)で管理し、その形式を[`site/works.schema.json`](site/works.schema.json)で定義します。公式サンプル、コミュニティ作品、外部作品の扱いは[`WORKS_POLICY.md`](WORKS_POLICY.md)を参照してください。外部作品はリンクのみを掲載し、このサイトでは作品データを再配布しません。

浦島太郎サンプルの台本、元アセット、生成設定は `stories/urashima/` に配置しています。

- `source.txt`: 元アセットを `file:` 参照するビルド元台本
- `urashima.txt`: editor/playerで共通の変換済み公開用台本
- `urashima.k4.yml`: 公式CLIで`urashima.txt`から変換したDSL 4.0 YAML
- `assets/images/`: 画像元データ 24ファイル
- `assets/sounds/`: Web再生互換性のためMP3へ統一した音声元データ 22ファイル
- `assets.lock.json`: 組み込み対象44件の名前・target・ハッシュ・メタデータ
- `sample.config.json`: `generic` / `editor` / `player` とWeb版の生成設定
- `artifacts.lock.json`: 再現可能な生成物のサイズとSHA-256
- `base/kamishibai.sb3`: ポーズ認識成立音対応済み本体コミットから生成したDSL 3.2 `generic` ベース
- `base/kamishibai-4.0.sb3`: 公開済みDSL 4.0.0-rc.25（埋め込みTeachable Machine拡張 3.5.1とCamera Source 0.15.0）のrelease artifactを、サイズとSHA-256を固定して取り込んだ`generic`ベース

`stories/my-urashima/`はワークショップ用の依存ストーリーです。DSL 3.2版に加え、Princess PNGを唯一のコスチュームとして持つ`Princess`スプライトと浦島太郎のプロジェクトアセットを組み込んだ、台本非埋め込みの`my-urashima-4.0.sb3`およびWeb版も生成します。生成規約と更新方法は[`stories/my-urashima/README.md`](stories/my-urashima/README.md)に記載しています。

`stories/tutorial/`にはDSL 4.0チュートリアル用の4場面作品、starter、addition kit、自己完結SB3、Web版の固定情報があります。公開済みTurboWarp-Kamishibai `4.0.0-rc.25`を入力として、`publication.enabled`をONにしたPagesと作品一覧を公開します。docs側はその公開URLとintegrityを使ってcaptureとチュートリアルpublicationを行います。生成規約とロールバック方法は[`stories/tutorial/README.md`](stories/tutorial/README.md)に記載しています。

正式な浦島太郎の実行用成果物はDSL 3.2のSVG Textを使い、名前付きstyle、相対font size、複数行のNarration actorを実演します。作品ライブラリでは、公式CLIで変換・検証したDSL 4.0 YAML、オフラインSB3、単一HTML Web版も併せて配布します。deprecatedな旧Text Assetは正式台本から分離したテストfixtureで互換性を確認します。

`pnpm build` は、完全固定したTurboWarp-Kamishibai 3.2 npmビルダー、本体コミット`2b5005d`から生成してハッシュ固定したclone-only UIの3.2汎用ベース、commitとハッシュを固定した4.0汎用ベースおよび4.0ビルダー、`@turbowarp/packager` `3.13.0` を使い、次の成果物を生成します。

- `_urashima.sb3` (`editor`): 台本非埋め込み・アセット埋め込み。物語作成者の編集用
- `urashima.sb3` (`player`): 台本・アセット埋め込み。配布・再生用
- `my-urashima.sb3` (`dependent editor`): `urashima`依存・台本非埋め込み・Princess専用スプライト付きの教材用
- `web/index.html`: `player`だけを入力とする、画像・音声・台本組み込み済みの単一HTML
- `urashima-4.0.sb3` / `web-4.0/index.html`: DSL 4.0台本・全アセット・ポーズモデル組み込み済みのオフライン版
- `my-urashima-4.0.sb3` / `my-urashima/web-4.0/index.html`: DSL 4.0外部台本をファイル選択またはドラッグ＆ドロップで開くワークショップ版
- `tutorial-4.0.sb3` / starter ZIP / addition kit ZIP / `web-4.0/index.html`: 4.0.0-rc.25で再現・検証して公開するDSL 4.0チュートリアル成果物

先頭の `_` は物語作成者による内部的使用を示します。`player` は編集禁止を意味する「再生専用」ではなく「再生用」です。GitHub Pagesのビルド時には空の`dist/`へすべての成果物をロック済み入力から生成します。DSL 4.0のチェックイン済みSB3は配布元かつ再現性検証対象であり、Web版HTMLはリポジトリへコミットせず自動生成します。

## ライセンス

本リポジトリのソースコードと、個別のライセンス表示がないコンテンツは[Mozilla Public License 2.0](LICENSE)（SPDX: `MPL-2.0`）で提供します。浦島太郎サンプルの適用範囲は[`stories/urashima/LICENSES.md`](stories/urashima/LICENSES.md)に明記しています。

`resources/20260801/`の画像とTeachable MachineプロジェクトにはCC BY-SA 4.0が適用されます。ワークショップ配布物にビルド時に加えるPDF教材はHiroya KuboのAll rights reservedです。詳細な境界は[`resources/20260801/LICENSES.md`](resources/20260801/LICENSES.md)を参照してください。

## ビルドと検証

```bash
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

ビルド・検証スクリプトとテストはTypeScript 6で書かれています。Nodeのネイティブ型剥がしで`.ts`をそのまま実行するため、ビルド成果物や事前のトランスパイルはありません（`node scripts/build-site.ts`）。`pnpm typecheck`は`tsc --noEmit`による型検査だけを行い、`pnpm test`はVitestでテストを実行します。Viteはブラウザ向けバンドルを持たないこのリポジトリではVitest設定（`vite.config.ts`）のホストとして使います。固定CLIを含むビルドにはNode 24以上が必要です。

`scripts/site-navigation.mjs`はTurboWarp-Kamishibaiの3リポジトリ間で`cmp`によりバイト一致を保つ契約ファイルです。正本は`scripts/site-navigation.ts`で、`pnpm build:site-navigation`が`.mjs`を生成します。生成はNode自身の型剥がし（`module.stripTypeScriptTypes`）で行うため、元の整形と空行がそのまま残り、生成物は各リポジトリの現行ファイルとバイト単位で一致します。仕上げのPrettierは契約先リポジトリの`.prettierrc.json`と同じ設定です。`pnpm verify`（および`.github/workflows/navigation-contract.yml`）は`pnpm check:site-navigation`で生成物が最新かを検査します。ナビゲーション描画を変更するときは`.ts`を編集して再生成し、生成された`.mjs`を各リポジトリへ配布します。`.mjs`を直接編集した場合は`pnpm check:site-navigation`が検出します。

`pnpm build` は空の `dist/` からDSL 3.2／4.0のSB3、Packager Web版、公開サイトを生成し、台本・SB3・HTML・全アセット・ライセンス・リンク・SHA-256を検証します。同じ入力から各Web版を2回生成してハッシュが一致することも確認します。`pnpm test:web` はPages相当のHTTPサーバで各Web版を開きます。DSL 4.0浦島太郎では外部ネットワークを遮断した状態でタイトル画面から組み込み台本が開始すること、my-urashimaではタイトルからメニューへ進み、`.k4.yml`をファイル選択して物語が開始すること、tutorial公開版では偽カメラを使って4場面を最後まで進められることをheadless Chromiumで検証します。

`pnpm test:web`には、ブロック台本を実際のTurboWarpエディターで開く回帰テストも含まれます。CIで生成した`dist/stories/urashima/urashima-blocks-4.0.sb3`をファイルメニューから読み込み、埋め込み拡張を「サンドボックスなしで実行する」で許可します。10場面・174命令と未定義ブロックの不在を確認し、各場面の見出しを画面内へ移して撮影します。冒頭の待機時間を数値入力から`2`→`2.75`へ編集し、ファイルメニューから保存したSB3を公式CLIでYAMLへ戻し、変更した待機時間以外の意味が維持されることまで検証します。ファイル操作は、OS固有のピッカーを使わない標準のファイル入力・ダウンロード経路を使います。

このエディター回帰テストは`https://turbowarp.org/editor`へ接続するオンライン検査です。公開中の作品には依存せず、今回生成したSB3を検証しますが、エディターの配信障害やUI変更でも失敗する場合があります。DSL 3.2検証を省略するPRでもこの検査は実行します。単独では`pnpm test:block-editor`、ビルドせずチェックイン済みSB3を確認する場合は`pnpm test:block-editor --input stories/urashima/urashima-blocks-4.0.sb3`で実行できます。YAML照合にはほかのDSL 4.0検証と同じ固定ビルダーを使います。

受け入れ基準は、読み込み・10場面表示・画面編集・保存した台本の意味的照合がすべて成功することです。結果、各場面の画像、編集後画像、操作トレース、保存SB3、書き戻したYAMLは`.tmp/block-editor-browser/run-*/`へ保存します。失敗時は最後の画面と失敗フェーズ・エラーログも保存し、CI／Pages／定期検証の共有actionから`block-editor-regression` artifactとして7日間保持します。ロールバックは、`run-web-checks.ts`のエディター検査登録と共有actionのartifact保存ステップをこの変更前へ戻します。

CIとPages workflowはTurboWarp-Kamishibaiを`dsl4-build.config.json`に固定したcommitへcheckoutし、`TURBOWARP_KAMISHIBAI_APP_ROOT`でビルダー位置を指定します。ローカルでは隣接する`../turbowarp-kamishibai-app`を既定値として使います。ブロック台本用CLIは同じ設定の`blockAuthoring.commit`へ別途固定し、`TURBOWARP_KAMISHIBAI_BLOCK_AUTHORING_ROOT`で指定します。再生用とブロック台本用の両CLIをrc.25の公開タグのcommitへ固定し、浦島太郎とtutorialのブロック台本を生成・YAMLへ書き戻します。このCLIにはNode 24以上が必要です。

ブロック台本SB3はStage上の名前が空の台本をルートとして起動時に読み取り、タイトルを閉じるとその物語を開始します。編集後に開始し直すと変更が反映されます。file素材の実体は対応するアセットバンドルとして同梱します。

ブロック台本SB3は[Extension Data Editor](https://kubohiroya.github.io/turbowarp-extension-data-editor/editor.html?blockEditorDialogs=1&lang=ja)へ読み込み、埋め込み拡張をサンドボックスなしで許可すると、専用定義ブロックの書類アイコンからJSONをフォーム編集できます。8種類のフォーム登録を埋め込み拡張の実行で検証し、両作品をYAMLへ戻して元台本との一致も確認します。フォームUIの切り戻しはURLの`blockEditorDialogs=1`を外し、成果物自体はこの更新のrevertで戻します。

DSL 4.0のSB3とWebロックを意図的に一括更新する正規コマンドは`pnpm update:dsl4-artifacts`です。tutorialだけを更新する場合は`pnpm update:tutorial-dsl4`を使います。

浦島太郎とmy-urashimaのDSL 4.0 Web版は、各`dsl4-build.config.json`の`web.enabled`を起動時固定のfeature flagとして使います。未指定または`false`ではPackager生成とWeb lock更新をスキップし、チェックイン済みの有効版lockを保持したまま公開導線をdisabledの「準備中」へ戻します。再公開時は`true`へ戻すだけで、保持したlockとの一致を再検証します。

台本の`# date:`は手動更新しません。`pnpm build`は日付行を除いた台本内容のSHA-256をartifact lockと比較し、実質内容が変わった台本だけ、ビルド実行環境のローカル年月日へ更新します。内容が同じなら翌日の再ビルドでも既存日付と成果物ハッシュを維持します。台本変更に伴う公開台本、SB3、artifact lockは同じビルドで更新されます。ローカル実行ではOSのタイムゾーンを使い、GitHub ActionsのCI／Pagesリリースでは`Asia/Tokyo`を明示します。

アセット、生成設定など、台本以外の成果物入力を意図的に変更した場合は、`pnpm update:artifacts-lock` で `stories/urashima/artifacts.lock.json`を再生成してから`pnpm build`を実行します。更新コマンドはSB3とWeb版を実際に生成し、Web版の2回生成が一致した後にだけロックファイルを置き換えます。通常のビルドでは、日付以外の意図しない生成環境差分を引き続きエラーとして検出します。

Pull Requestでは `.github/workflows/ci.yml` が生成と検証だけを行います。`main` へのマージ後は `.github/workflows/deploy.yml` が同じ検証を再実行し、成功した `dist/` だけをGitHub Pagesへ公開します。

Pagesデプロイ成功後は、deploymentの出力URLから浦島太郎のブロック台本SB3を新規取得し、今回公開した`dist/`のSB3とサイズ・SHA-256が一致することを確認してから、同じ実画面回帰テストを実行します。配信の反映遅延や一時的な取得失敗は15秒の取得タイムアウト・10秒間隔・最大12回で待ちます。ハッシュ不一致が続く場合や画面操作・台本照合が失敗した場合はworkflowを失敗させます。画面テスト自体の再試行は行いません。

受け入れ基準は、公開URLから取得した一致済みSB3で10場面・174命令の表示、命令ブロックの編集・保存、保存後の台本照合が成功することです。取得URL・日時・ハッシュ・再試行履歴は`.tmp/published-block-editor/run-*/download.json`、画面テストの証跡はその配下へ保存し、失敗時も`published-block-editor-regression` artifactとして7日間保持します。手動では`node scripts/verify-published-block-editor.ts --base-url https://kubohiroya.github.io/turbowarp-kamishibai-samples/`で実行できます。固定ビルダーと今回公開したSB3を含む`dist/`が必要です。ロールバックはdeploy workflow末尾の公開版検証・artifact保存の2ステップを戻します。検証失敗後もデプロイ済みのサイトは残るため、作品の切り戻しが必要な場合は別途元の成果物を再デプロイします。

## 2026年8月1日ワークショップ配布物

ワークショップ用の元素材は`resources/20260801/`で管理します。次のコマンドは公開サイトを再生成した後、教材PDF、浦島太郎とmy-urashimaの台本・SB3、ライセンス表示を集め、ディレクトリとZIPを作成します。

```bash
pnpm run build-workshop-20260801
```

出力先は`dist/workshop/20260801/`と`dist/workshop/20260801.zip`です。教材PDFの既定入力は、隣接する`turbowarp-kamishibai-app`リポジトリの`output/pdf/workshops/2026-08-01/tm-kamishibai-20260801.pdf`です。別の場所を使う場合は`TURBOWARP_KAMISHIBAI_WORKSHOP_PDF`に絶対パスを指定します。

## 手動デプロイ

GitHub CLIをインストールして、このリポジトリへのActions実行権限を持つアカウントで認証した後、次を実行します。

```bash
gh auth status
pnpm deploy
```

`pnpm deploy` は、既存の `Deploy GitHub Pages` workflowをリモートの `main` に対して起動します。コマンドの出力に表示されるActions runのURLから進行状況を確認できます。ローカルの未コミット変更や、`main` へpushされていないコミットは公開対象になりません。

公開に問題がある場合はdeploy workflowを停止し、問題の変更をrevertします。Web版だけに問題がある場合は `sample.config.json` の `web.enabled` を `false` にし、Web出力と導線を止めても既存のSB3・台本配信は維持できます。`player`に問題がある場合は一般向け導線を停止し、外部台本を開く`editor`へ切り戻せます。ビルダーの不具合では依存タグとベースSB3を直前の検証済み組へ戻し、修正後に `workflow_dispatch` から再検証・再公開します。

実装計画は次のIssueで管理します。

- [サンプル生成とGitHub Pages公開](https://github.com/kubohiroya/turbowarp-kamishibai-samples/issues/1)
- [浦島太郎の生成・検証・公開](https://github.com/kubohiroya/turbowarp-kamishibai-samples/issues/2)
- [Packager Web版の生成・公開](https://github.com/kubohiroya/turbowarp-kamishibai-samples/issues/7)
- [DSL 4.0 SB3・Web版の自動生成](https://github.com/kubohiroya/turbowarp-kamishibai-samples/issues/90)
- [DSL 4.0チュートリアル作品・starter・addition kit](https://github.com/kubohiroya/turbowarp-kamishibai-samples/issues/94)

## 台本の一部をオン／オフにする

公開ブロック台本SB3は、紫色の「Kamishibai Block Script」から「この部分を使う［オン／オフ］」を追加できます。
定義またはscene内の命令列を囲み、オフにすると内側を残したまま実行対象から外します。保存後、物語を開始し直して確認します。
[図版付きの使い方](https://kubohiroya.github.io/turbowarp-kamishibai-docs/4.0/block-author-guides/dsl-4.0-block-author-guide/#use-section)を参照してください。

本体の既定値はOFFのまま、samplesの`stories/urashima/dsl4-build.config.json`の`blockAuthoring.sourceSections: true`で
生成時に`--block-sections true`を指定しています。my-urashimaの2・3・4ポーズ版も同じ設定です。
切り戻しはこの設定と生成・検証変更、ブロックSB3・lockをまとめてrevertしてPagesを再公開します。
