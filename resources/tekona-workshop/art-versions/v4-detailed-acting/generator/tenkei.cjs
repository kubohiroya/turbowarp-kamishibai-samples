// 点景（版4の絵柄：輪郭線なしの平面イラスト）。考証メモ 2.6・6章にもとづく、人物の出ない短いカットと、背景の上で動かす小さなアクター。
// 背景（480x360）
//   yoake    夜明けの入江：国府台の上から、朝もやの真間の入江・砂州・里を見下ろす大きな景色
//   ido-mizu 真間の井の寄り：井の字に組んだ木の枠の中に、空を映す清水と、なわで下ろした曲物のつるべ
//   yugure   夕げの煙：日暮れの里。伏屋の戸口に火の明かり（煙はアクター Kemuri で立ちのぼらせる）
//   haru     春：水を張った田に苗の列、入江の若い葦、花の咲く台地、つばめ
//   natsu    夏：入道雲と、玉藻のなびく入江（にほ鳥はアクター Nio で潜らせる）
//   aki      秋：実った葛飾早稲の田と、刈り取って立てた稲束、すすき（雁はアクター Kari で渡らせる）
//   arashi   冬の嵐の夜：雲に隠れる月、波のとどろく入江、風に傾く松と葦。左手前の岸に人物が立てる
// アクター
//   kemuri-1・2 夕げの煙（120x160、2枚を交互に切り替えて揺らす）
//   nio-1〜3    にほ鳥（カイツブリ）：浮かぶ／潜る／水の輪だけ（100x70）
//   kari-1・2   雁の列：羽を上げる／下げる（160x90）
// 実行：node generator/tenkei.cjs 出力先フォルダ
const fs = require('fs');
const path = require('path');
const {reeds, grove, fuseya, grebe, tamamo, rnd0, pineRow, marukibune, grass, ripples, soften, HORIZON} = require('./backdrops.cjs');

let defs = [], gid = 0;
const grad = (stops, x2 = 0, y2 = 1) => {
  const id = `t${++gid}`;
  defs.push(`<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}">${stops.map(([o, c, a = 1]) => `<stop offset="${o}" stop-color="${c}"${a === 1 ? '' : ` stop-opacity="${a}"`}/>`).join('')}</linearGradient>`);
  return `url(#${id})`;
};
const glow = (cx, cy, r, c, a = .6) => {
  const id = `t${++gid}`;
  defs.push(`<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${c}" stop-opacity="${a}"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient>`);
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#${id})"/>`;
};
const f1 = v => v.toFixed(1);
// もこもこした雲：円を横に並べ、下を平らに切る
const cloud = (x, y, w, h, c, shade, seed = 1) => {
  const rnd = rnd0(seed);
  let s = '';
  const n = Math.max(3, Math.round(w / (h * .9)));
  for (let i = 0; i < n; i++) {
    const cx = x + (i + .5) * w / n, r = h * (.55 + rnd() * .5) * (i === 0 || i === n - 1 ? .75 : 1);
    s += `<circle cx="${f1(cx)}" cy="${f1(y - r * .6)}" r="${f1(r)}" fill="${c}"/>`;
  }
  s += `<rect x="${x}" y="${f1(y - h * .5)}" width="${w}" height="${f1(h * .5)}" fill="${c}"/>`;
  if (shade) s += `<path d="M${x + 4} ${y} Q${x + w / 2} ${f1(y - h * .35)} ${x + w - 4} ${y} Z" fill="${shade}"/>`;
  return s;
};
// 風になびく葦：先を同じ向きへ大きく倒す
const bentReeds = (x0, x1, base, color, seed, h, lean) => {
  const rnd = rnd0(seed);
  let s = '';
  for (let x = x0; x < x1; x += 5 + rnd() * 6) {
    const hh = h * (.55 + rnd() * .6), l = lean * (.7 + rnd() * .6);
    s += `<path d="M${f1(x)} ${base} q${f1(l * .15)} ${f1(-hh * .6)} ${f1(l)} ${f1(-hh)}" stroke="${color}" stroke-width="${f1(2 + rnd() * 1.5)}" fill="none" stroke-linecap="round"/>`;
    if (rnd() > .5) s += `<path d="M${f1(x + l)} ${f1(base - hh)} q${f1(l * .35)} 4 ${f1(l * .6)} 12" stroke="${color}" stroke-width="4.5" fill="none" stroke-linecap="round" opacity=".8"/>`;
  }
  return s;
};
// 小さな鳥（遠くを飛ぶ影）
const birdV = (x, y, s, c, w = 2) => `<g data-ambient="birds"><path d="M${x - 6 * s} ${y} q${3 * s} ${-4 * s} ${6 * s} 0 q${3 * s} ${-4 * s} ${6 * s} 0" stroke="${c}" stroke-width="${w}" fill="none" stroke-linecap="round"/></g>`;

