# 手児奈 ― 真間の井の求婚者たち

市川市真間（国府台地域）に伝わる「真間の手児奈」を、AIを使った参加型紙芝居として再話したDSL 4.0作品です。
観客はUSBカメラの前で手児奈に求婚する男たちになりきり、決めポーズをとります。ポーズ認識AIがポーズを認めると、
求婚者は求婚の言葉を述べ、手児奈に断られます。これを求婚者の人数だけ繰り返し、最後に手児奈が自分の生き方を選びます。

40分ワークショップ（[`resources/tekona-workshop/`](../../resources/tekona-workshop/README.md)）の**半完成品**です。
当日は参加者1人1人が自分のPCで求婚者の絵・セリフ・ポーズ認識モデルをつくり、LAN内の掲示板へ提出します。
アシスタントがそれを1人1場面としてこの作品へ組み込み、全員の求婚者が登場する紙芝居を完成させます。

## 状態

- 台本`tekona.k4.yml`は、`app-release.json`が固定する公開App **4.0.0-rc.79**の`validate-dsl4`で`valid`です。
  見本の提出から参加者の場面を加えた台本も、生成のたびに`valid`であることを確かめます。
- `pnpm update:tekona`で、同じrc.79から次の3つのSB3を生成し、`dsl4-artifacts.lock.json`にサイズとSHA-256を記録します。
- TurboWarp Plus Editorでのアシスタントの組み込み（作業用SB3に参加者の絵2枚をアップロード → 補助ページで組み立てた台本を
  メニューから読み込む → 再生）を、`pnpm verify:tekona-workshop-editor`で自動リハーサルしました。参加者の場面は
  `proposals`と`quarrel`の間で再生され、最後の「おしまい」まで実行時エラーはありませんでした
  （モデルは浦島太郎の既存モデルで代用し、ポーズはスキップ）。
- **未完了**: 用意済み3人のポーズ認識モデル（`SuitorPoses`）は未作成で、URLは仮の値です。撮影計画は
  [`pose-dataset-plan.md`](../../resources/tekona-workshop/pose-dataset-plan.md)にあります。モデルができるまで、
  用意済み3人の場面はポーズ認識の段階で止まります（Spaceキーでとばせます）。
- **未完了**: Web版、作品一覧（`site/works.json`）への掲載、`pnpm build`への組み込み。

## ファイル

| ファイル | 内容 |
| --- | --- |
| `tekona.k4.yml` | 台本の正本（DSL 4.0）。参加者の場面の雛形を「★参加者」の箇所に示しています |
| `project-assets-dsl4.yml` | SB3へ追加するスプライト（Tekona／Suitor／Narration）・背景・コスチューム・音の宣言 |
| `assets/*.svg` | 立ち絵・ポーズ絵・背景の仮素材（すべて新規作成のSVG）。衣装・井戸・継橋は[考証メモ](../../resources/tekona-workshop/research-notes.md)の「5. 仮素材への反映」に合わせています |
| `tekona-workshop-4.0.sb3` | **作業用SB3**。スプライト・背景・音だけを持ち、台本はメニューの「開く」で読み込みます。ワークショップではこれに参加者の絵を加えます |
| `tekona-4.0.sb3` | 半完成品の台本を埋め込んだSB3（そのまま再生できる版） |
| `tekona-blocks-4.0.sb3` | 半完成品の台本をブロック台本にしたSB3（既存の場面を読む・編集する用） |
| `dsl4-artifacts.lock.json` | 生成元のApp版・commit、入力と出力のサイズ・SHA-256 |
| `LICENSES.md` | ライセンス |

台本は背景・コスチューム・音を短形式（`costume:Suitor`、`sound`など）でSB3内の素材として参照します。
参加者の絵は、TurboWarp Plus EditorでSuitorスプライトへ`sNN-stand`／`sNN-pose`としてアップロードします。
音は浦島太郎サンプルの音素材（Medieval1、Goal Cheer、Crowd Gasp、Xylo2）を共用し、SB3の生成時に`stories/urashima/assets`を許可します。

## 物語の構成

| scene | 内容 | ポーズ認識モデル |
| --- | --- | --- |
| `opening` | タイトル | なし |
| `well` | 真間の井と手児奈。評判が国府・都へ広まる | なし |
| `proposals` | 用意済みの3人。**forEach**で一覧を順に再生し、各回でポーズ認識 → 求婚 → 手児奈が断る。**if**で心のゆれを分岐 | `SuitorPoses` |
| `suitor-NN` | **参加者の求婚者**（席番号NNごとに1場面、雛形から追加） | 参加者の`PoseNN` |
| `quarrel` | 断られた男たちが争いをはじめる | なし |
| `inlet` | 夕日の入江で、手児奈が「わたしの心は、わたしのもの」と決める | なし |
| `tsugihashi` | 手児奈が争いをやめるよう告げ、男たちは力をあわせて入江に橋（継橋）をかける | なし |
| `afterword` | 再話であることと、本来の言い伝え（手児奈が入江に姿を消し、里人がまつった）、手児奈霊堂の紹介 | なし |

