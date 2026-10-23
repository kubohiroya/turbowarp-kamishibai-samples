# 三人の訪問 — 同じ展開、ちがう結末

DSL 4.0 RCのStandard物語制御を使う、短い創作説話です。原作の引用ではありません。
`forEach`に共通の訪問、表の3行に人物と親切さ、`if`に結末を記述します。

## 遊ぶ・編集する

[公開ページ](https://kubohiroya.github.io/turbowarp-kamishibai-samples/stories/three-visits/)からWeb版・ブロック版・公開Editor・SB3を開けます。タイトルを閉じると、
**長兄 → 何もなし → 次兄 → 何もなし → 末弟 → 贈り物**の順に再生します。
一覧ブロックの編集アイコンで名前・親切さ（kind）・行順を変え、保存して最初から再生してください。キャンセルは元の値を保ちます。

- `main.k4.yml`が台本の正本です。`instructions.svg`と`narrator.svg`を同じフォルダーに置きます。
- YAML版SB3・ブロック台本SB3・両Web版は、`app-release.json`が指定する同じ公開App RCから生成します。
- 最初の対応版は4.0.0-rc.44です。実験flagの追加は不要で、rc.43以前は対応しません。
- npm版rc.44は未公開です。CLIを使う場合は、Appの対応Release tagをcheckoutして固定依存をinstallし、`pnpm build:lib`でbuildしたCLIを使います。Appの未公開mainを生成元にしません。
- 物語制御には専用台本ブロックを使います。Scratch標準の「もし」「くりかえす」は非対応で、実行を止め、日本語ブロック名とステージ／スプライト名を含む診断から該当箇所へ移動できます。

```bash
TURBOWARP_KAMISHIBAI_APP_ROOT=/path/to/release-tag-checkout pnpm update:three-visits
```

`dsl4-artifacts.lock.json`に生成元commit・ベースSB3のhash・全成果物のhashを記録します。
固定一覧は1024行・32列、入れ子は16まで。未選択側・0回・空一覧の本体も検証されます。
切戻しはこのサンプルの公開を戻し、App参照・SB3・Web・案内を直前の検証済み世代へまとめて戻します。
3.2安定版の既存サンプルは変更しません。

詳しい構文・上限・移行は[作者ガイド](https://kubohiroya.github.io/turbowarp-kamishibai-docs/4.0/dsl-author-guides/dsl-4.0-author-guide/)を参照してください。
