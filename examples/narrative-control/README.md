# 三人の訪問：各回の違いを比べる説話（開発DSL 4.1）

この例は**開発中・未配布**です。公開版4.0.0-rc.43では利用できません。
App [#980](https://github.com/kubohiroya/turbowarp-kamishibai-app/issues/980)の開発実装と、
既定OFFの`dsl4NarrativeControl`を明示的に有効化した対応runnerが必要です。

[`three-visits.k4.yml`](three-visits.k4.yml)では、共通の訪問を一度だけ書き、
`forEach.items`の3行で人物と親切さを変えます。`if`は各訪問で一度判定し、
長兄・次兄は「何もなし」、末弟は「贈り物」へ進みます。

期待する台詞順は `長兄 → 何もなし → 次兄 → 何もなし → 末弟 → 贈り物` です。
原作の引用ではなく、反復の対比を検証するための短い創作例です。
`Narrator`スプライトと衣装を対応するベースSB3に用意してください。

## 開発版で確認する

Appのmainを別checkoutでbuildした後、そのCLIを使います。公開npm版では実行しません。

```bash
node /path/to/turbowarp-kamishibai-app/bin/turbowarp-kamishibai.mjs validate-dsl4 \
  --input examples/narrative-control/three-visits.k4.yml --max-source-bytes 65536 \
  --narrative-control
node /path/to/turbowarp-kamishibai-app/bin/turbowarp-kamishibai.mjs author-block-dsl \
  --input examples/narrative-control/three-visits.k4.yml --base /path/to/base.sb3 \
  --output /tmp/three-visits-development.sb3 --max-source-bytes 65536 \
  --narrative-control
```

後者は対応する開発authoring runnerをコピーへ埋め込みます。古い公開ベースへ新台本だけを移植しても動きません。
生成物は開発確認用です。公開カタログへの登録、Release、SB3再配布、npm公開は行いません。

## 書き換える

- 各行の`name`・`kind`を変えると人物と結末を対比できます。全行で同じ列と型を使います。
- 一覧フォームでは列名・型・値・行順を表で編集します。保存までは元の入力を変更しません。
- `{ref: visit.name}`は行の値への読み取り専用参照です。列名を変えたら参照側も直してください。
- 同じ内容だけを固定回数繰り返す場合は`repeat: {times: 3, do: [...]}`を使えます。
- 未選択側、0回の本体、空一覧の本体も検証します。標準Scratchの制御ブロックは台本内では非対応です。

構文・条件式・上限・履歴・切戻しは
[Appの仕様正本](https://github.com/kubohiroya/turbowarp-kamishibai-app/blob/main/docs/design/dsl-4-narrative-control.md)を参照してください。
切戻しはflag OFFと旧台本・旧SB3への復帰を同時に行います。名前付き共通エピソードの呼出しは初期版の対象外です。
