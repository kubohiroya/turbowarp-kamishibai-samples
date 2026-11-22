# 手児奈の仮素材：絵柄の版の記録

`stories/tekona/assets/`の仮素材（立ち絵・ポーズ絵・背景のSVG）を描き直してきた3つの版を、参考用にそのまま保存しています。
作品のSB3が使うのは`stories/tekona/assets/`だけで、このフォルダはSB3の生成には使いません。

| 版 | フォルダ | 元のコミット | 絵柄 |
| --- | --- | --- | --- |
| 1 | [`v1-simple/`](v1-simple/) | `0c6ddfd`（描き直し前） | 輪郭線のない、シンプルな平面イラスト。人物は正面向き |
| 2 | [`v2-detailed/`](v2-detailed/) | `e159f7b` | 平面イラストのまま、[考証メモ](../research-notes.md)の衣装・背景を描き込んだ版。求婚者は手児奈のほうを向く |
| 3 | [`v3-anime/`](v3-anime/) | `d525136`（現在の`stories/tekona/assets/`） | アニメ調。細い輪郭線とアニメ塗り（光は左上、影1段）、6頭身前後。背景はグラデーションと光の反射を入れたアニメ背景風 |

各フォルダの中身：

| ファイル | 内容 |
| --- | --- |
| `assets/*.svg` | その版の素材一式。ファイル名・大きさ（人物240×380、背景480×360）・回転の中心は全版で共通なので、`stories/tekona/assets/`へ戻せばその版の絵でSB3を作れる |
| `preview.png` | 素材の一覧（人物の背景の水色は確認用） |
| `style-reference.png` | その版の`copilot/style-reference.png`（Copilotに添付する絵柄の見本） |
| `generator/`（版2・版3） | SVGを生成したスクリプト。`node generator/chars.cjs 出力先フォルダ`、`node generator/backdrops.cjs 出力先フォルダ`で、`assets/`と同じSVGを出力する |

補足：

* 版1は手描きのSVGで、生成スクリプトはありません。
* 版2の生成スクリプトは手児奈・用意済み3人・背景を出力します。参加者の枠の「？」の人物（`newcomer-*`）と`text-placeholder.svg`は版1と同じものです。
* 版3の生成スクリプトは`newcomer-*`も出力します。`text-placeholder.svg`は全版で同じです。
* 版3に合わせて、参加者向け資料のCopilotへの依頼文の絵柄の指定を変えています。版1・版2の絵に戻すときは、
  [`tekona-workshop.md`](../tekona-workshop.md)の依頼文も「太い輪郭線のない、シンプルな平面イラスト」に戻してください。

ライセンスは`stories/tekona/assets/`と同じMPL-2.0です（[`stories/tekona/LICENSES.md`](../../../stories/tekona/LICENSES.md)）。
