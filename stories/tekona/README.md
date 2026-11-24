# 手児奈 ― 真間の井の求婚者たち

市川市真間（国府台地域）に伝わる「真間の手児奈」を、AIを使った参加型紙芝居として再話したDSL 4.0作品です。
観客はUSBカメラの前で手児奈に求婚する男たちになりきり、決めポーズをとります。ポーズ認識AIがポーズを認めると、
求婚者は求婚の言葉を述べ、手児奈に断られます。これを求婚者の人数だけ繰り返し、最後に手児奈が自分の生き方を選びます。

40分ワークショップ（[`resources/tekona-workshop/`](../../resources/tekona-workshop/README.md)）の**半完成品**です。
当日は参加者1人1人が自分のPCで求婚者の絵・セリフ・ポーズ認識モデルをつくり、LAN内の掲示板へ提出します。
アシスタントがそれを1人1場面としてこの作品へ組み込み、全員の求婚者が登場する紙芝居を完成させます。

## 状態

- 台本`tekona.k4.yml`は、`app-release.json`が固定する公開App **4.0.5**の`validate-dsl4`で`valid`です。
  見本の提出から参加者の場面を加えた台本も、生成のたびに`valid`であることを確かめます。
- `pnpm update:tekona`で、同じ4.0.5から次の4つのSB3を生成し、`dsl4-artifacts.lock.json`にサイズとSHA-256を記録します。
- ワークショップの組み込みは**ブロック台本版**（基本）と**外部YAML版**（予備）の2通りで、どちらもTurboWarp Plus Editorでの
  アシスタントの作業を自動リハーサルしました（`pnpm verify:tekona-block-workshop-editor`、`pnpm verify:tekona-workshop-editor`）。
  参加者の場面は用意済みの求婚者のあと、`quarrel`の前で再生され、最後の「おしまい」まで実行時エラーはありませんでした
  （モデルは浦島太郎の既存モデルで代用し、ポーズはスキップ）。
- **未確認**: ブロック台本版の席ごとのモデルを、開き直した`seat-NN.tm`から同じリンクのまま更新できること（実際のアップロードでの確認が必要）。
- **未完了**: 用意済み8人のポーズ認識モデル（`SatoPose`・`KokufuPose`・`MiyakoPose`・`RyoshiPose`・`UtabitoPose`・`HataoriPose`・
  `GunjiPose`・`SakimoriPose`）は未作成で、URLはすべて仮の値です。撮影計画は
  [`pose-dataset-plan.md`](../../resources/tekona-workshop/pose-dataset-plan.md)にあります。モデルができるまで、
  用意済みの場面はポーズ認識の段階で止まります（Spaceキーでとばせます）。
  #4〜#8を足したぶん、撮影するモデルは3本から8本に増えました。
- **生成済み・未公開**: 点景（考証メモ2.6・6章の背景7枚とスプライト`Kemuri`・`Nio`・`Kari`）、版4へ描き直した`assets/`のSVG、
  `avant`・`kurashi`・`kokuga`・`uma`・`kokubunji`の場面、`well`の群像紹介（方式A）と終盤の回収（方式C）をすべて含めて、
  公開App **4.0.5**（commit `5910e2e`）で`pnpm update:tekona`を実行し、`dsl4-artifacts.lock.json`を更新しました（`pnpm verify:tekona`は一致）。
  ただし生成したSB3はまだGitHub Releaseへ公開しておらず、`sb3-assets.json`は描き直し前の旧版を指しています。
  `pnpm sb3:publish`で公開するまで、配布中のSB3は旧版です。
