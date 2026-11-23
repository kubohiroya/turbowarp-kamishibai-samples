// 背景3枚（480x360、版4の絵柄：輪郭線なしの平面イラスト）。
// uma.svg   ：従者が手綱を引く馬に乗った地方役人が、水辺の継橋の上を進む。中景に浜で働く女たち、遠景の丘に建設中の国府。
// kokuga.svg：建設中の建物の柱のたもとで、木簡を広げて工事の進み具合を淡々と話し合う2人の役人と大工の棟梁（画面の中心を外す）。
// kame.svg  ：自然の点景。水辺の石の上で甲羅干しをする親亀と小亀（画面の中央を外す）。
const fs = require('fs');
const path = require('path');
const {lerp, add, P, r1, MALE, skeleton, satoFigure, officialFigure, KOKUFU, SATO} = require('./chars.cjs');
const {person, place, C, rnd0} = require('./village.cjs');

let defs = [], gid = 0;
const grad = (stops, x2 = 0, y2 = 1) => {
  const id = `g${++gid}`;
  defs.push(`<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}">${stops.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join('')}</linearGradient>`);
  return `url(#${id})`;
};
const haze = (svg, t, to = [0xdc, 0xe9, 0xee]) => svg.replace(/#([0-9a-f]{6})/gi, (_, h) =>
  '#' + [0, 2, 4].map(i => { const v = parseInt(h.slice(i, i + 2), 16); return Math.round(v + (to[i / 2] - v) * t).toString(16).padStart(2, '0'); }).join(''));
const sky = () => `<rect width="480" height="360" fill="${grad([[0, '#b4dcf2'], [.6, '#d8eef8'], [1, '#f1f9fc']])}"/>` +
  `<path d="M60 46 q10 -10 24 -4 q12 -8 22 2 q10 0 8 8 h-56 q-6 -4 2 -6 z M340 30 q8 -8 18 -2 q10 -6 18 2 q8 0 6 6 h-46 q-4 -4 4 -6z" fill="#ffffff" opacity=".85"/>`;
const recolor = (svg, map) => Object.entries(map).reduce((t, [a, b]) => t.replaceAll(a, b), svg);
const reeds = (x0, x1, base, color, seed, h, light) => {
  const r = rnd0(seed); let s = '';
  for (let x = x0; x < x1; x += 4 + r() * 6) { const hh = h * (.55 + r() * .6), lean = (r() - .5) * 22;
    s += `<path d="M${r1(x)} ${base} q${r1(lean / 3)} ${r1(-hh / 2)} ${r1(lean)} ${r1(-hh)}" stroke="${r() > .5 ? light : color}" stroke-width="${r1(1.6 + r() * 1.4)}" fill="none" stroke-linecap="round"/>`;
    if (r() > .6) s += `<path d="M${r1(x + lean)} ${r1(base - hh)} q2 8 0 16" stroke="${light}" stroke-width="4" fill="none" stroke-linecap="round" opacity=".85"/>`; }
  return s;
};

// ---- 建設中の官衙の建物（遠景用）：丹塗りの柱、梁、むき出しの垂木、丸太の足場、小さな労務者
function hall(x, y, w, h, {roof = .5} = {}) {
  let s = `<rect x="${x - 6}" y="${y}" width="${w + 12}" height="5" fill="#c9bfa8"/>`;
  for (let px = x; px <= x + w; px += w / 6) s += `<rect x="${r1(px - 2)}" y="${y - h}" width="4" height="${h}" fill="#b8553a"/>`;
  s += `<rect x="${x - 2}" y="${y - h - 4}" width="${w + 4}" height="4" fill="#9a4630"/>`;
  const ey = y - h - 4, ry = ey - h * .7;
  s += `<path d="M${x - 14} ${ey} L${x + w + 14} ${ey} L${x + w - w * .18} ${ry} L${x + w * .18} ${ry} Z" fill="#8a6a44"/>`;
  s += `<path d="M${x - 14} ${ey} L${r1(x + w * roof)} ${ey} L${r1(x + w * roof - 4)} ${ry} L${x + w * .18} ${ry} Z" fill="#5f6569"/>`;
  for (let i = 0; i < 10; i++) { const t = i / 9; s += `<path d="M${r1(x + w * roof + (w + 14 - w * roof) * t)} ${ey} L${r1(x + w * roof + (w * .82 - w * roof) * t)} ${ry}" stroke="#6a4c2c" stroke-width="1"/>`; }
  for (const px of [x + w + 8, x + w + 20]) s += `<path d="M${px} ${y + 4} V${ry - 6}" stroke="#9a7444" stroke-width="1.6"/>`;
  for (const py of [y - h * .5, ey, ry]) s += `<path d="M${x + w - 8} ${py} H${x + w + 22}" stroke="#9a7444" stroke-width="1.3"/>`;
  return s;
}
const tinyWorker = (x, y, c = '#d8c49a') => `<path d="M${x} ${y} v-5 M${x} ${y - 5} l-2 5 M${x} ${y - 5} l2 5" stroke="#c99a74" stroke-width="1.2"/><rect x="${x - 1.6}" y="${y - 10}" width="3.2" height="5" fill="${c}"/><circle cx="${x}" cy="${y - 11.6}" r="1.6" fill="#c99a74"/>`;

