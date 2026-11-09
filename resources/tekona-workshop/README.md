# 手児奈ワークショップ（40分）の素案

国府台地域（市川市真間）に伝わる「真間の手児奈」を、AIを使った参加型紙芝居として再話する40分ワークショップの教材素案です。
参加者はUSBカメラの前で手児奈に求婚する男たちになりきってポーズをキメ、AI紙芝居の手児奈に断られます。
メインは、参加者1人1人が時代を調べて求婚者（キャラクター・決めポーズ・セリフ）をデザインし、
Copilotで絵をつくり、自分のPCのTeachable Machineでポーズを学習させて、全員の求婚者を1つの作品へ加える部分です。

## 前提

* プロジェクタと音響設備のある教室。参加者1人1台のUSBカメラ付きPC。外部ネットワークとWeb検索が使える。
* 生成AIはMicrosoft 365のCopilot（画像は1アカウントにつき1日2枚程度）。
* 編集はTurboWarp Plus Editor。運営側で手児奈の「半完成品」SB3を用意する。
* LAN内限定の画像掲示板で素材を共有する。アシスタントが提出物をワークショップ中に共有作品へ組み込む。

開催日・会場・対象年齢は未確定です。日付が決まったら、既存の`resources/20260801/`と同じく日付のディレクトリ名へ移し、
教材本文はdocsリポジトリ（`turbowarp-kamishibai-docs`の`docs/workshops/<日付>/`）へ移す想定です。

## ファイル

| ファイル | 対象 | 内容 |
| --- | --- | --- |
| [`tekona-workshop.md`](tekona-workshop.md) | 参加者 | 1人1台での当日の流れ。求婚者カード、Copilotへの依頼文、Teachable Machineの手順、掲示板への提出、本来の言い伝えとまとめ |
| [`tekona-workshop-staff.md`](tekona-workshop-staff.md) | 進行役・アシスタント | 前提と作品の構成、40分のタイムテーブル、役割と人数、事前準備、掲示板の運用、組み込みの手順、Copilotの枚数への対策、トラブル対応、終了後の処理 |
| [`pose-dataset-plan.md`](pose-dataset-plan.md) | スタッフ | 事前に用意するポーズ学習用データ（`stand`／`heart`／`offer`／`wide`）の撮影計画と取り扱い |
| [`research-worksheet.md`](research-worksheet.md) | 参加者 | 基本設定・歴史考証・手児奈の姿・求婚者の人物像を調べてデザインするワークシート（事前学習・90分版用） |
| [`research-notes.md`](research-notes.md) | 進行役 | ワークシートの各問いの下調べ（考証メモ）。出典と確度、求婚者の候補8案、仮素材への反映 |
| `copilot/style-reference.png` | 参加者 | Copilotに添付する絵柄の見本（用意済みの求婚者の立ち絵・ポーズ絵） |
| `copilot/kime-draft.png` | 参加者 | 決めポーズの棒人間をペイントでかく白紙 |
| [`assistant/compose.html`](assistant/compose.html) | アシスタント | 掲示板の提出文から、参加者の場面を加えた台本を組み立てるページ（ファイルから直接開ける。通信しない） |
| `assistant/compose-participants.js`、`assistant/compose.template.html` | 開発 | 上のページの組み立て処理と雛形。`pnpm update:tekona`がページを生成する |

作品（台本・立ち絵・ポーズ絵・背景）は[`stories/tekona/`](../../stories/tekona/README.md)にあります。

## 用意済みのもの

* 半完成品の台本`stories/tekona/tekona.k4.yml`と、作業用SB3`tekona-workshop-4.0.sb3`（台本はメニューから読み込む、外部YAML版）。
  どの求婚者も、上手（画面の右）から下手（画面の左）の手児奈に求婚する共通の構図で、自分のスプライト（コスチューム`stand`・`kime`・`rejected`）と
  自分のモデル（クラス`stand`・`kime`・`rejected`）を持ち、1人1場面で登場します。参加者の場面の雛形を台本に示しています。
* 手児奈・用意済みの求婚者3人・代わりの「？」の人物・背景4枚のSVG仮素材と、BGM・効果音。
* アシスタント用の台本組み立てページ。
* TurboWarp Plus Editorでの組み込みの自動リハーサル（公開App 4.0.0-rc.79。参加者の場面が用意済みの3人のあと、`quarrel`の前で再生されることを確認）。

## まだ用意していないもの

* **用意済み3人のポーズ学習用データとモデル**：写真の撮影が必要です。[`pose-dataset-plan.md`](pose-dataset-plan.md)に従って事前撮影し、
  モデルの共有リンクを台本の`SatoPose`・`KokufuPose`・`MiyakoPose`へ設定してください。写真を含む`project.tm`はこのリポジトリへコミットしません。
* **次の版（ブロック台本・差し替え方式）**：枠を登録済みのブロック台本SB3`tekona-workshop-blocks-4.0.sb3`を試作し、
  絵・セリフ・条件の差し替えと反映・再生を確認済みです。公開rc.79では**モデルのリンクを差し替えられない**ため、
  席ごとのモデルを事前にアップロードしてリンクを登録する方式にします（`pnpm tekona:seat-models`、撮影計画の「ブロック台本版：席ごとのモデル」、スタッフ向け資料5.4、
  [`stories/tekona/README.md`](../../stories/tekona/README.md)の「次の版（ブロック台本）の課題」）。
* 公開用のWeb版、作品一覧への掲載。
* 掲示板の投稿（半完成品・素材・提出のしかた・発展課題・共有作品）の実物と、会場PCでの通し練習（1人あたりの組み込み時間の実測）。
* 教材の図版（画面写真）、PDF化、配布ZIPの生成。
* 考証メモの〔要確認〕項目（庶民の衣服の形、頭巾の形、井戸の構造、市川周辺の出土品など）の一次資料での確認。
* 教材本文のライセンス（2026年8月1日回はPDF本文をAll rights reserved、画像等をCC BY-SA 4.0としています）。
