// 背景2枚（480x360、版4の絵柄：輪郭線なしの平面イラスト）。考証メモ 2.2（漁具：丸木舟、網と土錘）・2.4（漁撈）にもとづく。
// ryo.svg ：穏やかに凪いだ近海で、丸木舟に乗って網で漁をする男たち。
//           手前の舟（画面の中央）では舳先の男が前かがみ・中腰で網をたぐって魚を引き上げ、艫の男が櫂で舟をあやつる。
//           奥の舟では1人が網をたぐり上げ、もう1人は舟の中にしゃがんで、うつむいて網のもつれをほどく。
// hama.svg：遠浅の浜で、身をかがめて貝や海藻をとり、草で編んだかごに集める女と子どもたち。
// 人物は chars.cjs（男：里の若者と同じ描き方）と village.cjs（女・子ども）の部品で描く。
const fs = require('fs');
const path = require('path');
const {lerp, add, P, r1, MALE, FEMALE, skeleton, satoFigure, SATO} = require('./chars.cjs');
const {person, place, CHILD, C, rnd0} = require('./village.cjs');

let defs = [], gid = 0;
const grad = (stops, x2 = 0, y2 = 1) => {
  const id = `g${++gid}`;
  defs.push(`<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}">${stops.map(([o, c, a]) => `<stop offset="${o}" stop-color="${c}"${a === undefined ? '' : ` stop-opacity="${a}"`}/>`).join('')}</linearGradient>`);
  return `url(#${id})`;
};
const sky = () => `<rect width="480" height="360" fill="${grad([[0, '#b4dcf2'], [.6, '#d8eef8'], [1, '#f1f9fc']])}"/>` +
  `<path d="M60 50 q10 -10 24 -4 q12 -8 22 2 q10 0 8 8 h-56 q-6 -4 2 -6 z M330 34 q8 -8 18 -2 q10 -6 18 2 q8 0 6 6 h-46 q-4 -4 4 -6z" fill="#ffffff" opacity=".85"/>`;
const gulls = pts => pts.map(([x, y, s]) => `<path d="M${x} ${y} q${4 * s} ${-4 * s} ${8 * s} 0 q${4 * s} ${-4 * s} ${8 * s} 0" stroke="#5a6a78" stroke-width="1.8" fill="none" stroke-linecap="round"/>`).join('');
// 遠くの陸と松（凪いだ海の向こう）
function farShore(x0, x1, y) {
  let s = `<path d="M${x0} ${y} Q${(x0 + x1) / 2} ${y - 8} ${x1} ${y} V${y + 4} H${x0} Z" fill="#b9cdb6"/>`;
  const r = rnd0(x0 + 17);
  for (let x = x0 + 6; x < x1 - 4; x += 8 + r() * 10) { const h = 6 + r() * 6; s += `<path d="M${r1(x)} ${y} v${-h}" stroke="#93ad94" stroke-width="1.4"/><path d="M${r1(x - 5)} ${r1(y - h)} q5 -4 10 0 z M${r1(x - 4)} ${r1(y - h + 3)} q4 -3 8 0 z" fill="#93ad94"/>`; }
  return s;
}
// 丸木舟（大きく描く）。x, y は舟べりの中央、len は長さ。f=-1 で舳先が右
function canoe(x, y, len, f = 1) {
  const h = len * .14;
  let s = `<g transform="translate(${x} ${y}) scale(${f} 1)">`;
  s += `<path d="M${-len / 2} ${-h * .1} Q${-len * .44} ${h * .9} ${-len * .2} ${h} L${len * .32} ${h} Q${len * .48} ${h * .7} ${len / 2} ${-h * .2} Q${len * .1} ${h * .05} ${-len / 2} ${-h * .1} Z" fill="${grad([[0, '#9a6a3a'], [1, '#6a4422']])}"/>`;
  s += `<path d="M${-len / 2} ${-h * .1} Q${-len * .1} ${-h * .3} ${len / 2} ${-h * .2} Q${len * .1} ${h * .05} ${-len / 2} ${-h * .1} Z" fill="#4e3018"/>`;
  s += `<path d="M${-len * .4} ${h * .45} Q0 ${h * .62} ${len * .42} ${h * .4}" stroke="#b07a44" stroke-width="2" fill="none" opacity=".8"/>`;
  return s + `</g>`;
}
// 水面に映る舟の影と、まわりのさざ波
const reflection = (x, y, len) => `<ellipse cx="${x}" cy="${y + len * .2}" rx="${len * .5}" ry="${len * .06}" fill="#4f7d98" opacity=".25"/>` +
  `<path d="M${x - len * .6} ${y + len * .17} h${len * .25} M${x + len * .3} ${y + len * .2} h${len * .28} M${x - len * .3} ${y + len * .26} h${len * .5}" stroke="#ffffff" stroke-width="1.6" stroke-linecap="round" opacity=".6"/>`;
