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
  用意済みの3人のあと、`quarrel`の前で再生され、最後の「おしまい」まで実行時エラーはありませんでした
  （モデルは浦島太郎の既存モデルで代用し、ポーズはスキップ）。
- **未完了**: 用意済み3人のポーズ認識モデル（`SatoPose`・`KokufuPose`・`MiyakoPose`）は未作成で、URLは仮の値です。撮影計画は
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
| `tekona-workshop-blocks-4.0.sb3` | **次の版（試作）の作業用ブロック台本SB3**。参加者の枠（場面・コスチューム・モデル）を席番号ぶん登録済みで、差し替えて使います |
| `workshop.config.json` | ブロック台本版の枠の数、見本モデルのリンク、席ごとのモデルのリンク、仮の絵 |
| `dsl4-artifacts.lock.json` | 生成元のApp版・commit、入力と出力のサイズ・SHA-256 |
| `LICENSES.md` | ライセンス |

台本は背景・コスチューム・音を短形式（`costume:Suitor`、`sound`など）でSB3内の素材として参照します。
参加者の絵は、作業用SB3にある席のスプライト`SuitorNN`の仮のコスチューム`stand`・`kime`・`rejected`と差し替えます。
音は浦島太郎サンプルの音素材（Medieval1、Goal Cheer、Crowd Gasp、Xylo2）を共用し、SB3の生成時に`stories/urashima/assets`を許可します。

## 求婚者の決まり

用意済みの3人も参加者も、次の決まりにそろえます。

| 決まり | 内容 |
| --- | --- |
| 構図 | 求婚者は上手（画面の右、`x: 140`）に立ち、下手（画面の左、`x: -150`）の手児奈に求婚する。絵の人物は下手を向く |
| スプライト | 求婚者1人につき1つ（用意済み：`Sato`・`Kokufu`・`Miyako`、参加者：`Suitor01`〜） |
| 3つの絵 | コスチューム`stand`（立ち絵）・`kime`（求婚の決めポーズ）・`rejected`（ことわられたポーズ）。参加者は`stand.png`・`kime.png`・`rejected.png`で提出する |
| 3つのクラス | 求婚者ごとのポーズ認識モデル（Teachable Machine）に、クラス`stand`・`kime`・`rejected` |
| 流れ | 登場（`stand`）→ `kime`のポーズ認識 → 求婚 → 手児奈がことわる → `rejected`のポーズ認識 → ひとこと |

台本の素材IDは`sato-kime`や`s07-rejected`のように求婚者ごとに分け、名前付き形式（`{kind: costume, target: Sato, name: kime}`）で
スプライトのコスチューム名`kime`を指します。モデルにないクラスを台本の`pose`に書くと、実行時に
`K4-POSE-PORT-003: Unknown pose … in model …`で停止します（試作時に確認済み）。

## 物語の構成

| scene | 内容 | ポーズ認識モデル |
| --- | --- | --- |
| `opening` | タイトル | なし |
| `well` | 真間の井と手児奈。評判が国府・都へ広まる | なし |
| `sato`・`kokufu`・`miyako` | 用意済みの3人（里の若者・国府の役人・都の貴族）。参加者と同じ雛形の流れ | `SatoPose`・`KokufuPose`・`MiyakoPose` |
| `suitor-NN` | **参加者の求婚者**（席番号NNごとに1場面、雛形から追加） | 参加者の`PoseNN` |
| `quarrel` | 断られた男たちが争いをはじめる | なし |
| `inlet` | 夕日の入江で、手児奈が「わたしの心は、わたしのもの」と決める | なし |
| `tsugihashi` | 手児奈が争いをやめるよう告げ、男たちは力をあわせて入江に橋（継橋）をかける | なし |
| `afterword` | 再話であることと、本来の言い伝え（手児奈が入江に姿を消し、里人がまつった）、手児奈霊堂の紹介 | なし |

ポーズ認識モデルは場面ごとに1つです（`Actor.pose`にはモデルを指定できません）。そのため、どの求婚者も自分の場面を持ちます。
結末は再話として変更し、原典の結末は`afterword`で紹介します。