// ---------- 夜明けの入江（国府台の上から見下ろす） ----------
function yoake() {
  let s = `<rect width="480" height="360" fill="${grad([[0, '#2f3d6e'], [.38, '#8c7aa6'], [.62, '#eeb09c'], [.78, '#fbe0b6'], [1, '#f6e8cc']])}"/>`;
  s += glow(392, 150, 170, '#fff1c4', .75);
  // 朝焼けの細い雲
  s += `<path d="M40 62 q50 -10 120 -2 M80 78 q40 -6 92 0 M282 52 q60 -10 136 -2 M318 70 q40 -6 96 0" stroke="#f4b6a6" stroke-width="5" stroke-linecap="round" fill="none" opacity=".75"/>`;
  // 遠くの海
  s += `<rect y="146" width="480" height="16" fill="${grad([[0, '#d8c4cc'], [1, '#c4bccf']])}"/>`;
  s += ripples([[352, 152, 60], [404, 157, 40], [300, 156, 30]], '#fff4d6', .8);
  // 市川砂州：横に長くのびる砂の帯と松（もやで淡く）
  s += `<path d="M120 166 Q260 156 480 158 V170 Q300 168 120 172 Z" fill="${grad([[0, '#b8a6a8'], [1, '#a89aa2']])}"/>`;
  s += pineRow([150, 172, 196, 222, 250, 280, 308, 338, 366, 396, 424, 452, 474], 164, .32, ['#7e7488', '#8e849a'], 51);
  // 真間の入江：砂州の内側の静かな水面
  s += `<path d="M0 176 Q240 168 480 170 V360 H0 Z" fill="${grad([[0, '#e6d0d0'], [.45, '#c6c4d6'], [1, '#98aec6']])}"/>`;
  s += ripples([[360, 186, 70], [372, 198, 50], [384, 210, 30], [150, 214, 40], [250, 236, 50], [330, 262, 40]], '#fff4d6', .7);
  // 入江の葦原の島
  s += `<path d="M206 252 q40 -10 84 0 q-40 8 -84 0 z M332 222 q30 -8 64 0 q-30 6 -64 0 z" fill="#8a9a88" opacity=".8"/>`;
  s += reeds(212, 286, 252, '#7a8c78', 23, 16) + reeds(336, 394, 222, '#7e9080', 29, 12);
  // 入江の岸の低い里：伏屋と立ちのぼる煙
  s += `<path d="M0 206 Q90 200 170 214 Q210 222 214 236 Q140 246 0 244 Z" fill="${grad([[0, '#a8a08a'], [1, '#8c8a78']])}"/>`;
  s += fuseya(62, 226, 24, '#8a7c6a', '#6e6254', '#4a4038') + fuseya(98, 230, 20, '#8e806c', '#6e6254', '#4a4038') + fuseya(134, 228, 22, '#8a7c6a', '#6e6254', '#4a4038');
  for (const [x, y] of [[62, 207], [134, 210]]) s += `<path d="M${x} ${y} q-4 -8 2 -14 q6 -7 0 -14" stroke="#f6ecec" stroke-width="2.2" fill="none" opacity=".7" stroke-linecap="round"/>`;
  // 朝もや：入江の上に、横に長い白い帯を重ねる
  for (const [y, x, w, a] of [[182, -20, 300, .45], [204, 160, 340, .4], [232, -40, 260, .35], [272, 200, 300, .3], [196, 300, 200, .35]])
    s += `<ellipse cx="${x + w / 2}" cy="${y}" rx="${w / 2}" ry="7" fill="#ffffff" opacity="${a}"/>`;
  // 手前：見下ろしている国府台の縁と雑木林（左下から画面をふちどる）
  s += `<path d="M0 262 Q70 256 132 280 Q186 302 214 360 H0 Z" fill="${grad([[0, '#4c6650'], [1, '#2c4034']])}"/>`;
  s += grove(-6, 150, 268, '#3e5a46', '#466450', 17);
  s += `<path d="M300 360 Q360 318 480 300 V360 Z" fill="${grad([[0, '#486250'], [1, '#2c4034']])}"/>`;
  s += grove(372, 486, 312, '#3a5442', '#44604c', 19);
  // 左上からかかる木の枝
  s += `<path d="M-4 30 Q40 40 70 70 Q86 86 104 92" stroke="#2c3a32" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M40 52 q10 -12 26 -10" stroke="#2c3a32" stroke-width="3" fill="none"/>`;
  for (const [x, y, r] of [[0, 20, 26], [30, 30, 20], [58, 54, 16], [84, 78, 14], [104, 90, 11], [62, 40, 12], [16, 50, 16]]) s += `<circle cx="${x}" cy="${y}" r="${r}" fill="${r > 15 ? '#30443a' : '#3a5044'}"/>`;
  // ねぐらから飛び立つ水鳥
  s += birdV(250, 110, 1.3, '#4a4466', 2.2) + birdV(274, 98, 1.1, '#4a4466', 2) + birdV(232, 96, 1, '#4a4466', 2);
  return s;
}