- **未検証**: 生成したSB3の再生（点景の`loop`・`moveTo`の動き、#4〜#8の5場面を含む）。公開Plus Editorの拡張機能の確認ダイアログが
  「Confirmation: This project wants to run extensions」（ボタンは`Do not run`／`Review each extension`／`Enable all and run`）に
  変わり、`pnpm verify:tekona-workshop-editor`はSB3の読み込みで止まります。次を試しても押せませんでした。
  - `getByRole('button', {name: 'Enable all and run'})`
  - `block-diagnostic-fixture.ts`が使う`[data-testid="twextsec-complete"]`と`.twextsec-row button[data-execution="unsandboxed"]`
    （このセレクタはダイアログが出ている状態でも0件で、ボタンは別の構造になっている）
  エディタ以外の経路も使えません。`editor.html`は`#project_url=`を無視し、`?project_url=`はhttpsのページから
  `http://127.0.0.1`を取りにいけずに`TypeError: Failed to fetch`になります。Web版（`build-packaged-web.ts`）は
  この作品では未完了です。**リハーサルの手順を今のダイアログに合わせて直すのが先**で、それまで再生は確認できません。
- 用意済みの求婚者は**8人**です（`sato`・`kokufu`・`miyako`と、考証メモ4章の#4〜#8＝`ryoshi`・`utabito`・`hataori`・`gunji`・`sakimori`）。
  求婚の場面だけで8人ぶん、ポーズ認識は16回になるので、**40分のワークショップでは減らして使います**。
  手順は「[上演に合わせて求婚者を減らす](#上演に合わせて求婚者を減らす)」にあります。
- 季節のカットは用意済みの求婚者のあいだ（春・夏・秋）と`quarrel`（冬）にだけ入れ、参加者の場面の雛形には入れていません。
- **注意**: `forEach`と`if`を使うため、この台本は**物語制御に対応したrunner（DSL 4.0 Standard、App 4.0.0-rc.44以降）**が必要です。
  `validate-dsl4 --no-narrative-control`では`K4-NARRATIVE-FLAG-001`で拒否されます（確認済み）。rc.43以前のSB3へ台本だけを移しても動きません。
- **Web版**: `pnpm update:tekona`が`tekona-4.0.sb3`からオフライン用のHTML（`web-4.0/index.html`、約8.3MB）も作り、
  `dsl4-artifacts.lock.json`の`web`に記録します。台本・素材・実行基盤をすべて埋め込む設定（`scriptMode: embedded`・
  `assets: embedded`）なので、**配信元へ取りに行かずに再生できます**（ローカルで開いて確認：読み込みから再生開始まで
  外部への通信は0件。ポーズ認識の初期化でカメラを要求するところまで動く）。
  ただしポーズ認識の**モデルだけは例外**で、Teachable Machineの共有リンクから取得するためネットワークが要ります。
  いまはモデルが仮のリンクなので、求婚者の場面はポーズ認識の段階で止まります（Spaceキーでとばせます）。
  ワークショップ用のSB3（`tekona-workshop*`）は参加者が編集するためのものなので、Web版は作りません。
- **未完了**: 作品一覧（`site/works.json`）への掲載と、`pnpm build`でのWeb版の公開。
  生成とlockへの記録はできていますが、サイトへは出していません。

## ファイル

| ファイル | 内容 |
| --- | --- |
| `tekona.k4.yml` | 台本の正本（DSL 4.0）。参加者の場面の雛形を「★参加者」の箇所に示しています |
| `project-assets-dsl4.yml` | SB3へ追加するスプライト（Tekona／Suitor／Stork／点景のKemuri・Nio・Kari／Narration）・背景・コスチューム・音の宣言 |
| `assets/*.svg` | 立ち絵・ポーズ絵・背景の仮素材（すべて新規作成のSVG）。衣装・井戸・継橋は[考証メモ](../../resources/tekona-workshop/research-notes.md)の「5. 仮素材への反映」に合わせています |
| `tekona-workshop-blocks-4.0.sb3` | **作業用ブロック台本SB3（基本）**。参加者の枠（場面・スプライトとコスチューム・モデル）を席番号ぶん登録済みで、差し替えて使います |
| `tekona-workshop-4.0.sb3` | 作業用SB3（外部YAML版・予備）。スプライト・背景・音だけを持ち、台本はメニューの「開く」で読み込みます |
| `tekona-4.0.sb3` | 半完成品の台本を埋め込んだSB3（そのまま再生できる版） |
| `tekona-blocks-4.0.sb3` | 半完成品の台本をブロック台本にしたSB3（既存の場面を読む・編集する用） |
| `workshop.config.json` | ブロック台本版の枠の数、見本モデルのリンク、席ごとのモデルのリンク、仮の絵 |
| `dsl4-artifacts.lock.json` | 生成元のApp版・commit、入力と出力のサイズ・SHA-256 |
| `LICENSES.md` | ライセンス |

台本は背景・コスチューム・音を短形式（`costume:Suitor`、`sound`など）でSB3内の素材として参照します。
参加者の絵は、作業用SB3にある席のスプライト`SuitorNN`の仮のコスチューム`stand`・`kime`・`rejected`と差し替えます。
音は浦島太郎サンプルの音素材（Medieval1、Goal Cheer、Crowd Gasp、Xylo2）を共用し、SB3の生成時に`stories/urashima/assets`を許可します。

## 求婚者の決まり

用意済みの8人も参加者も、次の決まりにそろえます。

| 決まり | 内容 |
| --- | --- |
| 構図 | 求婚者は上手（画面の右、`x: 140`）に立ち、下手（画面の左、`x: -150`）の手児奈に求婚する。絵の人物は下手を向く |
| スプライト | 求婚者1人につき1つ（用意済み：`Sato`・`Kokufu`・`Miyako`・`Ryoshi`・`Utabito`・`Hataori`・`Gunji`・`Sakimori`、参加者：`Suitor01`〜） |
| 3つの絵 | コスチューム`stand`（立ち絵）・`kime`（求婚の決めポーズ）・`rejected`（断られたポーズ）。参加者は`stand.png`・`kime.png`・`rejected.png`で提出する |
| 3つのクラス | 求婚者ごとのポーズ認識モデル（Teachable Machine）に、クラス`stand`・`kime`・`rejected` |
| 流れ | 登場（`stand`）→ `kime`のポーズ認識 → 求婚 → 手児奈が断る → `rejected`のポーズ認識 → 一言 |

台本の素材IDは`sato-kime`や`s07-rejected`のように求婚者ごとに分け、名前付き形式（`{kind: costume, target: Sato, name: kime}`）で
スプライトのコスチューム名`kime`を指します。モデルにないクラスを台本の`pose`に書くと、実行時に
`K4-POSE-PORT-003: Unknown pose … in model …`で停止します（試作時に確認済み）。

## 物語の構成

| scene | 内容 | ポーズ認識モデル |
| --- | --- | --- |
| `avant` | アバンタイトル。背景を省いた無地の画面（背景`AvantBlank`）で、水辺からコウノトリが飛び立ち、旋回しながら奥へ遠ざかる（スプライト`Stork`のコスチューム`stork-1`〜`stork-9`を順に切り替える） | なし |
| `opening` | タイトル | なし |
| `kurashi` | 里の一日。国府台の上から朝もやの入江を見下ろす夜明けの大きな景色（背景`Yoake`）で「むかし、下総の国の真間は…」と語りはじめ、入江の沖の網漁（`Ryo`）、遠浅の浜の貝・海藻とり（`Hama`）、水辺の石の上で甲羅干しをする親亀と子亀（`Kame`）、真間の井の井戸端（`IdoBata`）を順に見せ、日暮れの伏屋から夕げの煙が立ちのぼる（`Yugure`、煙はスプライト`Kemuri`）ところで終わる | なし |
| `well` | 井戸の寄り（空を映す清水と曲物のつるべ、背景`IdoMizu`）から真間の井の全景へ移り、手児奈が登場する。評判が国府・都へ広まる | なし |
| `ryoshi` | **入江の漁師**（考証メモ4.2）。潮の引いた朝、入江で玉藻を刈る手児奈に、網を上げてきた舟から呼びかける（背景`Ryo`）。求婚の場が真間の井でない唯一の場面 | `RyoshiPose` |
| `haru` | 季節のカット（春）。水を張った田と苗、入江の若い葦（背景`Haru`） | なし |
| `sato`・`kokufu`・`miyako` | 用意済みの3人（里の若者・国府の役人・都の貴族）。参加者と同じ雛形の流れ | `SatoPose`・`KokufuPose`・`MiyakoPose` |
| `utabito` | **歌の上手な若者**（考証メモ4.3）。春の夕の歌垣の場（背景`InletSunset`）。求婚も断りも五・七・五・七・七の歌で交わす | `UtabitoPose` |
| `hataori` | **機織りの名人の若者**（考証メモ4.6）。伏屋で織った布を井戸端で差し出す（背景`MamaWell`）。里の層の締め | `HataoriPose` |
| `gunji` | **郡司の息子**（考証メモ4.4）。秋、稲と麻布を国府へ運ぶ行列の先頭から、井で水をくむ手児奈に家の田の広さを誇る（背景`MamaWell`）。郡（地元の力）から国府（律令の務め）へ渡る段差をここで作る | `GunjiPose` |
| `sakimori` | **防人に出る若者**（考証メモ4.5）。旅立ちの前日の夕、官道（背景`Uma`を東国から出ていく道として使う）を見せてから真間の井へ。弓矢は手児奈のほうへ向けない。**小学生向けの上演では外すことをすすめます** | `SakimoriPose` |
| `natsu` | 季節のカット（夏、`sato`と`kokuga`のあいだ）。玉藻のなびく入江で、にほ鳥が潜っては浮かびながら進む（背景`Natsu`、スプライト`Nio`） | なし |
| `kokuga` | 国府の工事場（`sato`と`kokufu`のあいだ）。柱のたもとで役人たちが木簡を広げ、大工の棟梁と工事の進み具合を話し合う（背景`Kokuga`）。若い役人の心は手児奈のことでいっぱい | なし |
| `aki` | 季節のカット（秋、`kokufu`と`uma`のあいだ）。実った葛飾早稲の田と稲束の上を、雁の列が渡る（背景`Aki`、スプライト`Kari`） | なし |
| `uma` | 都からの旅（`aki`と`miyako`のあいだ）。都の貴族が従者に馬を引かせ、入江の板橋をわたって真間へやって来る。中景に浜の女たち、遠景に建設中の国府（背景`Uma`） | なし |
| `suitor-NN` | **参加者の求婚者**（席番号NNごとに1場面、雛形から追加） | 参加者の`PoseNN` |
| `quarrel` | 冬の嵐の夜。波のとどろく入江（背景`Arashi`）で、断られた男たちが争いをはじめたことを語り、岸に立つ手児奈が思い悩む。言い出したのは郡司の息子（方式C） | なし |
| `inlet` | 夕日の入江で、手児奈が「わたしの心は、わたしのもの」と決める | なし |
| `tsugihashi` | 手児奈が争いをやめるよう告げ、男たちは力をあわせて入江に橋（継橋）をかける。橋づくりで**#4〜#8の技がどう生きたかを`forEach`と`if`で一行ずつ**回収する（方式C）。出さない求婚者がいるときは`shown`を`false`にする | なし |
| `kokubunji` | 後日談。やがて国府台の丘の上に下総国分寺が建てられ、男たちが金堂の屋根を上げ、仏師が仏像を彫る（背景`Kokubunji`）。機織りの名人が幡を織り、郡司の息子が人を集める（方式C） | なし |
| `afterword` | 再話であることと、本来の言い伝え（手児奈が入江に姿を消し、里人がまつった）、手児奈霊堂の紹介 | なし |

ポーズ認識モデルは場面ごとに1つです（`Actor.pose`にはモデルを指定できません）。そのため、どの求婚者も自分の場面を持ちます。

考証メモ4章の#4〜#8は、**場面とポーズ認識モデルを増やさない「語られる求婚者」（方式A）と、終盤での回収（方式C）**として入っています。
`well`と`tsugihashi`の`forEach`の一覧は、人数と順番をそろえてあります。上演でだれかを出さないときは、
`tsugihashi`側の`shown`を`false`にし、`well`側の行を消します。1人を「演じる求婚者」にする方式Bは入れていません
（場面1つとポーズ認識モデル1つが増えるため。考証メモ4.8）。
結末は再話として変更し、原典の結末は`afterword`で紹介します。

用意済みの3人の決めポーズは、里の若者が「両うでで頭の上に大きなハート」、国府の役人が「片手を胸に当て、もう片方の手を横へさしだす」、
都の貴族が「両うでを横へ大きく広げる」です。
`rejected`も人物ごとに変えています。里の若者が「前かがみになって、ぼうぜんと立ちつくす」、国府の役人が「背すじをのばしたまま、深く頭を下げる」、
都の貴族が「片手で口もとをおおう」です。断られる場面が3回くり返されるため、同じ崩れ方を見せないようにしたものです。
**絵とカメラの前でとるポーズは同じ**にしてあります。どれも`stand`・`kime`と上半身で区別でき、数秒止まれて、周囲にぶつからない形です
（ポーズ認識モデルは上半身の関節の位置で判別するので、表情や小道具の違いは判別に使えません。ひざをつく・座りこむような形も、上半身だけの画角では区別できません）。
参加者の枠の「？」（`newcomer-rejected`）だけは、参加者に見せる手本として基本形の「肩を落として両手を下に垂らし、うつむく」のままです。

## 上演に合わせて求婚者を減らす

用意済みの求婚者は8人です。全員を出すと、求婚の場面だけで**8人ぶん**（1人あたりおよそ60〜85秒）になり、
ポーズ認識も2回ずつ（`kime`と`rejected`）で合計16回になります。**40分のワークショップでは、参加者の場面を優先して減らしてください。**
考証メモ[4.8](../../resources/tekona-workshop/research-notes.md)の見積もりでは、参加者の場面がある上演で演じる求婚者は1〜2人までが目安です。

1人減らすときは、次の3か所をそろえて直します。

| 直す場所 | 直しかた |
| --- | --- |
| `tekona.k4.yml`の`scenes` | その人の場面（`ryoshi`・`utabito`・`hataori`・`gunji`・`sakimori`のどれか）を**削除**する。`if: {condition: false}`で寝かせるのは避ける（未選択側も検証と素材の事前読み込みの対象で、モデルの宣言と有効なリンクが要るため） |
| `tekona.k4.yml`の`assets` | その人のコスチューム3行とポーズ認識モデル1つ（`RyoshiPose`など）を削除し、`actors`の1行も消す |
| `tekona.k4.yml`の`tsugihashi` | 終盤の回収の`forEach`で、その人の`shown`を`false`にする |

`project-assets-dsl4.yml`のスプライトとコスチュームは残しておいて構いません（台本が参照しなければSB3に入るだけです）。
減らしたら`pnpm update:tekona`で作り直し、`validate-dsl4`が`valid`であることを確かめます。

出す人を選ぶときの目安です。考証メモ4.1の「層」（入江・里／里の歌の場／郡／国府・国家／都）で重ならないようにします。

* **小学生向け**：`sakimori`（防人）を外します。家族と何年も離れる務めで、帰ってきたかどうかを描かない重い設定のためです（考証メモ4.5）。
* **40分ワークショップ**：用意済みは`sato`・`kokufu`・`miyako`の3人にとどめ、#4〜#8は出しません。
* **通常の上演**：層が重ならないよう#4〜#8から1〜2人を選びます。`gunji`は`quarrel`で争いを言い出す役、`utabito`は歌垣（〔確〕）を見せる役として効きます。

## 参加者の場面を加える

詳細な手順は[スタッフ向け資料の5章](../../resources/tekona-workshop/tekona-workshop-staff.md)にあります。

### ブロック台本版（基本）

`tekona-workshop-blocks-4.0.sb3`は、生成時に席番号01〜20（`workshop.config.json`の`slots`）の枠を登録しています。

- 場面`suitor-NN`：用意済みの3人と`quarrel`の間に席番号順。中身は`if: {condition: false}`で囲まれ、組み込むまで何も再生しない。
- スプライト`SuitorNN`と仮のコスチューム`stand`・`kime`・`rejected`（「？」の人物）。
- モデル`PoseNN`：`slotModelUrls`の席ごとのリンク、なければ`sampleModelUrl`。

アシスタントの1人分の作業は、絵3枚の差し替え、枠の文の書き換え（補助ページ[`compose.html`](../../resources/tekona-workshop/assistant/compose.html)が
提出文から「いまの文 → 入れる文」の一覧を作る）、条件を`true`にすること、台本への反映です。
`pnpm verify:tekona-block-workshop-editor`は、この一覧（`blockEdits`）どおりに枠01を書き換え（手児奈の心が揺れなかった場合のブロック削除を含む）、
反映・再生・保存・書き戻しまでを公開Plus Editorで確かめます。

**席ごとのモデル**：運営が席ごとのモデルを事前にアップロードし、`pnpm tekona:seat-models collect 席ファイルのフォルダ --write`で
リンクを`slotModelUrls`へ入れてから`pnpm update:tekona`で作り直します。当日は参加者が席の`seat-NN.tm`で学習し直し、
同じリンクのまま「クラウドモデルを更新」します（手順は[`pose-dataset-plan.md`](../../resources/tekona-workshop/pose-dataset-plan.md)）。

### 外部YAML版（予備）

1. 作業用SB3`tekona-workshop-4.0.sb3`の席のスプライト`SuitorNN`で、仮のコスチュームを参加者の`stand.png`・`kime.png`・`rejected.png`に差し替える。
2. 補助ページを「外部YAML版」にして掲示板の提出文を貼り、参加者の場面（`suitor-NN`、スプライト`SuitorNN`、モデル`PoseNN`）を加えた
   `tekona.k4.yml`を作る。場面は席番号順に`quarrel`の前へ入る。
3. 作業用SB3でメニューの「開く」から`tekona.k4.yml`を読み込んで再生する。

補助ページは`resources/tekona-workshop/assistant/compose-participants.js`を埋め込んで`pnpm update:tekona`が生成します。
同じ処理を`test/tekona-compose.test.ts`で検査しています。

### ブロック台本版の制約

公開rc.79のTurboWarp Plus Editorでは、ブロック台本に次の変更を加えると台本への反映ができません。このため枠を事前に登録しています。

- 素材の宣言ブロック（参加者のコスチュームでもモデルでも）を加えると、文書ハットのアイコンからの反映
  （「表示されている形式に変換して検証・保存」）が`Asset bundle must contain every StoryDocument asset`で無効になる。
  反映しないまま再生すると`K4-SOURCE-VIEW-UNAPPLIED`で止まる。
- 新しい場面を`quarrel`の前につなぐと、反映後の台本では最後（`afterword`の後）に置かれる。
- モデル`PoseNN`のリンクを書き換えると、反映が`Remote asset source does not match: PoseNN`で無効になる。
  `TEKONA_REPLACE_MODEL_URL=1`を付けてリハーサルすると、App側でリンクの書き換えが直ったかを確かめられる。

どれもApp側（Plus Editorでの素材一覧の更新、場面の並びの書き戻し、リモート素材の書き換え）の対応で解消できる見込みです。

## 生成と検証

公開4.0.5のApp（`app-release.json`の固定commitをcheckoutし、固定依存のinstallと`pnpm build:lib`を済ませたもの）を使います。

```bash
TURBOWARP_KAMISHIBAI_APP_ROOT=/path/to/app-v4.0.5 pnpm update:tekona
```

`pnpm verify:tekona`は再生成した成果物がロックと補助ページに一致することを確かめます。
`pnpm verify:tekona-block-workshop-editor`は、ブロック台本版の枠01への差し替えをリハーサルします。
`pnpm verify:tekona-workshop-editor`は公開中のTurboWarp Plus Editorを開いて組み込みをリハーサルし、`.tmp/tekona-workshop-editor/`に
報告と再生中の画面写真を残します（ネットワークが必要です。Teachable Machineへの通信は浦島太郎の既存モデルへ差し替えます）。

## 参考

- 市川市「[真間の手児奈](https://www.city.ichikawa.lg.jp/page/4573.html)」（出典：『市川のむかし話』市川民話の会編）
- 手児奈は『万葉集』で高橋虫麻呂・山部赤人らにうたわれています。

台本の文章は、上記を参考にした新しい再話です。市川市のページの文章は引用していません。