// 魚
const fish = (x, y, a, s = 1) => `<g transform="translate(${x} ${y}) rotate(${a}) scale(${s})"><path d="M-10 0 Q-2 -6 8 0 Q-2 6 -10 0 Z M8 0 l6 -5 l0 10 z" fill="#9fb4c0"/><circle cx="-6" cy="-1" r="1" fill="#2a2a30"/></g>`;
// 草で編んだかご
const kago = (x, y, s = 1, fill = 'shell') => {
  let g = `<g transform="translate(${x} ${y}) scale(${s})">`;
  if (fill === 'shell') g += `<path d="M-9 -9 q4 -6 9 -2 q-4 4 -9 2 z M0 -11 q5 -5 9 0 q-4 4 -9 0 z" fill="#efe2d0"/><path d="M-4 -12 q3 -4 6 0 z" fill="#d9a0a0"/>`;
  else g += `<path d="M-10 -10 q-4 -12 4 -14 q2 8 -4 14 z M-2 -11 q2 -12 10 -10 q-2 8 -10 10 z" fill="#4f7a3a"/>`;
  g += `<path d="M-15 -9 Q-14 6 -8 8 L8 8 Q14 6 15 -9 Z" fill="#c9a865"/>`;
  for (const yy of [-5, -1, 3]) g += `<path d="M-14 ${yy} Q0 ${yy + 2} 14 ${yy}" stroke="#9a7a3e" stroke-width="1.2" fill="none"/>`;
  for (const xx of [-9, -3, 3, 9]) g += `<path d="M${xx} -9 L${xx * .85} 8" stroke="#a8884a" stroke-width="1" opacity=".8"/>`;
  g += `<path d="M-16 -9 Q0 -7 16 -9" stroke="#8a6a32" stroke-width="2.4" fill="none" stroke-linecap="round"/>`;
  return g + `</g>`;
};
// 舟に乗った人：舟べりより下（脚）を切り落とし、舟の中に立っているように見せる
const inBoat = (svg, clipY) => { const id = `c${++gid}`; defs.push(`<clipPath id="${id}"><rect x="-100" y="-100" width="700" height="${clipY + 100}"/></clipPath>`); return `<g clip-path="url(#${id})">${svg}</g>`; };
// 男の着物の色をかえる（同じ顔・体つきで、着物と肌の色だけ別人にする）
const recolor = (svg, map) => Object.entries(map).reduce((t, [a, b]) => t.replaceAll(a, b), svg);
const MAN2 = {[SATO.cloth]: '#d8d2c0', [SATO.clothDark]: '#b6ae96', [SATO.hakama]: '#7d8f9e', [SATO.hakamaDark]: '#667886'};
const MAN3 = {[SATO.cloth]: '#bfa47a', [SATO.clothDark]: '#9c8258', [SATO.skin]: '#d9a070', [SATO.skinDark]: '#b98454'};

