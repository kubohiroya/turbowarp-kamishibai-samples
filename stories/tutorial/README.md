# 地震だ！頭を守ろう — DSL 4.0チュートリアル作品

DSL 4.0チュートリアルの「紙芝居を遊ぶ」「紙芝居を作る」で共通利用する、4場面の
最小作品です。教室で地震の揺れを感じた参加者が、自分の身を守るために丈夫な机の下へ入り、
両手で頭を守る流れを練習します。

汎用ベースは`app-release.json`に記録したTurboWarp-Kamishibaiの公開releaseから取得し、再生用とブロック台本用のビルダーは
rootの`app-release.json`から同じreleaseタグのcommitを取得します。samplesを先に公開し、
docs側はその公開surfaceを使ってcaptureとチュートリアルpublicationを行います。

## 正本と成果物

- `story.kamishibai.yaml`: 完成版の正本
- `starter.kamishibai.yaml`: starter ZIPへ`story.kamishibai.yaml`として収録する初期版
- `addition-kit/`: 揺れている教室、頭を守る見本、YAML断片
- `safety-pose/`: 「頭を守る」ラベルを含む検証済みポーズモデル
- `tutorial-4.0.sb3`: 完成版の自己完結SB3
- `tutorial-blocks-4.0.sb3`: 各場面と命令を個別のTurboWarpブロックとして持ち、編集・再生できるSB3。
  Stage上の名前が空の台本をルートとして起動時に読み取り、タイトルを閉じるとその物語を開始します。
  編集後に開始し直すと変更が反映されます。file素材のモデルやアイコンは対応するアセットバンドルとして同梱します。`pnpm verify`は、ここから書き戻したYAMLが`story.kamishibai.yaml`と同じ意味であることを
  canonical形で確認します
- `tutorial-story-starter-4.0.zip`: starterとaddition kitをまとめた配布物
- `tutorial-story-addition-kit-4.0.zip`: addition kitだけの配布物
- `public-surfaces.json`: 公開URL、version、integrity、license、公開状態

`pnpm update:tutorial-dsl4`はSB3、ZIP、Web lock、公開surface manifestをatomicに更新します。
通常の`pnpm build`とCIは同じ入力から再生成し、チェックイン済みhashとの一致だけを確認します。

## 防災上の前提

この作品は、教室内に丈夫な机がある場面に限定した練習です。周囲の状況に応じて、落下物や倒れそうな
家具から離れ、安全な空間を確保してください。表現は気象庁「地震について」と消防庁「地震防災マニュアル」
の案内を参考にしています。

- https://www.jma.go.jp/jma/kishou/know/faq/faq7.html
- https://www.fdma.go.jp/relocation/bousai_manual/occ/occurrence111.html

## 公開フラグ

`sample.config.json`の`dsl4.publication.enabled`は起動時固定でONです。同じ公開releaseのベースとビルダーコミット
から成果物を再現してブラウザー検証し、`dist/`と作品一覧へ公開します。docs側のcapture完了は
公開条件にしません。問題時はフラグをOFFへ戻して4.0チュートリアルの公開導線だけを停止し、既存3.2成果物を維持します。

完成版とaddition kitは`poseRecognition.preview.overlay`を使い、手首ジョイントとボーンをカメラ映像へ重ねて表示します。これはTeachable Machine拡張のoverlay APIを利用する例です。

あわせて`poseRecognition.preview.controls`も宣言し、カメラ映像の左右反転ボタン（右上）とカメラ選択メニュー（左上）を
出します。描くのはapp shellの固定rendererで、作品側はアイコンと位置を指定するだけです。アイコンは`kind: image`の
素材として台本に宣言します（スプライトのコスチュームではないので`project-assets-dsl4.yml`には置きません）。
カメラが動いている間だけ表示され、カメラを止めると消えます。

rc.25への再pinと再起動待機の修正反映は[Issue #175](https://github.com/kubohiroya/turbowarp-kamishibai-samples/issues/175)で管理します。切り戻す場合は、ビルダーとブロック台本用CLIのpin、ベースSB3、生成SB3、artifact lock、公開surfaceを更新前の組へ戻して再デプロイします。公開済みの本体release artifactは差し替えません。

ブロック台本SB3は浦島太郎と同じく、rc.25のラッパーの`extensions`属性が`configurable: true`であることを検証し、完成作品のfile素材bundleを引き継いで公式ツールチェーンで再構築します。切り戻す場合は、生成処理・生成SB3・artifact lock・公開surfaceをまとめてrevertします。

ブロック台本の埋め込み拡張は、定義用の8フォーム（`VALUE`）とポーズ認識ステップ用フォーム（`STEPS`）の計9件を登録します。生成時に登録数と編集対象の引数を検証します。

## 台本の一部をオン／オフにする

公開ブロック台本SB3は、紫色の「Kamishibai Block Script」から「この部分を使う［オン／オフ］」を追加できます。
定義またはscene内の命令列を囲み、オフにすると内側を残したまま実行対象から外します。保存後、物語を開始し直して確認します。
[図版付きの使い方](https://kubohiroya.github.io/turbowarp-kamishibai-docs/4.0/block-author-guides/dsl-4.0-block-author-guide/#use-section)を参照してください。

本体の既定値はOFFのまま、samplesの`stories/urashima/sample.config.json`の`dsl4.blockAuthoring.sourceSections: true`で
生成時に`--block-sections true`を指定しています。my-urashimaの2・3・4ポーズ版も同じ設定です。
切り戻しはこの設定と生成・検証変更、ブロックSB3・lockをまとめてrevertしてPagesを再公開します。