// ---- 馬（左向き・歩く）。原点はひづめの接地点の中ほど。在来の小柄な馬で、鞍・障泥（泥よけ）・鐙・手綱をつける
function horse() {
  const c = '#8f5d36', cd = '#6e4426', mane = '#2a1d16', hoof = '#3a2a20';
  let s = '';
  const leg = (pts, w, col) => `<path d="M${pts.map(P).join(' L')}" stroke="${col}" stroke-width="${w}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<path d="M${P(add(pts[pts.length - 1], [-5, 0]))} h9 v5 h-10 z" fill="${hoof}"/>`;
  // 奥の脚（暗い色）
  s += leg([[-30, -62], [-34, -34], [-26, -14], [-30, -4]], 9, cd) + leg([[30, -64], [22, -34], [28, -4]], 10, cd);
  // 尾
  s += `<path d="M52 -88 Q72 -70 62 -26 Q58 -40 50 -60 Z" fill="${mane}"/>`;
  // 胴と首・頭
  s += `<ellipse cx="0" cy="-80" rx="54" ry="25" fill="${c}"/><path d="M-20 -58 Q0 -52 30 -58 Q10 -62 -20 -58 Z" fill="${cd}" opacity=".5"/>`;
  s += `<path d="M-44 -96 Q-54 -122 -60 -136 L-48 -142 Q-34 -118 -24 -96 Z" fill="${c}"/>`;
  s += `<path d="M-60 -136 Q-66 -146 -60 -150 Q-72 -146 -92 -114 Q-96 -106 -88 -104 Q-80 -106 -70 -116 Q-58 -128 -48 -142 Z" fill="${c}"/>`;
  s += `<path d="M-54 -150 l-2 -10 l6 8 z" fill="${cd}"/><circle cx="-68" cy="-130" r="2" fill="#1a1410"/><circle cx="-88" cy="-108" r="1.6" fill="#2a1d16"/>`;
  s += `<path d="M-48 -142 Q-36 -120 -22 -100 L-30 -98 Q-42 -118 -54 -140 Z" fill="${mane}"/><path d="M-58 -150 q-6 4 -8 10" stroke="${mane}" stroke-width="4" stroke-linecap="round"/>`;
  // 手前の脚
  s += leg([[-38, -64], [-38, -34], [-36, -4]], 10, c) + leg([[36, -66], [42, -36], [36, -4]], 11, c);
  // 馬具：おもがい（頭の革ひも）、鞍、障泥、鐙
  s += `<path d="M-60 -146 L-72 -120 L-86 -108 M-62 -132 L-80 -116" stroke="#4a2a1a" stroke-width="2" fill="none"/>`;
  s += `<path d="M-26 -60 Q-10 -56 16 -60 L18 -96 Q-4 -100 -26 -96 Z" fill="#7a2e28"/><path d="M-26 -60 Q-10 -56 16 -60" stroke="#d8b24a" stroke-width="2" fill="none"/>`;
  s += `<path d="M-30 -100 Q-6 -112 22 -100 L20 -94 Q-6 -104 -28 -94 Z" fill="#4a2a1a"/>`;
  s += `<path d="M-6 -96 L-8 -60" stroke="#4a2a1a" stroke-width="1.6"/><path d="M-14 -60 q6 -6 12 0 z" fill="#5a5a5a"/>`;
  return s;
}

