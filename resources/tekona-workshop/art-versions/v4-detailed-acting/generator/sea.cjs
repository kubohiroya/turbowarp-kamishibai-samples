// 背景2枚（480x360、版4の絵柄：輪郭線なしの平面イラスト）。考証メモ 2.2（漁具：丸木舟、網と土錘）・2.4（漁撈）にもとづく。
// ryo.svg ：穏やかに凪いだ近海で、丸木舟に乗って網で漁をする男たち。
//           手前の舟では舳先の男が網を打ち、艫の男が櫂で舟をあやつる。奥の舟では2人が網をたぐり上げ、魚が跳ねる。
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
  // ---- 奥の舟：2人で網をたぐり上げる（右向き）
  s += reflection(352, 254, 170);
  // 舟の上では腰を低く落とし、足を開いてふんばる（重心を低くしないと舟から落ちる）
  const haul1 = skeleton(MALE, {pelvis: [132, 256], chest: [150, 168], ankleL: [96, 334], ankleR: [150, 334], kneeL: 1, kneeR: 1, wristL: [74, 196], wristR: [86, 206], elbowL: -1, elbowR: -1, headDx: 4, headTilt: 8});
  // 左の男：相方と背中合わせに体を左へ向け、身をかがめて舟の中（とれた魚）を見下ろす
  const haul2 = skeleton(MALE, {pelvis: [128, 262], chest: [102, 192], ankleL: [96, 334], ankleR: [150, 334], kneeL: 1, kneeR: 1, wristL: [70, 258], wristR: [86, 266], elbowL: 1, elbowR: -1, headDx: -6, headTilt: 28});
  s += inBoat(place(recolor(satoFigure(haul2, 'stand'), MAN3), 312, 300, .4), 256);
  s += inBoat(place(satoFigure(haul1, 'eager'), 366, 300, .4, -1), 256);
  s += canoe(352, 254, 170, -1);
  // たぐる網：手から水面へ、浮きと魚
  s += `<path d="M384 246 Q414 248 436 262 M394 250 Q424 254 446 266" stroke="#8a7a5a" stroke-width="1.4" fill="none"/>`;
  s += `<path d="M430 258 Q452 252 474 262 L470 276 Q450 280 432 272 Z" fill="#b8a888" opacity=".55"/>`;
  for (let i = 0; i < 5; i++) s += `<path d="M${434 + i * 9} 258 l-2 18" stroke="#8a7a5a" stroke-width=".8"/>`;
  for (const [x, y] of [[440, 262], [458, 258], [472, 262]]) s += `<ellipse cx="${x}" cy="${y}" rx="3" ry="2" fill="#d8c49a"/>`;
  s += fish(448, 248, -30, .9) + fish(462, 240, 20, .7);
  s += `<path d="M444 254 q2 -8 6 -10 M458 250 q4 -6 8 -6" stroke="#ffffff" stroke-width="1.4" fill="none" opacity=".8"/>`;
  // ---- 手前の舟（大きめ・左寄り）：舳先の男が投網を空へ打ち、艫の男が櫂をこぐ（左向き）
  const at = (q, x, y, sc) => [x + (q[0] - 120) * sc, y + (q[1] - 334) * sc];
  const bx0 = 130, by0 = 302, blen = 250, fs = .5;
  s += reflection(bx0, by0, blen);
  const caster = skeleton(MALE, {pelvis: [126, 250], chest: [108, 164], ankleL: [92, 334], ankleR: [150, 334], kneeL: 1, kneeR: 1, wristL: [-16, 106], wristR: [0, 122], elbowL: -1, elbowR: -1, headDx: -4, headTilt: -12});
  // 艫の男は片ひざをついて腰を落とし、櫂をこぐ
  const paddler = skeleton(MALE, {pelvis: [126, 270], chest: [118, 184], ankleL: [96, 334], ankleR: [150, 334], kneeL: 1, kneeR: 1, wristL: [78, 270], wristR: [104, 210], elbowL: 1, elbowR: -1, headDx: -2, headTilt: 4});
  const cx0 = 92, px0 = 214, fy = 356;
  s += inBoat(place(recolor(satoFigure(paddler, 'stand'), MAN2), px0, fy, fs), by0 + 2);
  s += inBoat(place(satoFigure(caster, 'eager'), cx0, fy, fs), by0 + 2);
  s += canoe(bx0, by0, blen);
  // 櫂：上の手から下の手を通り、舟べりの外の水の中へ
  const u = at(paddler.wristR, px0, fy, fs), l = at(paddler.wristL, px0, fy, fs), tip = [l[0] + (l[0] - u[0]) * 1.2, l[1] + (l[1] - u[1]) * 1.2];
  s += `<path d="M${r1(u[0])} ${r1(u[1])} L${r1(tip[0])} ${r1(tip[1])}" stroke="#b07a44" stroke-width="3.6" stroke-linecap="round"/><path d="M${r1(tip[0] + 2)} ${r1(tip[1] - 16)} q-10 14 -6 26 q8 -2 12 -22 z" fill="#b07a44"/>`;
  s += `<path d="M${r1(tip[0] - 18)} ${r1(tip[1] + 6)} q14 -5 28 0" stroke="#ffffff" stroke-width="1.6" fill="none" opacity=".8"/>`;
  // 投網：男の手から前の空へ放たれ、丸く平らに大きく広がって水面へ落ちていく。ふちに土錘、真ん中の手綱は男の手へ
  const h = at(caster.wristL, cx0, fy, fs);
  const nc = [70, 150], nrx = 66, nry = 20, tilt = -10;
  s += `<path d="M${r1(h[0])} ${r1(h[1])} Q${r1((h[0] + nc[0]) / 2 + 14)} ${r1((h[1] + nc[1]) / 2 + 6)} ${nc[0]} ${nc[1]}" stroke="#8a7a5a" stroke-width="1.6" fill="none"/>`;
  let net = `<ellipse cx="0" cy="0" rx="${nrx}" ry="${nry}" fill="#c9bea4" opacity=".4"/>`;
  for (let i = 0; i < 16; i++) { const a = Math.PI * 2 * i / 16; net += `<path d="M0 0 L${r1(nrx * Math.cos(a))} ${r1(nry * Math.sin(a))}" stroke="#8a7a5a" stroke-width=".8"/>`; }
  for (const k of [.33, .66]) net += `<ellipse cx="0" cy="0" rx="${r1(nrx * k)}" ry="${r1(nry * k)}" fill="none" stroke="#8a7a5a" stroke-width=".8"/>`;
  net += `<ellipse cx="0" cy="0" rx="${nrx}" ry="${nry}" fill="none" stroke="#8a7a5a" stroke-width="1.2"/>`;
  for (let i = 0; i < 20; i++) { const a = Math.PI * 2 * i / 20; net += `<ellipse cx="${r1(nrx * Math.cos(a))}" cy="${r1(nry * Math.sin(a))}" rx="2.4" ry="1.7" fill="#9a6a44"/>`; }
  s += `<g transform="translate(${nc[0]} ${nc[1]}) rotate(${tilt})">${net}</g>`;
  // 投げた勢いの線
  s += `<path d="M${r1(h[0] + 18)} ${r1(h[1] - 22)} q-16 -18 -26 -36 M${r1(h[0] + 30)} ${r1(h[1] - 14)} q-16 -22 -24 -44" stroke="#ffffff" stroke-width="2" fill="none" stroke-linecap="round" opacity=".85"/>`;
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