// ---------- 真間の井の寄り ----------
function idoMizu() {
  let s = `<rect width="480" height="360" fill="${grad([[0, '#d9c396'], [1, '#c4a878']])}"/>`;
  s += grass(0, 480, 18, '#9aa864', 7, 7) + grass(0, 480, 300, '#8e9c5a', 9, 8);
  // 井戸のまわりの、踏みならされて濡れた土
  s += `<ellipse cx="240" cy="200" rx="230" ry="150" fill="#b89a68" opacity=".55"/>`;
  s += `<ellipse cx="300" cy="300" rx="70" ry="16" fill="#9a8058" opacity=".5"/>`;
  // 井戸の内側（土の壁）と水面
  const inner = 'M146 118 L334 118 L362 258 L118 258 Z';
  s += `<path d="${inner}" fill="${grad([[0, '#4a3420'], [1, '#2a1c10']])}"/>`;
  s += `<path d="M156 150 L324 150 L344 246 L136 246 Z" fill="${grad([[0, '#8ec8e6'], [.6, '#5fa2c8'], [1, '#3f7fa8']])}"/>`;
  // 水面に映る空と雲
  s += `<path d="M176 168 q10 -10 24 -4 q12 -8 22 2 q10 0 8 8 h-56 q-6 -4 2 -6 z" fill="#ffffff" opacity=".7"/>`;
  s += `<path d="M268 206 q8 -8 18 -2 q10 -6 18 2 q8 0 6 6 h-46 q-4 -4 4 -6z" fill="#ffffff" opacity=".55"/>`;
  // つるべが水に触れたところの、水の輪
  for (const [rx, ry, a] of [[14, 4, .9], [30, 8, .6], [48, 13, .4]]) s += `<ellipse cx="252" cy="214" rx="${rx}" ry="${ry}" fill="none" stroke="#e8f6ff" stroke-width="1.8" opacity="${a}"/>`;
  // なわで下ろした曲物のつるべ
  s += `<path d="M252 0 L252 190" stroke="#a8885a" stroke-width="3"/><path d="M252 0 L252 190" stroke="#6e5434" stroke-width="1" stroke-dasharray="3 3"/>`;
  s += `<path d="M236 190 q16 -10 32 0" stroke="#8a6a40" stroke-width="2" fill="none"/>`;
  s += `<path d="M234 192 L236 212 Q252 218 268 212 L270 192 Z" fill="${grad([[0, '#d8b47a'], [1, '#b08a52']], 1, 0)}"/>`;
  s += `<ellipse cx="252" cy="192" rx="18" ry="5" fill="#8a6a3e"/><ellipse cx="252" cy="192" rx="15" ry="3.6" fill="#6aa8cc"/>`;
  s += `<path d="M235 200 Q252 205 269 200" stroke="#8a6a3e" stroke-width="2" fill="none"/>`;
  // 井の字に組んだ木の枠（丸太を2段。角で交差して、丸太の端が外へ出る）
  const log = (x1, y1, x2, y2, w, c1, c2) => {
    const a = Math.atan2(y2 - y1, x2 - x1), nx = -Math.sin(a) * w / 2, ny = Math.cos(a) * w / 2;
    return `<path d="M${f1(x1 + nx)} ${f1(y1 + ny)} L${f1(x2 + nx)} ${f1(y2 + ny)} L${f1(x2 - nx)} ${f1(y2 - ny)} L${f1(x1 - nx)} ${f1(y1 - ny)} Z" fill="${grad([[0, c1], [1, c2]])}"/>` +
      `<path d="M${f1(x1 + nx * .4)} ${f1(y1 + ny * .4 - 1)} L${f1(x2 + nx * .4)} ${f1(y2 + ny * .4 - 1)}" stroke="#c8965c" stroke-width="1.4" opacity=".7"/>` +
      `<ellipse cx="${f1(x1)}" cy="${f1(y1)}" rx="${f1(w * .32)}" ry="${f1(w / 2)}" fill="#c89a62"/><ellipse cx="${f1(x1)}" cy="${f1(y1)}" rx="${f1(w * .16)}" ry="${f1(w / 4)}" fill="none" stroke="#9a6a3a" stroke-width="1"/>` +
      `<ellipse cx="${f1(x2)}" cy="${f1(y2)}" rx="${f1(w * .32)}" ry="${f1(w / 2)}" fill="#c89a62"/><ellipse cx="${f1(x2)}" cy="${f1(y2)}" rx="${f1(w * .16)}" ry="${f1(w / 4)}" fill="none" stroke="#9a6a3a" stroke-width="1"/>`;
  };
  // 奥の段（左右の丸太）→ 奥・手前の丸太 の順に重ねる
  s += log(140, 92, 112, 286, 22, '#8a5a30', '#6a4020') + log(340, 92, 368, 286, 22, '#8a5a30', '#6a4020');
  s += log(112, 112, 368, 112, 22, '#9a6a3a', '#7a4c26');
  s += log(92, 266, 388, 266, 30, '#a0703e', '#7a4c26');
  // 左下：水を待つ土師器の甕、右下：手前に置いたかご
  s += `<path d="M44 300 q-14 18 -4 34 q16 12 32 0 q10 -16 -4 -34 z" fill="#b5703c"/><ellipse cx="56" cy="300" rx="12" ry="4" fill="#7a4a24"/><path d="M40 314 q16 4 32 0" stroke="#9a5a2c" stroke-width="1.6" fill="none"/>`;
  s += `<path d="M412 316 Q413 334 420 337 L446 337 Q453 334 454 316 Z" fill="#c9a865"/><path d="M410 316 Q433 319 456 316" stroke="#8a6a32" stroke-width="2.6" fill="none" stroke-linecap="round"/>`;
  for (const yy of [322, 328, 333]) s += `<path d="M412 ${yy} Q433 ${yy + 2} 454 ${yy}" stroke="#9a7a3e" stroke-width="1.1" fill="none"/>`;
  // 葉の影
  s += `<path d="M380 0 q40 30 100 20 V0 Z M0 0 q30 26 80 10 q-20 -6 -30 -10 Z" fill="#5a6a3a" opacity=".25"/>`;
  return soften(s, .18);
}

