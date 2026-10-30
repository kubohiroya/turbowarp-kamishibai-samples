# my-urashima

2026-08-01ワークショップ用の依存ストーリーです。DSL 3.2では`../urashima/source.txt`、アセットロック、generic base SB3を親入力として外部台本専用の`my-urashima.sb3`を生成します。DSL 4.0では固定した4.0 generic baseと`project-assets-dsl4.yml`から`my-urashima-4.0.sb3`を生成し、そのSB3から`web-4.0/index.html`を生成します。

`Princess`は独立したScratchスプライトとして定義します。`project-assets.yml`は`resources/20260801/master/Princess.png`を720×720 pxへ縮小した`assets/Princess-720.png`を入力にして、名前が`Princess`のコスチュームを1つだけ追加します。`bitmapResolution: 2`と回転中心`360, 360`によりScratch上では360×360の論理サイズとして表示し、元画像をそのままresolution 2で登録した場合の約507×507という過大な解釈を避けます。生成した成果物の`artifacts.lock.json`には、その時点の入力サイズとSHA-256を記録します。台本では最短表記`asset=Princess,costume`で参照し、`Actor`スプライトにはPrincessコスチュームを組み込みません。

`my-urashima.sb3`には台本を埋め込みません。埋め込み台本用変数、台本用リスト、`.txt` ZIPエントリは空のままにし、`my-urashima.txt`を外部から読み込んで使用します。

## 作品情報

- 対応DSL: 3.2／4.0
- 掲載形態: 当サイトで配布
- ライセンス・利用条件: [MPL-2.0、CC BY-SA 2.0ほか](../urashima/LICENSES.md)

SB3の展開ソース化、`--project-assets project-assets.yml`によるPrincessスプライトの追加、決定的再構築には、npmの厳密バージョン`@kubohiroya/sb3-toolchain@0.8.0`を使用します。最終SB3も同じツールチェインで再構築したバイト列と一致することを生成時に検証します。利用側スクリプトがScratch JSONやZIP entryを直接編集する経路はありません。

親入力や設定を意図的に変更した場合は、リポジトリルートで次の唯一の更新コマンドを実行し、チェックイン済み成果物とロックを更新します。

```bash
pnpm update:my-urashima
```

通常の`pnpm build`は同じ成果物を一時生成し、チェックイン済みSB3・台本・ロックとの一致を検証します。

DSL 4.0版では、`project-assets-dsl4.yml`が浦島太郎の背景、音声、Urashima／Turtle／Princess／Fish／Narrationの各targetを宣言します。Princess targetは、元のワークショップ画像を360×360の論理サイズへ正規化した`assets/Princess-720.png`だけをコスチュームとして持ちます。`my-urashima.k4.yml`はSB3へ埋め込まず、タイトル画面からメニューへ進み、「ファイルを開く」またはドラッグ＆ドロップで読み込む構成です。Web版でも`.k4.yml`／`.k4.yaml`／`.yml`／`.yaml`を選択できます。

DSL 4.0成果物だけを更新するときは次を使用します。

```bash
pnpm update:my-urashima-dsl4
pnpm update:dsl4-web-artifacts
```

浦島太郎を含むDSL 4.0成果物を一括更新する正規コマンドは`pnpm update:dsl4-artifacts`です。通常の`pnpm build`では`my-urashima-4.0.sb3`と`web-4.0/index.html`を空の`dist/`へ自動生成し、`dsl4-artifacts.lock.json`と`dsl4-web-artifacts.lock.json`のサイズ・SHA-256に一致することを確認します。実ブラウザ検証では、タイトルからメニューへの遷移、未読込時の「もう一度」無効化、YAMLファイル選択、選択後の物語開始まで確認します。

DSL 4.0 Web版だけを一時停止するときは、`sample.config.json`の`dsl4.web.enabled`を`false`にして再ビルドします。Web HTMLは生成されず、作品一覧と詳細画面は「準備中」表示へ戻ります。`dsl4-web-artifacts.lock.json`は保持されるため、`true`へ戻すと同じ成果物を再検証して公開できます。

## DSL 4.0ワークショップ台本

`my-urashima.k4.yml`は、DSL 3.2版のワークショップと同じ「行頭の`#`を削除して選択肢を有効化する」操作を、標準YAMLのコメントとして表現したDSL 4.0作業用台本です。専用プリプロセッサや独自コメント文法は使用しません。