// ---------- 凪いだ近海の網漁 ----------
function ryo() {
  let s = sky();
  const H = 172;
  s += farShore(0, 170, H) + farShore(300, 400, H + 1);
  s += `<rect y="${H}" width="480" height="${360 - H}" fill="${grad([[0, '#bfe1ef'], [.35, '#a3d1e6'], [1, '#7db8d6']])}"/>`;
  s += `<path d="M20 196 h60 M140 206 h80 M300 192 h50 M380 214 h70 M40 236 h50 M250 238 h60" stroke="#ffffff" stroke-width="1.6" stroke-linecap="round" opacity=".55"/>`;
  // 遠くの舟
  s += `<path d="M398 180 q20 3 40 0 l-4 4 h-32 z" fill="#6f8796"/><path d="M412 180 v-9 M424 180 v-11" stroke="#6f8796" stroke-width="2"/><circle cx="412" cy="169" r="2" fill="#6f8796"/><circle cx="424" cy="167" r="2" fill="#6f8796"/>`;
  s += gulls([[220, 70, 1], [244, 60, .8], [300, 96, .7]]);
  // ---- 奥の舟（右寄り・小さめ）：艫の男が網をたぐり上げ、もう1人は舟の中にしゃがんで、うつむいて手元の網のもつれをほどく
  const bbx = 382, bby = 240, bblen = 140, bs = .34, bfy = bby + 40;
  s += reflection(bbx, bby, bblen);
  // 舟の上では腰を低く落とし、足を開いてふんばる（重心を低くしないと舟から落ちる）
  const haul1 = skeleton(MALE, {pelvis: [132, 256], chest: [150, 168], ankleL: [96, 334], ankleR: [150, 334], kneeL: 1, kneeR: 1, wristL: [74, 196], wristR: [86, 206], elbowL: -1, elbowR: -1, headDx: 4, headTilt: 8});
  // しゃがむ男：背を丸めて前へかがみ、首は背骨の先から前へ出して、顔を手元へ向ける（左向き）
  const untangle = skeleton(MALE, {pelvis: [130, 250], chest: [104, 180], ankleL: [92, 334], ankleR: [140, 334], kneeL: 1, kneeR: 1,
    wristL: [30, 194], wristR: [50, 200], elbowL: -1, elbowR: -1, handL: 'grip', handR: 'grip'});
  untangle.neckTop = [97, 162]; untangle.head = [94, 140]; untangle.headTilt = 34;
  let un = recolor(satoFigure(untangle, 'focus'), MAN3);
  // 手元のもつれた網のかたまり（土錘つき）
  un += `<path d="M24 196 q10 -12 24 -6 q14 4 22 -4 M26 202 q14 6 26 -2 q10 -6 20 2 M32 192 l8 14 M46 190 l-4 16 M58 192 l4 12 M22 198 q-6 14 4 30 M70 198 q8 16 0 30" stroke="#8a7a5a" stroke-width="2" fill="none"/><ellipse cx="28" cy="204" rx="4" ry="3" fill="#9a6a44"/><ellipse cx="70" cy="198" rx="4" ry="3" fill="#9a6a44"/>`;
  s += inBoat(place(un, bbx - 30, bfy, bs), bby + 2);
  s += inBoat(place(satoFigure(haul1, 'eager'), bbx + 14, bfy, bs, -1), bby + 2);
  s += canoe(bbx, bby, bblen, -1);
  // たぐる網：手から水面へ、浮きと魚
  const hh = [bbx + 14 - (74 - 120) * bs, bfy + (196 - 334) * bs];
  s += `<path d="M${r1(hh[0])} ${r1(hh[1])} Q${r1(hh[0] + 18)} ${r1(hh[1] + 2)} ${r1(hh[0] + 34)} ${r1(hh[1] + 16)} M${r1(hh[0] + 4)} ${r1(hh[1] + 3)} Q${r1(hh[0] + 22)} ${r1(hh[1] + 6)} ${r1(hh[0] + 40)} ${r1(hh[1] + 20)}" stroke="#8a7a5a" stroke-width="1.3" fill="none"/>`;
  const nx = hh[0] + 30, ny = hh[1] + 14;
  s += `<path d="M${r1(nx)} ${r1(ny)} Q${r1(nx + 14)} ${r1(ny - 4)} ${r1(nx + 30)} ${r1(ny + 2)} L${r1(nx + 28)} ${r1(ny + 14)} Q${r1(nx + 14)} ${r1(ny + 18)} ${r1(nx + 2)} ${r1(ny + 12)} Z" fill="#b8a888" opacity=".55"/>`;
  for (let i = 0; i < 4; i++) s += `<path d="M${r1(nx + 3 + i * 8)} ${r1(ny)} l-2 14" stroke="#8a7a5a" stroke-width=".8"/>`;
  s += fish(nx + 14, ny - 8, -30, .7) + `<path d="M${r1(nx + 10)} ${r1(ny - 2)} q2 -6 5 -8" stroke="#ffffff" stroke-width="1.2" fill="none" opacity=".8"/>`;
  // ---- 手前の舟（大きめ・画面の中央）：舳先の男が不安定な舟の上で前かがみ・中腰になり、網をたぐって魚を引き上げる。艫の男が櫂をこぐ（左向き）
  const at = (q, x, y, sc) => [x + (q[0] - 120) * sc, y + (q[1] - 334) * sc];
  const bx0 = 228, by0 = 302, blen = 236, fs = .5;
  s += reflection(bx0, by0, blen);
  // 中腰：足を大きく開いてひざを曲げ、腰を落としたまま上体を前へ倒す。両手は舳先の舟べりの先で網をつかむ
  const caster = skeleton(MALE, {pelvis: [130, 236], chest: [86, 172], ankleL: [88, 334], ankleR: [156, 334], kneeL: 1, kneeR: 1,
    wristL: [-24, 226], wristR: [12, 232], elbowL: -1, elbowR: -1, handL: 'grip', handR: 'grip'});
  caster.neckTop = [75, 156]; caster.head = [72, 132]; caster.headTilt = 28;
  // 艫の男は片ひざをついて腰を落とし、櫂をこぐ
  const paddler = skeleton(MALE, {pelvis: [126, 270], chest: [118, 184], ankleL: [96, 334], ankleR: [150, 334], kneeL: 1, kneeR: 1, wristL: [78, 270], wristR: [104, 210], elbowL: 1, elbowR: -1, headDx: -2, headTilt: 4});
  const cx0 = bx0 - 66, px0 = bx0 + 76, fy = 356;
  s += inBoat(place(recolor(satoFigure(paddler, 'stand'), MAN2), px0, fy, fs), by0 + 2);
  s += inBoat(place(satoFigure(caster, 'focus'), cx0, fy, fs), by0 + 2);
  s += canoe(bx0, by0, blen);
  // 櫂：上の手から下の手を通り、舟べりの外の水の中へ
  const u = at(paddler.wristR, px0, fy, fs), l = at(paddler.wristL, px0, fy, fs), tip = [l[0] + (l[0] - u[0]) * 1.2, l[1] + (l[1] - u[1]) * 1.2];
  s += `<path d="M${r1(u[0])} ${r1(u[1])} L${r1(tip[0])} ${r1(tip[1])}" stroke="#b07a44" stroke-width="3.6" stroke-linecap="round"/><path d="M${r1(tip[0] + 2)} ${r1(tip[1] - 16)} q-10 14 -6 26 q8 -2 12 -22 z" fill="#b07a44"/>`;
  s += `<path d="M${r1(tip[0] - 18)} ${r1(tip[1] + 6)} q14 -5 28 0" stroke="#ffffff" stroke-width="1.6" fill="none" opacity=".8"/>`;
  // たぐり上げる網：両手から舳先の外へ垂れ、水面で魚の入った網のふくらみになる。ふちに土錘
  const h1 = at(caster.wristL, cx0, fy, fs), h2 = at(caster.wristR, cx0, fy, fs);
  const w = [h1[0] - 26, by0 + 20];
  s += `<path d="M${r1(w[0] - 22)} ${r1(w[1] + 2)} Q${r1(w[0])} ${r1(w[1] + 26)} ${r1(w[0] + 26)} ${r1(w[1] + 4)} Q${r1(w[0] + 10)} ${r1(w[1] - 4)} ${r1(w[0] - 22)} ${r1(w[1] + 2)} Z" fill="#c9bea4" opacity=".75"/>`;
  for (let i = 0; i < 6; i++) { const t = i / 5; s += `<path d="M${r1(w[0] - 22 + 48 * t)} ${r1(w[1] + 2 - 2 * t)} Q${r1(w[0] - 6 + 16 * t)} ${r1(w[1] + 14)} ${r1(w[0] + 2)} ${r1(w[1] + 22)}" stroke="#8a7a5a" stroke-width=".8" fill="none"/>`; }
  for (const k of [.35, .7]) s += `<path d="M${r1(w[0] - 22 + 6 * k)} ${r1(w[1] + 2 + 10 * k)} Q${r1(w[0])} ${r1(w[1] + 4 + 22 * k)} ${r1(w[0] + 26 - 8 * k)} ${r1(w[1] + 4 + 10 * k)}" stroke="#8a7a5a" stroke-width=".8" fill="none"/>`;
  for (let i = 0; i < 6; i++) s += `<ellipse cx="${r1(w[0] - 20 + i * 9)}" cy="${r1(w[1] + 2 - (i % 2))}" rx="2.4" ry="1.7" fill="#9a6a44"/>`;
  s += fish(w[0] - 6, w[1] + 8, 20, .8) + fish(w[0] + 10, w[1] + 6, -15, .75) + fish(w[0] + 2, w[1] - 6, -40, .7);
  for (const h of [h1, h2]) s += `<path d="M${r1(h[0])} ${r1(h[1])} Q${r1((h[0] + w[0]) / 2 - 4)} ${r1((h[1] + w[1]) / 2 + 2)} ${r1(w[0] + (h === h1 ? -16 : 18))} ${r1(w[1] + 2)}" stroke="#8a7a5a" stroke-width="1.4" fill="none"/>`;
  s += `<path d="M${r1(w[0] - 34)} ${r1(w[1] + 10)} q12 -5 24 0 M${r1(w[0] + 20)} ${r1(w[1] + 12)} q10 -4 20 0" stroke="#ffffff" stroke-width="1.6" fill="none" opacity=".8"/>`;
  return s;
}