// ---------- 夕げの煙（日暮れの里） ----------
// 煙出しの位置（画面の座標）：右から2番目の伏屋 (280, 190)。台本の Kemuri はここから立ちのぼる
function yugure() {
  let s = `<rect width="480" height="360" fill="${grad([[0, '#34295a'], [.45, '#9a4f7a'], [.72, '#ef9458'], [1, '#f6c47a']])}"/>`;
  s += glow(110, 168, 150, '#ffd890', .8) + `<circle cx="110" cy="168" r="26" fill="#ffd27a"/>`;
  s += `<path d="M190 70 q50 -10 120 -2 M230 86 q40 -6 90 0 M360 54 q40 -8 100 0" stroke="#f6a88a" stroke-width="5" stroke-linecap="round" fill="none" opacity=".7"/>`;
  // 国府台の台地（夕日をさえぎる）
  s += `<path d="M0 176 Q120 164 250 172 Q380 178 480 168 V214 H0 Z" fill="#5a3c58"/>`;
  s += grove(0, 480, 176, '#4e3450', '#5a3c5a', 27);
  // 里の地面
  s += `<path d="M0 206 Q240 196 480 204 V360 H0 Z" fill="${grad([[0, '#6a4a4a'], [1, '#2e2228']])}"/>`;
  s += `<path d="M0 232 Q200 222 480 236" stroke="#8a6050" stroke-width="3" fill="none" opacity=".5"/>`;
  // 伏屋の列：戸口に、なかで燃える火の明かり
  for (const [x, y, w] of [[70, 250, 70], [170, 238, 56], [280, 248, 74], [392, 238, 58]]) {
    s += glow(x, y - 6, w * .55, '#ffb060', .45);
    s += fuseya(x, y, w, '#6e4c4c', '#4a3036', '#f2a050');
    s += `<path d="M${x - w * .06} ${y} v-${f1(w * .1)} q${f1(w * .06)} -${f1(w * .05)} ${f1(w * .12)} 0 v${f1(w * .1)} z" fill="#ffd890"/>`;
  }
  // 遠い伏屋の細い煙（動かない）
  for (const [x, y] of [[70, 196], [392, 193]]) s += `<path d="M${x} ${y} q-5 -10 2 -18 q8 -9 0 -18 q-6 -8 2 -16" stroke="#e8c8c0" stroke-width="2.6" fill="none" opacity=".45" stroke-linecap="round"/>`;
  // ねぐらへ帰る鳥
  s += birdV(300, 110, 1.2, '#3a2a44', 2.2) + birdV(322, 100, 1, '#3a2a44', 2) + birdV(282, 98, 1, '#3a2a44', 2);
  // 手前の葦（暗く）
  s += reeds(0, 70, 360, '#2a2026', 31, 96) + reeds(410, 480, 360, '#2a2026', 37, 100);
  return s;
}

// ---------- 春 ----------
function haru() {
  const H = HORIZON;
  let s = `<rect width="480" height="360" fill="${grad([[0, '#a8d4f0'], [.6, '#d8eef8'], [1, '#f2f9fc']])}"/>`;
  s += cloud(60, 70, 90, 22, '#ffffff', '#e6eef4', 3) + cloud(330, 54, 70, 18, '#ffffff', '#e6eef4', 5);
  // 遠くの海と砂州
  s += `<rect x="250" y="${H - 50}" width="230" height="12" fill="#a8d4ea"/>`;
  s += `<path d="M260 ${H - 38} Q370 ${H - 46} 480 ${H - 42} V${H - 32} H260 Z" fill="#ecdcae"/>`;
  s += pineRow([290, 312, 336, 360, 386, 412, 436, 460], H - 39, .3, ['#5f8a5e', '#78a272'], 61);
  // 国府台：若葉の雑木林と、花の咲く木
  s += `<path d="M0 ${H - 46} Q90 ${H - 56} 190 ${H - 48} Q240 ${H - 42} 270 ${H - 30} H0 Z" fill="${grad([[0, '#a8d48a'], [1, '#8cc070']])}"/>`;
  s += grove(0, 250, H - 46, '#9cd07c', '#b4dc8e', 41).replace(/r="([\d.]+)"/g, (m, r) => `r="${(r * .55).toFixed(1)}"`);
  for (const [x, y] of [[48, 146], [150, 142], [214, 150]]) {
    const rnd = rnd0(x * 3 + y);
    for (let i = 0; i < 9; i++) s += `<circle cx="${f1(x + (rnd() - .5) * 26)}" cy="${f1(y + (rnd() - .5) * 14)}" r="${f1(5 + rnd() * 4)}" fill="${rnd() > .5 ? '#f6d8de' : '#fbe8ec'}"/>`;
  }
  // 入江（右）と、岸の若い葦
  s += `<rect x="260" y="${H - 30}" width="220" height="${390 - H}" fill="${grad([[0, '#9ad0e6'], [1, '#74b6d6']])}"/>`;
  s += ripples([[340, 196, 34], [410, 214, 40], [430, 290, 30], [450, 330, 20]], '#ffffff', .6);
  // 水を張った田：畦で区切った段々の田。水面に空が映り、苗が列になって並ぶ
  const fields = [
    ['M0 176 L250 176 L300 214 L0 214 Z', 176, 214, 0, 300],
    ['M0 222 L306 222 L350 262 L0 262 Z', 222, 262, 0, 350],
    ['M0 270 L356 270 L410 318 L0 318 Z', 270, 318, 0, 410],
  ];
  s += `<path d="M0 ${H - 32} H272 L420 340 V360 H0 Z" fill="#a8b46a"/>`;
  for (const [d, y0, y1, x0, x1] of fields) {
    s += `<path d="${d}" fill="${grad([[0, '#d4ecf4'], [1, '#a8d2e4']])}"/>`;
    s += `<path d="M10 ${y0 + 8} q30 -4 60 0 M160 ${y0 + 14} q30 -4 60 0" stroke="#ffffff" stroke-width="2" fill="none" opacity=".6"/>`;
    const rows = Math.round((y1 - y0) / 7);
    for (let r = 0; r < rows; r++) {
      const yy = y0 + 4 + r * (y1 - y0 - 6) / rows, gap = 8 + r * 1.2, xe = x1 - (y1 - yy) * (x1 - 250) / (y1 - y0) - 14;
      for (let x = 6 + (r % 2) * gap / 2; x < Math.min(xe, x1 - 20); x += gap) s += `<path d="M${f1(x)} ${f1(yy)} l-1.4 ${f1(-3 - r * .4)} M${f1(x)} ${f1(yy)} l1.4 ${f1(-3 - r * .4)}" stroke="#6aa84a" stroke-width="1.3" stroke-linecap="round"/>`;
    }
  }
  s += reeds(352, 410, 266, '#8cc860', 43, 22) + reeds(384, 440, 300, '#9ad06a', 47, 26) + reeds(416, 470, 340, '#8cc860', 53, 30);
  // 手前の畦の草とすみれ色の小さな花
  s += `<path d="M0 326 Q200 318 420 342 V360 H0 Z" fill="${grad([[0, '#9cbc68'], [1, '#86a858']])}"/>`;
  s += grass(0, 420, 330, '#7a9c4c', 49, 9);
  for (const [x, y] of [[40, 340], [120, 346], [210, 338], [300, 348]]) s += `<circle cx="${x}" cy="${y}" r="2.6" fill="#b49ad8"/><circle cx="${x + 6}" cy="${y + 4}" r="2.2" fill="#f6f0a8"/>`;
  // つばめ
  const swallow = (x, y, s2) => `<g data-ambient="birds"><path d="M${x} ${y} l${-12 * s2} ${-6 * s2} l${8 * s2} ${7 * s2} l${-10 * s2} ${8 * s2} l${14 * s2} ${-6 * s2} l${10 * s2} ${2 * s2} z" fill="#2a3450"/></g>`;
  s += swallow(200, 96, 1.2) + swallow(250, 120, .9);
  return soften(s, .18);
}