元の作業手順は、[2026-08-01ワークショップ教材「6. 台本ファイルの修正をしよう」](https://kubohiroya.github.io/turbowarp-kamishibai-docs/workshops/2026-08-01/tm-kamishibai-20260801.html#6-%E5%8F%B0%E6%9C%AC%E3%83%95%E3%82%A1%E3%82%A4%E3%83%AB%E3%81%AE%E4%BF%AE%E6%AD%A3%E3%82%92%E3%81%97%E3%82%88%E3%81%86)を参照してください。

`assets:`の直下には`p1`から`p4`までの候補を置いています。使用するポーズ数が2なら`p1`と`p2`、3なら`p1`から`p3`、4なら全4行について、行頭の`#`だけを削除します。各行はPrincessスプライトに参加者が追加した同名コスチュームを参照します。

`welcome to dragon castle`シーンには、2・3・4ポーズ用の`Princess.pose`を1行ずつ候補として置いています。使用するポーズ数に対応する1行だけについて、行頭の`#`を削除します。各候補は選んだポーズ列を2回繰り返し、各ステップで`Drum Funky`を再生します。

Teachable Machineで作成したモデルを使う場合は、同シーンが参照する`PoseModel2.source.url`を作成したモデルのURLへ置き換えます。

初期状態、2ポーズ、3ポーズ、4ポーズの各状態は、隣接する`turbowarp-kamishibai-app`の本番バリデータで検証します。

```bash
pnpm validate:my-urashima-dsl4
```

DSL 3.2にだけ存在する引数やアクションは、現行DSL 4.0のcore actionで表現できる形へ置き換えています。検証結果は`my-urashima.k4.yml: valid`です。

ライセンスと素材の来歴は、親作品の[`LICENSES.md`](../urashima/LICENSES.md)およびワークショップ素材の[`LICENSES.md`](../../resources/20260801/LICENSES.md)を参照してください。

## ブロック台本のフォーム編集

`my-urashima-blocks-4.0.sb3`は、`my-urashima.k4.yml`を固定した公開rc.25の
`author-block-dsl`で変換した編集用SB3です。既存の作業用SB3・Web版と別に配布します。
作品の詳細ページの「TurboWarp-Plus-Editorで編集」から、公開SB3を直接開けます。
拡張の読み込み確認ではそれぞれ「サンドボックスなしで実行する」を有効にして許可し、
ステージの専用定義ブロックの白い書類アイコンからフォームを開きます。
編集後はファイルメニューからSB3をコンピューターへ保存してください。

生成は`pnpm update:my-urashima-dsl4`、通常の検証・配布は`pnpm build`で行います。
CLIの固定commitと出力ハッシュを`dsl4-artifacts.lock.json`へ記録し、`pnpm verify`では
ブロックから書き戻したYAMLと正本の意味が一致することを確認します。
YAMLのコメントと書式はブロックへ引き継ぎません。行頭の`#`を削除するワークショップ操作には、
従来のYAML台本と作業用SB3を使用してください。ポーズモデルは正本と同じリモート参照です。

フォームUIはリンクの既存フラグ`blockEditorDialogs=1`で有効になります。切り戻しは、
ブロック台本の生成設定・生成物・ロック・提供形式の変更をまとめてrevertしてPagesを再公開します。

## ポーズ数を選んでブロック版の実習を始める

詳細ページの「台本ブロックでワークショップを行う場合」から、2・3・4ポーズのいずれかを
選んで開きます。各`my-urashima-N-poses-blocks-4.0.sb3`は正本YAMLの既存候補から生成し、
必要なasset定義、Princess.poseのステップ列、Princessの仮衣装p1〜pNを含みます。
台本で行頭の`#`を外す二つの操作は、この選択で済みます。ポーズ列は2回繰り返します。

仮衣装は元のPrincess画像です。衣装名p1、p2…を保って参加者自身のポーズ画像へ置き換え、
モデルのラベルもp1、p2…にそろえます。モデルURLの変更先は従来と同じPoseModel2です。
既存のYAML版・作業用SB3と、初期状態のブロック版は引き続き提供します。

`pnpm update:my-urashima-dsl4`と`pnpm build`で同じ3版を再生成します。
各版のポーズ数・入力YAMLのSHA-256・出力サイズ・SHA-256は`workshopBlocks`としてロックします。
切り戻しは、この3版と生成・表示・検証の追加をまとめてrevertしてPagesを再公開します。

ブロック版は`app-release.json`のベース・ビルダーと同じ公開Releaseから生成します。専用定義フォーム・ポーズ・場面設定フォームの登録を検証します。依存の自動更新は[Issue #190](https://github.com/kubohiroya/turbowarp-kamishibai-samples/issues/190)で管理します。

## 台本の一部をオン／オフにする

公開ブロック台本SB3は、紫色の「Kamishibai Block Script」から「この部分を使う［オン／オフ］」を追加できます。
定義またはscene内の命令列を囲み、オフにすると内側を残したまま実行対象から外します。保存後、物語を開始し直して確認します。
[図版付きの使い方](https://kubohiroya.github.io/turbowarp-kamishibai-docs/4.0/block-author-guides/dsl-4.0-block-author-guide/#use-section)を参照してください。

本体の既定値はOFFのまま、samplesの`stories/urashima/sample.config.json`の`dsl4.blockAuthoring.sourceSections: true`で
生成時に`--block-sections true`を指定しています。my-urashimaの2・3・4ポーズ版も同じ設定です。
切り戻しはこの設定と生成・検証変更、ブロックSB3・lockをまとめてrevertしてPagesを再公開します。