用意済みの3人の決めポーズは、里の若者が「両うでで頭の上に大きなハート」、国府の役人が「片手を胸に当て、もう片方の手を横へさしだす」、
都の貴族が「両うでを横へ大きく広げる」、`rejected`は3人とも「肩を落として両手を下に垂らし、うつむく」です。

## 参加者の場面を加える

この版は外部YAML方式です。1人分で行うことは次の3つです（詳細は[スタッフ向け資料の5章](../../resources/tekona-workshop/tekona-workshop-staff.md)）。

1. 作業用SB3の席のスプライト`SuitorNN`で、仮のコスチューム`stand`・`kime`・`rejected`を削除し、参加者の`stand.png`・`kime.png`・`rejected.png`をアップロードする（コスチューム名はファイル名のまま）。
2. 補助ページ[`compose.html`](../../resources/tekona-workshop/assistant/compose.html)に掲示板の提出文を貼り、
   参加者の場面（`suitor-NN`、スプライト`SuitorNN`、モデル`PoseNN`）を加えた`tekona.k4.yml`を作る。場面は席番号順に`quarrel`の前へ入る。
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

そこで次の版は、**素材と場面の枠をあらかじめ登録しておき、差し替える**方式で進めます。`tekona-workshop-blocks-4.0.sb3`が試作です。

- 生成時に、席番号01〜20の場面`suitor-NN`（中身は`if: {condition: false}`で囲む）、スプライト`SuitorNN`と仮のコスチューム`stand`・`kime`・`rejected`、
  モデル`PoseNN`を登録する。場面は最初から用意済みの3人と`quarrel`の間に並ぶので、順番の問題は起きない。
- `pnpm verify:tekona-block-workshop-editor`で、Plus Editor上での差し替え（絵のアップロード → 仮の絵の削除と名前の付け替え、
  セリフの書き換え、条件をtrue、文書への反映）から再生・保存・書き戻しまでを確かめた。組み込んだ枠01は都の貴族のあとに再生され、
  未記入の枠は何も再生しない。
- **モデルのリンクは席ごとに事前登録する**：rc.79ではモデル`PoseNN`のリンクを書き換えると、反映が
  `Remote asset source does not match: PoseNN`で無効になる。そこで運営が席ごとのモデルを事前にアップロードし、
  `pnpm tekona:seat-models collect 席ファイルのフォルダ --write`でリンクを`workshop.config.json`の`slotModelUrls`へ入れてから
  `pnpm update:tekona`で作り直す。当日は参加者が席の`seat-NN.tm`で学習し直し、同じリンクのまま更新する
  （手順は[`pose-dataset-plan.md`](../../resources/tekona-workshop/pose-dataset-plan.md)）。
  `TEKONA_REPLACE_MODEL_URL=1`を付けてリハーサルすると、App側でリンクの書き換えが直ったかを確かめられる。

## 生成と検証

公開rc.79のApp（`app-release.json`の固定commitをcheckoutし、固定依存のinstallと`pnpm build:lib`を済ませたもの）を使います。

```bash
TURBOWARP_KAMISHIBAI_APP_ROOT=/path/to/app-v4.0.0-rc.79 pnpm update:tekona
```

`pnpm verify:tekona`は再生成した成果物がロックと補助ページに一致することを確かめます。
`pnpm verify:tekona-block-workshop-editor`は、ブロック台本版の枠01への差し替えをリハーサルします。
`pnpm verify:tekona-workshop-editor`は公開中のTurboWarp Plus Editorを開いて組み込みをリハーサルし、`.tmp/tekona-workshop-editor/`に
報告と再生中の画面写真を残します（ネットワークが必要です。Teachable Machineへの通信は浦島太郎の既存モデルへ差し替えます）。

## 参考

- 市川市「[真間の手児奈](https://www.city.ichikawa.lg.jp/page/4573.html)」（出典：『市川のむかし話』市川民話の会編）
- 手児奈は『万葉集』で高橋虫麻呂・山部赤人らにうたわれています。

台本の文章は、上記を参考にした新しい再話です。市川市のページの文章は引用していません。