// ---------- 夏 ----------
// にほ鳥（アクター Nio）は入江の中ほど、画面の座標 (220〜300, 250) あたりの開けた水面に浮かべる
function natsu() {
  const H = HORIZON;
  let s = `<rect width="480" height="360" fill="${grad([[0, '#4f9fdc'], [.6, '#9fd2f0'], [1, '#d8eef8']])}"/>`;
  // 入道雲
  for (const [x, y, r, c] of [[150, 150, 50, '#f2f6fa'], [200, 120, 58, '#ffffff'], [250, 96, 46, '#ffffff'], [290, 128, 50, '#f6f9fc'], [330, 152, 40, '#eef3f8'], [110, 168, 34, '#eef3f8'], [214, 70, 34, '#ffffff'], [180, 160, 46, '#ffffff'], [280, 166, 40, '#f6f9fc']])
    s += `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}"/>`;
  s += `<path d="M84 186 Q220 160 372 186 Z" fill="#dbe6f0"/>`;
  // 遠くの海・砂州と松
  s += `<rect y="${H - 14}" width="480" height="14" fill="${grad([[0, '#5fa6d6'], [1, '#4a96c8']])}"/>`;
  s += `<path d="M0 ${H - 2} Q240 ${H - 10} 480 ${H - 4} V${H + 6} H0 Z" fill="${grad([[0, '#f0dca6'], [1, '#d8c08a']])}"/>`;
  s += pineRow([12, 38, 64, 92, 120, 150, 330, 356, 382, 410, 436, 462], H - 3, .4, ['#3f6e48', '#5a8a5c'], 71);
  // 入江：玉藻のなびく、夏の濃い水面
  s += `<rect y="${H + 4}" width="480" height="${360 - H - 4}" fill="${grad([[0, '#4ea0c8'], [.5, '#3a8ab4'], [1, '#2e769e']])}"/>`;
  s += ripples([[40, 222, 40], [330, 218, 50], [150, 236, 30], [380, 262, 40], [90, 290, 36], [200, 300, 30]], '#ffffff', .55);
  for (const [x, y, n] of [[60, 250, 3], [140, 270, 2], [340, 244, 3], [410, 280, 4], [30, 300, 2], [180, 320, 3], [372, 312, 2]]) s += tamamo(x, y, '#2f6f4a', n);
  // 手前の葦（夏の青い葦）
  s += reeds(0, 90, 360, '#3f7a34', 73, 130) + reeds(390, 480, 360, '#4a8a3c', 79, 140);
  return soften(s, .12);
}

