# DSL 4.0 音声再生サンプル

4.0.0-rc.39のStandard SB3/npmに対応します。rc.38以前は未対応です。配布SB3・ブロック版・Web版は同じ公開commitを使用し、dsl4-artifacts.lock.jsonにhashを記録します。

`main.k4.yml`・`tone.wav`・`instructions.svg`を同じフォルダーで使います。対応版のStandard SB3でこのフォルダーを開き、タイトルを閉じると、終了待ち→バックグラウンド→一時停止/再開→ループ→フェード停止を順に実行します。

- 再生: `audioControl: {id: tone, operation: play, fadeIn: 0.2, volume: 200, fadeOut: 0.4}`
- 停止: `audioControl: {id: tone, operation: stop, fadeOut: 0.3}`
- 音量は既定100、0以上の有限数です。0は無音、50は半分、200は2倍です。小数も使えます。
- 秒数は0以上の有限数です。loopの各周回ではfadeOutせず、stopでフェードして停止します。scene終了は即時解放です。
- ブロック版でも同じ入力を使います。setVolume操作ではVALUE欄へ音量を指定し、再生用VOLUME欄を空にします。
- 旧BGM/SEは引き続き使用できます。sceneを跨ぐBGMを新しいscene単位IDへ一律に置換しません。

rc.39のCLIを固定して検証・生成する例（BASE.sb3は同じ版のStandard SB3）:

```sh
turbowarp-kamishibai validate-dsl4 --input main.k4.yml
turbowarp-kamishibai build-dsl4 --base BASE.sb3 --project-root . --output audio.sb3 --control-profile production --channel bundled --replace-existing
turbowarp-kamishibai author-block-dsl --base BASE.sb3 --input main.k4.yml --output audio-blocks.sb3
```

公開npm・Standard SB3・サンプルのSchema/ベース版は同じrc.39を使用します。[公開サンプル](https://kubohiroya.github.io/turbowarp-kamishibai-samples/stories/audio-playback/)から各形式を利用できます。

## ライセンス

Copyright © 2026 Hiroya Kubo. 台本・説明・背景SVG・2秒の440Hz合成音はMPL-2.0です。外部音声素材は含みません。
