# 手児奈 ― 真間の井の求婚者たち

市川市真間（国府台地域）に伝わる「真間の手児奈」を、AIを使った参加型紙芝居として再話したDSL 4.0作品です。
観客はUSBカメラの前で手児奈に求婚する男たちになりきり、決めポーズをとります。ポーズ認識AIがポーズを認めると、
求婚者は求婚の言葉を述べ、手児奈に断られます。これを求婚者の人数だけ繰り返し、最後に手児奈が自分の生き方を選びます。

40分ワークショップ（[`resources/tekona-workshop/`](../../resources/tekona-workshop/README.md)）の教材作品です。
当日は参加者の提案から4人目の求婚者のキャラクター・決めポーズ・セリフをつくり、Teachable Machineでポーズを学習させて、
この作品に加えて上演します。

## 状態

- 台本`tekona.k4.yml`は、`app-release.json`が固定する公開App **4.0.0-rc.79**の`validate-dsl4`で、
  初期状態と「4人目の行を有効にした状態」の両方が`valid`です。
- rc.79の`build-dsl4`と`project-assets-dsl4.yml`で試作したSB3を、TurboWarp Packager 3.13.0のWeb版にして、
  タイトルから「おしまい」まで再生できることを確認しました（モデルは浦島太郎の既存モデルで代用し、ポーズはスキップ）。
- **未完了**: ポーズ認識モデルは未作成です。台本の`SuitorPoses`のURLは仮の値で、このままでは求婚の場面でモデルを取得できません。
  撮影計画は[`pose-dataset-plan.md`](../../resources/tekona-workshop/pose-dataset-plan.md)にあります。
- **未完了**: SB3・ブロック台本SB3・Web版の生成スクリプトとartifact lock、作品一覧（`site/works.json`）への掲載は、
  モデル完成後に行います。現時点ではこのディレクトリの成果物は台本と素材だけです。

## ファイル

| ファイル | 内容 |
| --- | --- |
| `tekona.k4.yml` | 台本の正本（DSL 4.0）。ワークショップでの書き換え箇所に「★」を付けています |
| `project-assets-dsl4.yml` | SB3へ追加するスプライト（Tekona／Suitor／Narration）・背景・コスチュームの宣言 |
| `assets/*.svg` | 立ち絵・ポーズ絵・背景の仮素材（すべて新規作成のSVG）。衣装・井戸・継橋は[考証メモ](../../resources/tekona-workshop/research-notes.md)の「5. 仮素材への反映」に合わせています |
| `LICENSES.md` | ライセンス |

台本は背景とコスチュームを短形式（`costume:Suitor`など）でSB3内の素材として参照します。
これは2026年8月1日のmy-urashimaと同じ方式で、当日はTurboWarpでSuitorスプライトの`newcomer-stand`／`newcomer-pose`を
差し替えるだけで、4人目の絵を作品へ反映できます。

## 物語の構成

| scene | 内容 |
| --- | --- |
| `opening` | タイトル |
| `well` | 真間の井と手児奈。評判が国府・都へ広まる |
| `proposals` | **forEach**で求婚者の一覧を順に再生。各回でポーズ認識 → 求婚 → 手児奈が断る |
| `quarrel` | 断られた男たちが争いをはじめる |
| `inlet` | 夕日の入江で、手児奈が「わたしの心は、わたしのもの」と決める |
| `tsugihashi` | 手児奈が争いをやめるよう告げ、男たちは力をあわせて入江に橋（継橋）をかける |
| `afterword` | 再話であることと、本来の言い伝え（手児奈が入江に姿を消し、里人がまつった）、手児奈霊堂の紹介 |

結末は再話として変更しています。原典の結末は`afterword`で、子どもにも配慮した表現で紹介します。

## 求婚者の一覧（forEachの列）

`proposals`の`items`の1行が求婚者1人です。共通の展開は`do`に一度だけ書き、行の値を`{ref: suitor.列名}`で差し込みます。

| 列 | 型 | 意味 |
| --- | --- | --- |
| `name` | 文字列 | 登場時にナレーションへ出す名前 |
| `stand` | 文字列 | 立ち絵のコスチューム名（Suitorスプライト） |
| `poseSkin` | 文字列 | ポーズ認識に成功したときのコスチューム名 |
| `pose` | 文字列 | ポーズ認識モデルのクラス名（Teachable Machineのラベル）。**モデルのラベルと完全に一致させる** |
| `poseHint` | 文字列 | ポーズの説明（求婚者のセリフとして出す） |
| `proposal` | 文字列 | 求婚の言葉 |
| `moved` | 真偽値 | `true`なら手児奈が断る前に「ちょっとだけ心がゆれた」と思う（**if**の条件） |
| `refusal` | 文字列 | 手児奈の断りの言葉 |

用意済みの3人と、ワークショップで加える4人目です。

| 求婚者 | クラス名 | 決めポーズ（上半身で区別できるもの） |
| --- | --- | --- |
| 里の若者 | `heart` | 両うでで頭の上に大きなハート |
| 国府の役人 | `offer` | 片手を胸に当て、もう片方の手を横へさしだす |
| 都の貴族 | `wide` | 両うでを横へ大きく広げる |
| 4人目（当日） | `new` | 参加者が考える。上の3つ・`stand`（気をつけ）とはっきり違うもの |

`pose`に書いたクラスがモデルにない場合、実行時に`K4-POSE-PORT-003: Unknown pose … in model SuitorPoses`で停止します
（試作時に確認済み）。

## ワークショップでの書き換え

1. TurboWarpで、Suitorスプライトの`newcomer-stand`と`newcomer-pose`を当日の絵へ差し替えます（コスチューム名は変えない）。
2. `items`の末尾にある4人目の8行について、行頭の`# `を外し、`name`・`poseHint`・`proposal`・`refusal`・`moved`を書き換えます。
3. `SuitorPoses`の`source.url`を、Teachable Machineでアップロードしたモデルの共有リンクへ置き換えます。

## 検証

公開rc.79のCLI（`app-release.json`の固定commitをcheckoutし、固定依存のinstallと`pnpm build:lib`を済ませたもの）で検証します。

```bash
node /path/to/app-v4.0.0-rc.79/bin/turbowarp-kamishibai.mjs validate-dsl4 --input stories/tekona/tekona.k4.yml --format pretty
```

素材入りベースSB3の試作は、App公開Releaseのベース（`stories/urashima/base/kamishibai-4.0.sb3`と同一）へ
`sb3-toolchain build --project-assets stories/tekona/project-assets-dsl4.yml`でスプライトを加え、
`build-dsl4 --embedded-source-documents --replace-existing`で台本を組み込みました。
正式な生成経路（ロック・作品一覧・Web版の公開）は未実装です。

## 参考

- 市川市「[真間の手児奈](https://www.city.ichikawa.lg.jp/page/4573.html)」（出典：『市川のむかし話』市川民話の会編）
- 手児奈は『万葉集』で高橋虫麻呂・山部赤人らにうたわれています。

台本の文章は、上記を参考にした新しい再話です。市川市のページの文章は引用していません。