// ---------- 秋 ----------
// 雁（アクター Kari）は画面の上半分（y 60〜120）を左から右へ渡らせる
function aki() {
  const H = HORIZON;
  let s = `<rect width="480" height="360" fill="${grad([[0, '#6fa8de'], [.6, '#bcdcf2'], [1, '#eef6fa']])}"/>`;
  // うろこ雲
  const rnd = rnd0(83);
  for (let i = 0; i < 46; i++) {
    const x = 20 + rnd() * 440, y = 30 + rnd() * 70;
    s += `<ellipse cx="${f1(x)}" cy="${f1(y)}" rx="${f1(8 + rnd() * 6)}" ry="${f1(3 + rnd() * 2)}" fill="#ffffff" opacity="${f1(.55 + rnd() * .35)}"/>`;
  }
  // 遠くの海と砂州
  s += `<rect x="260" y="${H - 50}" width="220" height="12" fill="#9ccbe4"/>`;
  s += `<path d="M270 ${H - 38} Q380 ${H - 46} 480 ${H - 42} V${H - 32} H270 Z" fill="#e8d6a4"/>`;
  s += pineRow([298, 322, 348, 374, 400, 426, 452, 474], H - 39, .3, ['#4f7650', '#6a8e62'], 89);
  // 国府台：色づいた雑木林
  s += `<path d="M0 ${H - 46} Q100 ${H - 56} 200 ${H - 48} Q250 ${H - 40} 280 ${H - 30} H0 Z" fill="${grad([[0, '#b8a060'], [1, '#9c8a50']])}"/>`;
  s += grove(0, 262, H - 46, '#d08a3a', '#b8662e', 97).replace(/r="([\d.]+)"/g, (m, r) => `r="${(r * .55).toFixed(1)}"`);
  s += grove(10, 250, H - 44, '#8a9a48', '#e0a848', 101).replace(/r="([\d.]+)"/g, (m, r) => `r="${(r * .4).toFixed(1)}"`);
  // 入江（右）
  s += `<path d="M280 ${H - 30} H480 V300 Q430 284 390 266 Q340 240 280 ${H - 30} Z" fill="${grad([[0, '#8cc4de'], [1, '#6aaed0']])}"/>`;
  s += ripples([[350, 196, 34], [420, 214, 40], [410, 250, 30]], '#ffffff', .55);
  // 実った葛飾早稲の田：黄金色の穂が波打つ
  s += `<path d="M0 ${H - 32} H282 Q340 240 390 266 Q430 284 480 300 V360 H0 Z" fill="${grad([[0, '#e8c45e'], [.6, '#dcae48'], [1, '#c8983a']])}"/>`;
  const r2 = rnd0(107);
  for (let y = H - 26; y < 300; y += 7) {
    const k = (y - H + 26) / 140;
    for (let x = 4 + r2() * 10; x < 300 + k * 60; x += 9 + k * 6) {
      const h = 4 + k * 8;
      s += `<path d="M${f1(x)} ${f1(y)} q${f1(2 + k * 2)} ${f1(-h * .6)} ${f1(5 + k * 4)} ${f1(-h * .4)}" stroke="${r2() > .5 ? '#b8862a' : '#a8781e'}" stroke-width="${f1(1 + k * 1.2)}" fill="none" stroke-linecap="round"/>`;
    }
  }
  // 刈り取ったあとの田と、稲束を立てて干したもの
  s += `<path d="M0 300 Q120 292 250 304 L240 360 H0 Z" fill="${grad([[0, '#d2b674'], [1, '#bea060']])}"/>`;
  for (let x = 6; x < 240; x += 10) s += `<path d="M${x} ${306 + (x % 3) * 12} v-4" stroke="#a88a4a" stroke-width="1.4"/>`;
  const taba = (x, y, k) => `<path d="M${x - 9 * k} ${y} Q${x - 6 * k} ${y - 22 * k} ${x} ${y - 30 * k} Q${x + 6 * k} ${y - 22 * k} ${x + 9 * k} ${y} Z" fill="#d8b050"/><path d="M${x - 6 * k} ${y - 14 * k} Q${x} ${y - 12 * k} ${x + 6 * k} ${y - 14 * k}" stroke="#8a6a2a" stroke-width="${2 * k}" fill="none"/><path d="M${x} ${y - 30 * k} q${-6 * k} ${-4 * k} ${-10 * k} ${2 * k} M${x} ${y - 30 * k} q${6 * k} ${-4 * k} ${10 * k} ${2 * k}" stroke="#c0902e" stroke-width="${1.6 * k}" fill="none"/>`;
  for (const [x, y, k] of [[40, 322, 1], [80, 318, .9], [120, 326, 1.05], [160, 316, .85], [196, 324, .95], [60, 350, 1.15], [140, 352, 1.2]]) s += taba(x, y, k);
  // 手前のすすき
  const susuki = (x, base, h, lean, seed) => {
    const r = rnd0(seed);
    let t = `<path d="M${x} ${base} q${lean * .3} ${-h * .6} ${lean} ${-h}" stroke="#8a8a50" stroke-width="2" fill="none"/>`;
    for (let i = 0; i < 6; i++) t += `<path d="M${f1(x + lean)} ${f1(base - h)} q${f1(4 + r() * 6)} ${f1(6 + r() * 6)} ${f1(10 + r() * 6)} ${f1(14 + r() * 8)}" stroke="#e8dcc0" stroke-width="2.2" fill="none" stroke-linecap="round" opacity=".9"/>`;
    return t;
  };
  for (const [x, h, l, sd] of [[420, 120, 14, 1], [438, 140, 18, 2], [456, 110, 10, 3], [470, 132, 16, 4], [404, 96, 8, 5]]) s += susuki(x, 360, h, l, sd);
  s += reeds(400, 480, 360, '#9a9a58', 113, 70);
  // 赤とんぼ
  for (const [x, y] of [[300, 150], [334, 168]]) s += `<path d="M${x} ${y} h14" stroke="#c8462a" stroke-width="2" stroke-linecap="round"/><path d="M${x + 4} ${y - 4} l4 4 l-4 4 M${x + 9} ${y - 4} l-2 4 l2 4" stroke="#c8d8e4" stroke-width="1.4" fill="none" opacity=".9"/>`;
  return soften(s, .1);
}

