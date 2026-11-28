# エディターたんけん — 紙芝居でEditorの使い方を学ぶ

TurboWarp Plus Editorの画面を、紙芝居を再生しながら案内する2章の教材です。
ガイド役が登場して、ステージの外にあるEditorの部品を指し示し、利用者がその操作をすると物語が続きます。
[kubohiroya/turbowarp-plus-editor#724](https://github.com/kubohiroya/turbowarp-plus-editor/issues/724)の手順3〜5です。

## 遊ぶ

次のURLで第1章を開きます。Editorが拡張機能の確認を出したら「すべて有効にして実行」を押し、緑の旗、タイトルの「紙芝居を始める」の順に押します。

https://kubohiroya.github.io/turbowarp-plus-editor/editor.html?locale=ja&twPlusLocalGit=0&project_url=https%3A%2F%2Fkubohiroya.github.io%2Fturbowarp-kamishibai-samples%2Fstories%2Feditor-guide%2Feditor-guide-01-4.0.sb3

| 章 | 起動構成 | 案内する部品と操作 |
| --- | --- | --- |
| 第1章 | Gitを外した構成（`twPlusLocalGit=0`） | スプライト一覧（クリック）、コード（ブロックを1つ動かす）、最後に「次の教材へ」ボタン |
| 第2章 | 第1章の構成にGitを戻す（`twPlusLocalGit=1`） | コードの検索（クリック）、コード（ブロックを1つ動かす） |

- 台詞は8秒で進みます。スペースキーで早く進められます。Editorの中では、ステージを押しても台詞は進みません。
- ガイドが操作を待つ間、物語は止まります。スペースキーで飛ばすこともでき、そのときは案内が消えて物語が続きます。
- 「次の教材へ」は押したときだけ移動します。言語と、第1章で指定した起動フラグを引き継ぎ、Gitを有効にした構成で第2章を開きます。
- 起動構成は教材の順序を決めるためのものです。学習の完了や利用権限を証明するものではありません。

## 仕組み

- 各章は`lesson-0N.k4.yml`（DSL 4.0台本）を正本とし、`broadcastMessageAndWait`でScratch側の受け手へ処理を渡します。
- 受け手は「ガイド」スプライトにあり、TurboWarp Plus Editorに組み込まれた[Editor Guide拡張](https://github.com/kubohiroya/turbowarp-plus-editor-guide)（`kubohiroyaeditorguide`）のブロックを呼びます。受け手のブロックは`scripts/build-editor-guide.ts`が生成します。
- 案内はEditor Guide拡張を持つEditorだけで表示されます。そのためWeb版は作りません。Guide 0.2.0以降（`code.find`と「次の教材へ」ボタン）が必要です。
- 「ほし」スプライトは練習用です。Editorは最初にこのスプライトのコードを開きます。

## 再生成と確認

```bash
TURBOWARP_KAMISHIBAI_APP_ROOT=/path/to/release-tag-checkout pnpm update:editor-guide
```

`dsl4-artifacts.lock.json`に、生成元App・台本と素材・SB3のhashを記録します。

```bash
pnpm verify:editor-guide-browser
```

2章を実際のEditorでヘッドレスに通します。SB3の公開URLへの取得は、このフォルダーのSB3に差し替えます。
`TURBOWARP_PLUS_EDITOR_BUILD`にEditorのビルドフォルダーを指定すると、公開前のEditorでも確かめられます。

## 切り戻し

このサンプルの公開を戻します。Editor側はGuideの固定版を戻すだけで、利用者の作品データは削除しません。