// ---------- 1. 継橋を馬で渡る地方役人 ----------
function uma() {
  let s = sky();
  // 遠景：丘の上の建設中の国府と、遠くの入江
  let far = `<rect x="0" y="176" width="480" height="30" fill="#a9d6ec"/>`;
  far += `<path d="M0 150 Q80 140 170 146 Q240 152 280 176 L280 190 H0 Z" fill="${grad([[0, '#9cc583'], [1, '#86b46c']])}"/>`;
  far += hall(40, 150, 90, 14, {roof: .6}) + hall(150, 152, 70, 12, {roof: .3});
  for (const [x, y] of [[132, 128], [118, 120], [86, 148], [236, 152], [60, 148]]) far += tinyWorker(x, y);
  s += haze(far, .3);
  // 中景：浜と、身をかがめて貝や海藻をとる女たち
  let mid = `<path d="M0 206 Q120 200 240 204 Q360 208 480 202 V236 Q360 240 240 236 Q120 232 0 238 Z" fill="${grad([[0, '#e6d6a8'], [1, '#d6c290']])}"/>`;
  const bend = skeleton(require('./chars.cjs').FEMALE, {pelvis: [112, 190], chest: [160, 160], shoulderTilt: .35, ankleL: [100, 334], ankleR: [128, 332], kneeL: -1, kneeR: -1, wristL: [186, 318], wristR: [170, 312], elbowL: 1, elbowR: 1});
  bend.neckTop = [174, 150]; bend.head = [194, 156]; bend.headTilt = 50;
  const stand = skeleton(require('./chars.cjs').FEMALE, {pelvis: [118, 180], chest: [120, 88], ankleL: [108, 334], ankleR: [132, 334], kneeL: -1, kneeR: -1, wristL: [110, 180], wristR: [134, 190], elbowL: 1, elbowR: -1});
  mid += place(person(bend, {colors: C.indigo, hair: 'tied', mood: 'smile', skirt: 'long'}), 70, 232, .18);
  mid += place(person(bend, {colors: C.brown, hair: 'bun', mood: 'smile', skirt: 'long'}), 128, 230, .18, -1);
  mid += place(person(stand, {colors: C.ochre, hair: 'tied', mood: 'talk', skirt: 'long'}), 412, 230, .18, -1);
  mid += `<path d="M150 228 q4 -3 10 -1 v4 h-10 z M96 230 q4 -3 10 -1 v4 h-10 z" fill="#c9a865"/>`;
  s += haze(mid, .12);
  // 手前の入江の水
  s += `<path d="M0 238 Q120 232 240 236 Q360 240 480 234 V360 H0 Z" fill="${grad([[0, '#9ccfe5'], [1, '#6fb0d2']])}"/>`;
  s += `<path d="M40 252 h40 M150 260 h50 M330 250 h44 M410 262 h40" stroke="#ffffff" stroke-width="1.6" stroke-linecap="round" opacity=".55"/>`;
  // 継橋：水面すれすれの低い板橋。板を杭の上でつなぐ
  const deck = 298;
  for (const x of [20, 80, 140, 200, 260, 320, 380, 440]) s += `<rect x="${x - 3}" y="${deck + 6}" width="6" height="16" fill="#5a3a20"/><path d="M${x - 8} ${deck + 22} q8 3 16 0" stroke="#ffffff" stroke-width="1.4" fill="none" opacity=".7"/>`;
  s += `<rect x="-10" y="${deck}" width="252" height="8" fill="${grad([[0, '#c4884e'], [1, '#8a5a30']])}"/><rect x="236" y="${deck + 1}" width="260" height="8" fill="${grad([[0, '#c88e54'], [1, '#8f5f34']])}"/>`;
  s += `<path d="M-10 ${deck} H242 M236 ${deck + 1} H496" stroke="#f0c890" stroke-width="1.2"/>`;
  for (let x = -4; x < 490; x += 14) s += `<path d="M${x} ${deck + 1} v6" stroke="#7a4a24" stroke-width="1" opacity=".6"/>`;
  s += `<path d="M0 ${deck + 26} h480" stroke="#2a5a7a" stroke-width="6" opacity=".12"/>`;
  // 馬と、馬に乗った地方役人（国府の役人の装い。左向き）
  const hx = 336, hy = deck + 2, hs = 1.08;
  s += `<g transform="translate(${hx} ${hy}) scale(${hs})">${horse()}</g>`;
  const rider = skeleton(MALE, {pelvis: [122, 250], chest: [118, 164], ankleL: [126, 334], ankleR: [134, 330], kneeL: 1, kneeR: 1,
    wristL: [80, 232], wristR: [92, 238], elbowL: 1, elbowR: -1, handL: 'grip', handR: 'grip', headDx: -2, headTilt: 4});
  const rx = hx - 6 * hs - 1, ry = hy - 100 * hs + (334 - 250) * .42;
  s += place(officialFigure(rider, KOKUFU, 'serious'), rx, ry, .42);
  // 鞍の上に乗せた体を、障泥で手前から少し隠す
  s += `<g transform="translate(${hx} ${hy}) scale(${hs})"><path d="M-26 -60 Q-10 -56 16 -60 L16 -84 Q-6 -86 -26 -84 Z" fill="#7a2e28"/><path d="M-26 -60 Q-10 -56 16 -60" stroke="#d8b24a" stroke-width="2" fill="none"/></g>`;
  // 手綱：馬のはみから役人の手へ、もう1本は従者の手へ
  const bit = [hx - 86 * hs, hy - 110 * hs];
  s += `<path d="M${P(bit)} Q${r1(bit[0] + 30)} ${r1(bit[1] + 20)} ${r1(rx + (80 - 120) * .42)} ${r1(ry + (232 - 334) * .42)}" stroke="#4a2a1a" stroke-width="1.4" fill="none"/>`;
  // 従者：馬の前を歩き、後ろ手に手綱を引く（左向き）
  const groom = skeleton(MALE, {pelvis: [124, 180], chest: [114, 92], ankleL: [98, 334], ankleR: [148, 326], kneeL: 1, kneeR: 1, liftR: 8,
    wristL: [100, 190], wristR: [176, 168], elbowL: 1, elbowR: 1, headDx: -2, headTilt: 0});
  const gx = 196, gy = deck + 2, gs = .42;
  s += place(recolor(satoFigure(groom, 'stand'), {[SATO.cloth]: '#d8d2c0', [SATO.clothDark]: '#b6ae96'}), gx, gy, gs);
  const gh = [gx + (176 - 120) * gs, gy + (168 - 334) * gs];
  s += `<path d="M${P(bit)} Q${r1((bit[0] + gh[0]) / 2)} ${r1((bit[1] + gh[1]) / 2 + 14)} ${P(gh)}" stroke="#4a2a1a" stroke-width="1.6" fill="none"/>`;
  s += reeds(0, 40, 360, '#46703a', 3, 70, '#86b858') + reeds(446, 480, 360, '#4f7a3a', 9, 74, '#8cbf5c');
  return s;
}