// ---------- 冬の嵐の夜 ----------
// 左手前の岸（画面の x 0〜200、下端）に人物を立てられる
function arashi(phase = 0, animated = false) {
  const angle = phase * Math.PI / 8, gust = Math.sin(angle);
  let s = `<rect width="480" height="360" fill="${grad([[0, '#0e1424'], [.5, '#1e2a44'], [1, '#2a3652']])}"/>`;
  // 雲に隠れかける月
  s += glow(372, 74, 120, '#c8d4f0', .4) + `<circle cx="372" cy="74" r="30" fill="#e6ecf8"/>`;
  if (animated) s += `<g transform="translate(${f1(gust * 16)} 0)">`;
  s += cloud(300, 96, 150, 34, '#26324c', null, 121) + cloud(330, 70, 90, 20, '#2e3a56', null, 123);
  s += `<path d="M300 92 q60 -14 150 -4" stroke="#8e9cc0" stroke-width="2.4" fill="none" opacity=".6"/>`;
  s += cloud(-20, 60, 220, 40, '#1a2236', null, 127) + cloud(120, 110, 200, 30, '#202a42', null, 131);
  s += `<path d="M10 56 q80 -16 200 -4 M150 106 q70 -10 160 -2" stroke="#4a5878" stroke-width="2" fill="none" opacity=".6"/>`;
  if (animated) s += `</g>`;
  // 遠くの砂州と、風に大きく傾く松
  s += `<path d="M230 192 Q350 182 480 186 V198 H230 Z" fill="#0c1220"/>`;
  s += pineRow([246, 268, 292, 318, 344, 370, 398, 424, 452, 474], 190, .5, ['#0c1220', '#121a2c'], 137, 18);
  // 荒れた入江：白い波頭が幾重にもとどろく
  s += `<rect y="194" width="480" height="166" fill="${grad([[0, '#22324e'], [.5, '#18263e'], [1, '#0e1828']])}"/>`;
  const rnd = rnd0(139);
  for (let row = 0; row < 7; row++) {
    if (animated) s += `<g transform="translate(${f1(Math.sin(angle + row * .6) * (8 + row * 2))} ${f1(Math.cos(angle + row * .6) * (2 + row))})">`;
    const y = 206 + row * row * 3.4 + row * 6, amp = 3 + row * 1.6, w = 26 + row * 9;
    for (let x = -20 + (row % 2) * w / 2; x < 500; x += w * (1 + rnd() * .4)) {
      s += `<path d="M${f1(x)} ${f1(y)} q${f1(w * .3)} ${f1(-amp * 1.6)} ${f1(w * .6)} ${f1(-amp * .4)} q${f1(w * .12)} ${f1(-amp * .9)} ${f1(-w * .06)} ${f1(-amp * 1.4)}" stroke="#c8d6ea" stroke-width="${f1(1.2 + row * .35)}" fill="none" stroke-linecap="round" opacity="${f1(.35 + row * .08)}"/>`;
    }
    if (animated) s += `</g>`;
  }
  // しぶき
  if (animated) s += `<g transform="translate(${f1(-gust * 12)} ${f1(-Math.cos(angle) * 6)})">`;
  for (let i = 0; i < 40; i++) s += `<circle cx="${f1(rnd() * 480)}" cy="${f1(210 + rnd() * 120)}" r="${f1(.8 + rnd() * 1.4)}" fill="#dfe8f4" opacity="${f1(.3 + rnd() * .4)}"/>`;
  if (animated) s += `</g>`;
  // 左手前の岸と、打ち寄せる波
  s += `<path d="M0 290 Q80 280 150 300 Q190 314 214 360 H0 Z" fill="${grad([[0, '#2a2e3a'], [1, '#161a24']])}"/>`;
  s += `<path d="M150 300 q30 -16 56 -4 q-10 8 -2 18 q20 -10 34 4" stroke="#dfe8f4" stroke-width="3" fill="none" stroke-linecap="round" opacity=".7"/>`;
  s += `<path d="M120 296 q24 -12 40 -2" stroke="#dfe8f4" stroke-width="2" fill="none" opacity=".5"/>`;
  // 右手前の、風に倒れる葦
  s += bentReeds(360, 480, 360, '#141a24', 149, 130, -46 - (animated ? gust * 16 : 0));
  s += bentReeds(0, 40, 360, '#141a24', 151, 80, -30 - (animated ? gust * 10 : 0));
  // 横なぐりの雨
  if (animated) {
    // A tiled rain field returns seamlessly after sixteen frames.
    for (let i = 0; i < 70; i++) {
      const x = rnd() * 256 - phase * 16, y = ((rnd() * 448 + phase * 28) % 448) - 44;
      for (let tile = 0; tile < 4; tile++) s += `<path d="M${f1(x + tile * 256)} ${f1(y)} l-16 28" stroke="#b6c8e6" stroke-width="1.2" opacity=".5"/>`;
    }
    // One subdued lightning pulse per 2.4-second loop, away from the figure.
    if (phase === 4 || phase === 5) s += `<rect width="480" height="360" fill="#d8e8ff" opacity="${phase === 4 ? .12 : .04}"/><path d="M350 46 l-24 54 20 -8 -32 60 12 -43 -20 7 z" fill="#e2edff" opacity="${phase === 4 ? .85 : .25}"/>`;
  } else {
  for (let i = 0; i < 70; i++) { const x = rnd() * 520, y = rnd() * 340; s += `<path d="M${f1(x)} ${f1(y)} l-10 18" stroke="#9aaacc" stroke-width="1" opacity=".3"/>`; }
  }
  return s;
}