// ---------- 遠浅の浜の貝・海藻とり ----------
function hama() {
  let s = sky();
  const H = 176;
  s += farShore(330, 480, H);
  s += `<rect y="${H}" width="480" height="20" fill="${grad([[0, '#a9d6ec'], [1, '#9acfe6']])}"/>`;
  s += `<path d="M20 184 h40 M120 188 h60 M250 182 h40" stroke="#ffffff" stroke-width="1.4" stroke-linecap="round" opacity=".6"/>`;
  // 遠浅の干潟：ぬれた砂と、空を映す水たまり、砂の筋
  s += `<path d="M0 194 Q120 190 240 194 Q360 198 480 192 V360 H0 Z" fill="${grad([[0, '#d9cba4'], [.4, '#d6c49a'], [1, '#c9b386']])}"/>`;
  for (const [x, y, rx, ry] of [[70, 214, 60, 7], [250, 208, 80, 6], [420, 222, 50, 6], [150, 250, 50, 6], [360, 262, 70, 7]]) s += `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="#c8e4ef" opacity=".8"/><path d="M${x - rx * .5} ${y - 1} h${rx * .6}" stroke="#ffffff" stroke-width="1.4" opacity=".7"/>`;
  { const r = rnd0(9); for (let i = 0; i < 26; i++) { const x = r() * 480, y = 210 + r() * 150; s += `<path d="M${r1(x)} ${r1(y)} q10 -3 20 0" stroke="#b9a274" stroke-width="1.4" fill="none" opacity=".6"/>`; } }
  // 貝と海藻
  { const r = rnd0(21); for (let i = 0; i < 22; i++) { const x = r() * 480, y = 230 + r() * 125, k = r();
    s += k > .6 ? `<path d="M${r1(x)} ${r1(y)} q3 -4 6 0 q-3 2 -6 0 z" fill="${k > .8 ? '#e6c2c0' : '#f1e8dc'}"/>` : k > .3 ? `<path d="M${r1(x)} ${r1(y)} q-3 -8 1 -12 M${r1(x + 3)} ${r1(y)} q2 -7 6 -9" stroke="#4f7a3a" stroke-width="2" fill="none" stroke-linecap="round"/>` : `<ellipse cx="${r1(x)}" cy="${r1(y)}" rx="2.4" ry="1.4" fill="#8a7a62"/>`; } }
  s += gulls([[180, 70, 1], [200, 62, .8]]);
  // 女1：深く身をかがめて貝を拾う（右向き）
  const W1 = skeleton(FEMALE, {pelvis: [112, 190], chest: [160, 160], shoulderTilt: .35, ankleL: [100, 334], ankleR: [128, 332], kneeL: -1, kneeR: -1,
    wristL: [186, 318], wristR: [170, 312], elbowL: 1, elbowR: 1});
  W1.neckTop = [174, 150]; W1.head = [194, 156]; W1.headTilt = 50;
  s += kago(150, 322, 1, 'shell');
  s += place(person(W1, {colors: C.indigo, hair: 'tied', mood: 'smile', skirt: 'long', handL: 'grip', handR: 'open'}), 86, 324, .5);
  // 子1：拾った貝を高くかかげて見せる（右向き）
  const K1 = skeleton(CHILD, {pelvis: [118, 252], chest: [120, 204], ankleL: [108, 334], ankleR: [130, 334], kneeL: -1, kneeR: -1,
    wristL: [150, 150], wristR: [104, 270], elbowL: 1, elbowR: -1, headDx: 2, headTilt: -8});
  let k1 = person(K1, {child: true, colors: C.childA, hair: 'bob', mood: 'laugh', handL: 'grip'});
  k1 += `<path d="M146 142 q6 -8 12 0 q-6 4 -12 0 z" fill="#e6c2c0"/>`;
  s += place(k1, 196, 316, .56);
  // 子2：しゃがんで砂をほり、貝をさがす（左向き）
  const K2 = skeleton(CHILD, {pelvis: [116, 294], chest: [128, 244], ankleL: [110, 334], ankleR: [126, 334], kneeL: -1, kneeR: -1,
    wristL: [162, 318], wristR: [150, 310], elbowL: 1, elbowR: 1, headDx: 4, headTilt: 16});
  let k2 = person(K2, {child: true, colors: C.childB, hair: 'tufts', mood: 'smile', handL: 'grip', handR: 'open'});
  k2 += `<path d="M162 318 L176 336" stroke="#8a6a3a" stroke-width="2.4" stroke-linecap="round"/>`;
  s += kago(262, 336, .8, 'shell');
  s += place(k2, 300, 346, .5, -1);
  // 女2：しゃがんで海藻をつみとる（左向き）
  const W2 = skeleton(FEMALE, {pelvis: [116, 262], chest: [138, 174], shoulderTilt: .12, ankleL: [118, 334], ankleR: [140, 334], kneeL: -1, kneeR: -1,
    wristL: [172, 318], wristR: [160, 308], elbowL: 1, elbowR: 1, headDx: 8, headTilt: 22});
  s += kago(330, 312, .9, 'weed');
  s += place(person(W2, {colors: C.brown, hair: 'bun', mood: 'talk', skirt: 'long', handL: 'grip', handR: 'grip'}), 372, 312, .48, -1);
  // 女3：かごを腰にかかえて立ち、子どもたちに声をかける（左向き）
  const W3 = skeleton(FEMALE, {pelvis: [118, 180], hipTilt: 4, chest: [122, 88], ankleL: [106, 334], ankleR: [134, 332], kneeL: -1, kneeR: -1,
    wristL: [108, 176], wristR: [150, 110], elbowL: 1, elbowR: 1, headDx: 2, headTilt: -4});
  let w3 = person(W3, {colors: C.ochre, hair: 'tied', mood: 'laugh', skirt: 'long', handR: 'open', handL: 'grip'});
  w3 += kago(106, 190, 1.2, 'weed');
  s += place(w3, 440, 300, .44, -1);
  return s;
}

const out = process.argv[2];
for (const [n, f] of Object.entries({ryo, hama})) {
  defs = []; gid = 0;
  const body = f();
  fs.writeFileSync(path.join(out, `${n}.svg`), `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="360" viewBox="0 0 480 360"><title>${n}</title><defs>${defs.join('')}</defs>${body}</svg>\n`);
}
console.log('2 files');