// ---------- 2. 柱のたもとで木簡を広げて話し合う役人と棟梁 ----------
function kokuga() {
  let s = `<rect width="480" height="360" fill="${grad([[0, '#c4e2f2'], [1, '#eef7fb']])}"/>`;
  // 奥：組みかけの軸組と足場、遠くの労務者
  let far = '';
  for (const x of [170, 250, 330, 410]) far += `<rect x="${x - 6}" y="70" width="12" height="190" fill="#b8553a"/><rect x="${x - 6}" y="70" width="4" height="190" fill="#d07858" opacity=".6"/>`;
  far += `<rect x="150" y="70" width="290" height="12" fill="#9a4630"/><rect x="150" y="150" width="290" height="6" fill="#9a4630" opacity=".8"/>`;
  for (const x of [200, 290, 380, 460]) far += `<path d="M${x} 262 V30" stroke="#9a7444" stroke-width="3"/>`;
  for (const y of [60, 120, 190]) far += `<path d="M190 ${y} H470" stroke="#9a7444" stroke-width="2.4"/>`;
  for (const [x, y] of [[230, 60], [320, 60], [420, 120], [270, 190]]) far += tinyWorker(x, y, '#c9b184').replace(/(\d+(\.\d+)?)/g, m => m);
  s += haze(far, .38);
  // 地面（つき固めた土）と、積んだ材木
  s += `<path d="M0 262 H480 V360 H0 Z" fill="${grad([[0, '#dcc89a'], [1, '#c9b07c']])}"/>`;
  s += `<path d="M0 262 H480" stroke="#c4a670" stroke-width="2"/>`;
  for (let i = 0; i < 3; i++) s += `<rect x="${336 + i * 4}" y="${252 - i * 9}" width="140" height="9" rx="4.5" fill="${i % 2 ? '#a0703c' : '#b07c46'}"/>`;
  // 手前の左：太い丹塗りの柱と、その下の礎石（画面の左に寄せ、上は画面の外へ）
  s += `<path d="M18 300 Q20 284 70 282 Q122 284 124 300 Q120 316 70 318 Q22 316 18 300 Z" fill="#9a9488"/><path d="M28 296 Q70 286 114 296" stroke="#b9b3a6" stroke-width="3" fill="none"/>`;
  s += `<rect x="42" y="-10" width="56" height="300" fill="#b8553a"/><rect x="42" y="-10" width="16" height="300" fill="#d07858" opacity=".6"/><rect x="86" y="-10" width="12" height="300" fill="#8a3e2a" opacity=".5"/>`;
  s += `<path d="M42 200 h56 M42 120 h56" stroke="#8a3e2a" stroke-width="1.4" opacity=".5"/>`;
  // 人物：画面の中心より右に寄せた3人
  const M = (svg, x, y, sc, f = 1) => place(svg, x, y, sc, f);
  // 棟梁：物差しを立て、柱を指して説明する（右向き）
  const boss = skeleton(MALE, {pelvis: [122, 180], chest: [124, 92], ankleL: [104, 334], ankleR: [142, 334], kneeL: 1, kneeR: 1,
    wristL: [70, 120], wristR: [150, 196], elbowL: -1, elbowR: -1, headDx: -2, headTilt: -4});
  let b = recolor(satoFigure(boss, 'stand'), {[SATO.cloth]: '#b9a07a', [SATO.clothDark]: '#957c56', [SATO.skin]: '#d39a6a', [SATO.skinDark]: '#b07a4a'});
  b += `<path d="M152 120 L150 330" stroke="#c9a46a" stroke-width="5" stroke-linecap="round"/><path d="M146 140 h8 M146 170 h8 M146 200 h8 M146 230 h8 M146 260 h8 M146 290 h8" stroke="#7a5a34" stroke-width="1.2"/>`;
  s += M(b, 256, 334, .6, -1);
  // 役人1：木簡の束を手のひらの上に広げて読み上げる（左向き）
  const off1 = skeleton(MALE, {pelvis: [122, 180], chest: [120, 90], ankleL: [104, 334], ankleR: [138, 334], kneeL: 1, kneeR: 1,
    wristL: [86, 170], wristR: [100, 176], elbowL: 1, elbowR: -1, handL: 'open', handR: 'grip', headDx: -2, headTilt: 12});
  let o1 = officialFigure(off1, KOKUFU, 'stand');
  // 木簡：墨で書いた細長い木の札を何枚か、手のひらの上に少しずらして並べて広げる
  o1 += `<g transform="translate(92 170) rotate(-8)">` + [[-15, -2, -3], [-5, 0, 2], [5, -3, -1], [15, 1, 3]].map(([dx, dy, a]) => `<g transform="translate(${dx} ${dy}) rotate(${a})"><rect x="-3.4" y="-40" width="6.8" height="40" rx="1" fill="#e8d9b0"/><rect x="-3.4" y="-40" width="2" height="40" fill="#cdb88a"/><path d="M0.6 -36 v4 M0.6 -30 v3 M0.6 -25 v5 M0.6 -18 v3 M0.6 -13 v4" stroke="#2a2a2a" stroke-width="1.3"/></g>`).join('') + `</g>`;
  s += M(o1, 350, 334, .6);
  // 役人2：笏を持ち、少し後ろで聞く（左向き、位の低い浅緑の袍）
  const off2 = skeleton(MALE, {pelvis: [122, 180], chest: [124, 90], ankleL: [106, 334], ankleR: [138, 334], kneeL: 1, kneeR: 1,
    wristL: [112, 178], wristR: [130, 180], elbowL: 1, elbowR: -1, handL: 'grip', handR: 'grip', shakuFront: {at: [121, 176], angle: 0}, headDx: -2, headTilt: 6});
  s = s + '';
  const OFF2 = {...KOKUFU, robe: '#7fa679', robeDark: '#5f8a5a', type: 'sato', skin: '#e9bf98', skinDark: '#cf9d76'};
  // 奥にいるので先に描く（役人1の後ろに少し重なる）
  s = s.replace(/(<g transform="translate\(350)/, M(officialFigure(off2, OFF2, 'stand'), 424, 318, .55) + '$1');
  return s;
}

// ---------- 3. 水辺の石の上で甲羅干しをする親亀と小亀 ----------
function kame() {
  let s = `<rect width="480" height="360" fill="${grad([[0, '#bfe0ef'], [.45, '#a9d4e8'], [1, '#86bfdb']])}"/>`;
  // 向こう岸の葦原と水面の映りこみ
  s += `<path d="M0 0 H480 V70 Q360 80 240 74 Q120 68 0 78 Z" fill="${grad([[0, '#8fb878'], [1, '#a5c98d']])}"/>`;
  s += reeds(0, 480, 76, '#6f9a58', 41, 46, '#9cc47e');
  s += `<path d="M0 78 Q120 70 240 76 Q360 82 480 72 V96 H0 Z" fill="#9fc6a8" opacity=".5"/>`;
  { const r = rnd0(13); for (let i = 0; i < 16; i++) { const x = r() * 480, y = 110 + r() * 230, w = 20 + r() * 50; s += `<path d="M${r1(x)} ${r1(y)} h${r1(w)}" stroke="#ffffff" stroke-width="1.6" stroke-linecap="round" opacity=".5"/>`; } }
  // ハスの葉（右の水面）
  for (const [x, y, rx] of [[352, 250, 30], [404, 290, 24], [312, 300, 18], [440, 220, 16]]) s += `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${rx * .32}" fill="#5f9a58"/><path d="M${x} ${y} l${rx * .9} ${-rx * .12}" stroke="#86b874" stroke-width="1.6"/><ellipse cx="${x - rx * .3}" cy="${y - rx * .06}" rx="${rx * .35}" ry="${rx * .1}" fill="#7ab06a" opacity=".6"/>`;
  // 石（左下）：水から出た平たい石と、石のふちの波
  s += `<path d="M10 276 Q30 226 104 220 Q190 216 226 252 Q240 274 222 290 Q140 304 40 298 Q8 296 10 276 Z" fill="${grad([[0, '#a39e92'], [1, '#7e7a70']])}"/>`;
  s += `<path d="M40 234 Q100 220 170 226 Q130 230 90 236 Q60 242 40 234 Z" fill="#c3bfb4" opacity=".7"/><path d="M60 282 Q120 290 200 280" stroke="#6a665e" stroke-width="2" fill="none" opacity=".6"/>`;
  s += `<path d="M30 272 q10 -6 20 -2 M180 244 q8 -4 14 0" stroke="#6f8f5a" stroke-width="4" fill="none" stroke-linecap="round" opacity=".8"/>`;
  s += `<path d="M0 300 Q60 296 120 304 Q180 306 236 294" stroke="#ffffff" stroke-width="2" fill="none" opacity=".7"/><ellipse cx="120" cy="312" rx="120" ry="8" fill="#5d8fae" opacity=".35"/>`;
  // 亀：甲羅の上を向けて首をのばし、日を浴びる（右向き）
  const turtle = (x, y, sc, a = 0) => {
    let t = `<g transform="translate(${x} ${y}) rotate(${a}) scale(${sc})">`;
    t += `<path d="M-30 4 q-10 4 -16 -2 q4 -6 14 -6 z M22 6 q10 6 16 2 q-2 -8 -14 -8 z" fill="#6b6a4a"/>`;
    t += `<path d="M30 -4 Q44 -16 50 -26 Q58 -30 60 -24 Q58 -16 46 -6 Z" fill="#7a7854"/><circle cx="55" cy="-24" r="1.6" fill="#1a1a10"/><path d="M50 -22 q4 2 8 0" stroke="#d8c46a" stroke-width="1.2" fill="none"/>`;
    t += `<path d="M-36 2 Q-34 -30 0 -32 Q34 -30 36 2 Z" fill="#5a5236"/><path d="M-36 2 Q0 10 36 2 Q0 6 -36 2 Z" fill="#c9b46a"/>`;
    t += `<path d="M-20 -1 Q-20 -24 0 -26 Q20 -24 20 -1 M-12 -26 V-2 M12 -26 V-2 M-30 -12 H30" stroke="#3f3a26" stroke-width="1.6" fill="none"/>`;
    t += `<path d="M-14 -24 Q0 -30 14 -24" stroke="#7d7450" stroke-width="2" fill="none" opacity=".8"/>`;
    t += `<path d="M-38 0 q-8 4 -12 -2" stroke="#6b6a4a" stroke-width="4" fill="none" stroke-linecap="round"/>`;
    return t + `</g>`;
  };
  s += turtle(108, 236, 1.05, -6);
  s += turtle(96, 206, .45, -4);              // 親亀の背中にのる小亀
  s += turtle(186, 254, .5, 6);               // 石の端の小亀
  // トンボ（右上の点景）：上から見た赤とんぼ。大きな複眼の頭、胸、節のある細長い腹、
  // 透きとおった細長い4枚のはね（はね脈と、先の黒い縁紋）
  {
    const wing = (x, y, len, w, a) => `<g transform="translate(${x} ${y}) rotate(${a})"><path d="M0 0 Q${len * .3} ${-w} ${len} ${-w * .4} Q${len + 2} 0 ${len} ${w * .3} Q${len * .4} ${w * .8} 0 0 Z" fill="#f4f8fa" fill-opacity=".75" stroke="#8a9aa4" stroke-width=".7"/>` +
      `<path d="M2 0 L${len - 2} ${-w * .1}" stroke="#9aa8b0" stroke-width=".6"/><path d="M${len - 7} ${-w * .5} l4 0 l0 ${w * .5} l-4 0 z" fill="#3a2a24"/></g>`;
    let d = `<g transform="translate(390 140) rotate(-20)">`;
    // はねは胴から左右へまっすぐ広げる（前ばねは少し前、後ろばねは少し後ろへ）
    d += wing(-2, -2, 30, 6, 186) + wing(2, -2, 30, 6, -6);
    d += wing(-2, 4, 28, 7, 168) + wing(2, 4, 28, 7, 12);
    d += `<path d="M0 6 L0 40" stroke="#c8442e" stroke-width="3.4" stroke-linecap="round"/>`;
    for (let y = 10; y < 40; y += 4) d += `<path d="M-1.8 ${y} h3.6" stroke="#8a2c1c" stroke-width=".8"/>`;
    d += `<ellipse cx="0" cy="0" rx="3.4" ry="6" fill="#9a5a34"/><path d="M-1.6 -4 v8 M1.6 -4 v8" stroke="#d8a06a" stroke-width=".8"/>`;
    d += `<circle cx="-2.6" cy="-8" r="3" fill="#7a2a1e"/><circle cx="2.6" cy="-8" r="3" fill="#7a2a1e"/><circle cx="-3.2" cy="-8.8" r=".9" fill="#ffffff" opacity=".8"/><circle cx="2" cy="-8.8" r=".9" fill="#ffffff" opacity=".8"/>`;
    s += d + `</g>`;
  }
  s += reeds(440, 480, 360, '#46703a', 7, 120, '#86b858');
  return s;
}

const out = process.argv[2];
for (const [n, f] of Object.entries({uma, kokuga, kame})) {
  defs = []; gid = 0;
  const body = f();
  fs.writeFileSync(path.join(out, `${n}.svg`), `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="360" viewBox="0 0 480 360"><title>${n}</title><defs>${defs.join('')}</defs>${body}</svg>\n`);
}
console.log('3 files');