// ---------- アクター ----------
const kemuri = (phase) => {
  // 下から上へ細くうねりながら広がる煙。根もと（120x160 の (60,156)）を煙出しに合わせる
  const sway = phase ? -1 : 1;
  let s = '';
  const puffs = [[60, 150, 5, .55], [62 + 3 * sway, 132, 7, .5], [58 + 7 * sway, 112, 9, .45], [60 + 10 * sway, 90, 12, .4], [64 + 6 * sway, 66, 15, .32], [70 - 2 * sway, 42, 18, .24], [76 - 8 * sway, 20, 20, .16]];
  for (const [x, y, r, a] of puffs) s += `<ellipse cx="${x}" cy="${y}" rx="${r * 1.3}" ry="${r}" fill="#efe2dc" opacity="${a}"/>`;
  s += `<path d="M60 156 q${-4 * sway} -14 ${2 * sway} -28 q${8 * sway} -16 ${2 * sway} -34 q${-6 * sway} -16 ${4 * sway} -34" stroke="#fff4ee" stroke-width="3" fill="none" stroke-linecap="round" opacity=".55"/>`;
  return s;
};
// にほ鳥（100x70、水面 y=46、中心 (50,46)）
const nio = (k) => {
  if (k === 1) return grebe(50, 46, 1.3, '#4a3a2a', '#8a4a2e') + `<ellipse cx="54" cy="52" rx="26" ry="4" fill="none" stroke="#ffffff" stroke-width="1.4" opacity=".6"/>`;
  if (k === 2) return `<path d="M36 46 q6 -26 20 -30 q6 -2 4 6 q-2 14 -10 24 z" fill="#4a3a2a"/><path d="M48 22 q6 -8 10 -4" stroke="#7a5a3a" stroke-width="3" fill="none"/>` +
    `<path d="M28 48 q10 -10 18 -2 M54 48 q8 -10 18 -2" stroke="#ffffff" stroke-width="2" fill="none" opacity=".8" stroke-linecap="round"/><circle cx="34" cy="38" r="1.6" fill="#ffffff" opacity=".8"/><circle cx="66" cy="36" r="1.4" fill="#ffffff" opacity=".8"/>`;
  return [[10, 2.5, .8], [22, 5, .55], [34, 8, .35]].map(([rx, ry, a]) => `<ellipse cx="50" cy="48" rx="${rx}" ry="${ry}" fill="none" stroke="#ffffff" stroke-width="1.6" opacity="${a}"/>`).join('');
};
// 雁の列（160x90、中心 (80,45)）。かぎ形に並んで右へ飛ぶ
const kari = (up) => {
  const geese = [[120, 30, 1.1], [100, 40, 1], [80, 50, 1], [60, 60, .95], [100, 22, .95], [80, 14, .9], [58, 8, .85]];
  return geese.map(([x, y, k]) => {
    const wy = up ? -9 * k : 7 * k;
    return `<path d="M${x - 9 * k} ${y} q${4 * k} 2 ${10 * k} 0 l${6 * k} -${2 * k} l${-4 * k} ${4 * k} q${-6 * k} 2 ${-12 * k} 0 z" fill="#2e3040"/>` +
      `<path d="M${x - 2 * k} ${y} q${-4 * k} ${wy * .6} ${-10 * k} ${wy} M${x} ${y} q${-2 * k} ${wy * .7} ${-6 * k} ${wy * 1.05}" stroke="#2e3040" stroke-width="${2.2 * k}" fill="none" stroke-linecap="round"/>`;
  }).join('');
};

const out = process.argv[2];
const write = (name, w, h, body, vb = `0 0 ${w} ${h}`) =>
  fs.writeFileSync(path.join(out, `${name}.svg`), `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${vb}"><title>${name}</title>${defs.length ? `<defs>${defs.join('')}</defs>` : ''}${body}</svg>\n`);
const backdrops = {yoake, 'ido-mizu': idoMizu, yugure, haru, natsu, aki, arashi};
for (const [n, f] of Object.entries(backdrops)) { defs = []; gid = 0; write(n, 480, 360, f()); }
defs = [];
write('kemuri-1', 120, 160, kemuri(0)); write('kemuri-2', 120, 160, kemuri(1));
for (const k of [1, 2, 3]) write(`nio-${k}`, 100, 70, nio(k));
write('kari-1', 160, 90, kari(true)); write('kari-2', 160, 90, kari(false));
for (let phase = 0; phase < 16; phase++) { defs = []; gid = 0; write(`storm-${String(phase + 1).padStart(2, '0')}`, 480, 360, arashi(phase, true)); }
console.log(`${Object.keys(backdrops).length + 23} files`);