ポーズ認識モデルは場面ごとに1つです（`Actor.pose`にはモデルを指定できません）。参加者がそれぞれのPCで作ったモデルを使うため、
参加者の求婚者は一覧の行ではなく、1人1場面にしています。結末は再話として変更し、原典の結末は`afterword`で紹介します。

## 用意済みの求婚者（`proposals`の一覧）

| 列 | 型 | 意味 |
| --- | --- | --- |
| `name` | 文字列 | 登場時にナレーションへ出す名前 |
| `stand` | 文字列 | 立ち絵のコスチューム名（Suitorスプライト） |
| `poseSkin` | 文字列 | ポーズ認識に成功したときのコスチューム名 |
| `pose` | 文字列 | `SuitorPoses`のクラス名。**モデルのラベルと完全に一致させる** |
| `poseHint` | 文字列 | ポーズの説明（求婚者のセリフとして出す） |
| `proposal` | 文字列 | 求婚の言葉 |
| `moved` | 真偽値 | `true`なら手児奈が断る前に「ちょっとだけ心がゆれた」と思う |
| `refusal` | 文字列 | 手児奈の断りの言葉 |

| 求婚者 | クラス名 | 決めポーズ |
| --- | --- | --- |
| 里の若者 | `heart` | 両うでで頭の上に大きなハート |
| 国府の役人 | `offer` | 片手を胸に当て、もう片方の手を横へさしだす |
| 都の貴族 | `wide` | 両うでを横へ大きく広げる |

`pose`に書いたクラスがモデルにない場合、実行時に`K4-POSE-PORT-003: Unknown pose … in model SuitorPoses`で停止します（試作時に確認済み）。

## 参加者の場面を加える

この版は外部YAML方式です。1人分で行うことは次の3つです（詳細は[スタッフ向け資料の5章](../../resources/tekona-workshop/tekona-workshop-staff.md)）。

1. 作業用SB3のSuitorスプライトに`sNN-stand.png`／`sNN-pose.png`をアップロードし、コスチューム名を`sNN-stand`／`sNN-pose`にする。
2. 補助ページ[`compose.html`](../../resources/tekona-workshop/assistant/compose.html)に掲示板の提出文を貼り、
   参加者の場面（`suitor-NN`、モデル`PoseNN`）を加えた`tekona.k4.yml`を作る。場面は席番号順に`quarrel`の前へ入る。
3. 作業用SB3でメニューの「開く」から`tekona.k4.yml`を読み込んで再生する。

補助ページは`resources/tekona-workshop/assistant/compose-participants.js`を埋め込んで`pnpm update:tekona`が生成します。
同じ処理を`test/tekona-compose.test.ts`で検査しています。

### 次の版（ブロック台本）の課題

次の版では、参加者の場面をブロック台本で加える予定です。公開rc.79で次の方式を試しましたが、2点のため採用していません。

- 試した方式：雛形の場面（モデル宣言＋`suitor-NN`）を、台本のハットにつながっていないブロックの塊としてワークスペースに置き、
  アシスタントが複製・書き換えて`quarrel`の前につなぐ。つながっていない塊は台本として読まれないので、半完成品の再生には影響しない。
- 課題1：素材の宣言ブロック（参加者のコスチュームでもモデルでも）を加えると、文書ハットのアイコンからの反映
  （「表示されている形式に変換して検証・保存」）が`Asset bundle must contain every StoryDocument asset`で無効になる。
  反映しないまま再生すると`K4-SOURCE-VIEW-UNAPPLIED`で止まる。
- 課題2：新しい素材を使わない場面だけなら反映できたが、`quarrel`の前につないだ場面が、反映後の台本では最後（`afterword`の後）に置かれた。

どちらもApp側（Plus Editorでの素材一覧の更新と、場面の並びの書き戻し）の対応が必要です。

## 生成と検証

公開rc.79のApp（`app-release.json`の固定commitをcheckoutし、固定依存のinstallと`pnpm build:lib`を済ませたもの）を使います。

```bash
TURBOWARP_KAMISHIBAI_APP_ROOT=/path/to/app-v4.0.0-rc.79 pnpm update:tekona
```

`pnpm verify:tekona`は再生成した成果物がロックと補助ページに一致することを確かめます。
`pnpm verify:tekona-workshop-editor`は公開中のTurboWarp Plus Editorを開いて組み込みをリハーサルし、`.tmp/tekona-workshop-editor/`に
報告と再生中の画面写真を残します（ネットワークが必要です。Teachable Machineへの通信は浦島太郎の既存モデルへ差し替えます）。

## 参考

- 市川市「[真間の手児奈](https://www.city.ichikawa.lg.jp/page/4573.html)」（出典：『市川のむかし話』市川民話の会編）
- 手児奈は『万葉集』で高橋虫麻呂・山部赤人らにうたわれています。

台本の文章は、上記を参考にした新しい再話です。市川市のページの文章は引用していません。
