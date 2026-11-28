// 背景3枚（480x360、版4の絵柄：輪郭線なしの平面イラスト）。
// uma.svg   ：従者が手綱を引く馬に乗った都の貴族（手児奈に求婚しにやって来た）が、水辺の継橋の上を進む。中景に浜で働く女たち、遠景の丘に建設中の国府。
// kokuga.svg：建設中の建物の柱のたもとで、木簡を広げて工事の進み具合を淡々と話し合う2人の役人と大工の棟梁（画面の中心を外す）。
// kame.svg  ：自然の点景。水辺の石の上で甲羅干しをする親亀と小亀（画面の中央を外す）。
const fs = require('fs');
const path = require('path');
const {lerp, add, P, r1, limb, foot, hand, ang, MALE, skeleton, satoFigure, officialFigure, KOKUFU, MIYAKO, SATO} = require('./chars.cjs');
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
  return `<g data-ambient="reeds" data-pivot-x="${(x0 + x1) / 2}" data-pivot-y="${base}">${s}</g>`;
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

// ---- 馬（左向き・歩く）。原点はひづめの接地点の中ほど。在来の小柄な馬。
// 体は「肩」「胴」「腰（尻）」の3つのかたまりで組み、脚の上の部分（前脚の前腕・後脚のもも）は胴側が太く関節側が細い台形にする。
// 鞍・障泥（泥よけ）・鐙・おもがいをつける。乗り手の脚は障泥の上（手前）に描く。
function horse() {
  const c = '#8f5d36', cl = '#a06a40', cd = '#6e4426', cdd = '#5a361e', mane = '#2a1d16', hoof = '#3a2a20';
  const trap = (a, b, wa, wb, col) => {
    const d = Math.hypot(b[0] - a[0], b[1] - a[1]), nx = -(b[1] - a[1]) / d, ny = (b[0] - a[0]) / d;
    return `<path d="M${P([a[0] + nx * wa / 2, a[1] + ny * wa / 2])} L${P([b[0] + nx * wb / 2, b[1] + ny * wb / 2])} L${P([b[0] - nx * wb / 2, b[1] - ny * wb / 2])} L${P([a[0] - nx * wa / 2, a[1] - ny * wa / 2])} Z" fill="${col}"/>` +
      `<circle cx="${r1(b[0])}" cy="${r1(b[1])}" r="${r1(wb / 2)}" fill="${col}"/>`;
  };
  // 脚：上の台形（胴側が太い）→ひざ・飛節→管（細い）→球節→つなぎ→ひづめ
  const leg = ([top, joint, fet, toe], w0, w1, col) =>
    trap(top, joint, w0, w1, col) + trap(joint, fet, w1 * .8, 6.4, col) + trap(fet, toe, 6.4, 6, col) +
    `<path d="M${r1(toe[0] - 5)} ${r1(toe[1] - 2)} L${r1(toe[0] + 5)} ${r1(toe[1] - 2)} L${r1(toe[0] + 6)} ${r1(toe[1] + 3)} L${r1(toe[0] - 7)} ${r1(toe[1] + 3)} Z" fill="${hoof}"/>`;
  let s = '';
  // 奥の脚（暗い色）：奥の前脚は後ろへ、奥の後脚は前へ
  s += leg([[-34, -72], [-30, -34], [-26, -10], [-28, -3]], 18, 9, cd);
  s += leg([[30, -78], [36, -36], [30, -10], [28, -3]], 24, 9, cd);
  // 尾
  s += `<path d="M56 -104 Q74 -96 74 -66 Q74 -44 66 -32 Q62 -52 58 -70 Q54 -86 50 -98 Z" fill="${mane}"/>`;
  // 首：肩から頭へ、根元が太く、のどの所で細くなる
  s += `<path d="M-20 -110 Q-44 -146 -66 -160 L-84 -140 Q-72 -112 -64 -82 Z" fill="${c}"/>`;
  s += `<path d="M-74 -128 Q-70 -106 -64 -84 L-58 -86 Q-64 -108 -68 -128 Z" fill="${cd}" opacity=".5"/>`;
  // 胴（まん中のかたまり）
  s += `<path d="M-34 -104 Q0 -112 30 -104 Q42 -86 32 -66 Q0 -56 -34 -64 Q-44 -84 -34 -104 Z" fill="${c}"/>`;
  s += `<path d="M-30 -66 Q0 -58 30 -68 Q8 -62 -30 -70 Z" fill="${cd}" opacity=".6"/>`;
  // 肩（前のかたまり）：き甲から肩端へ斜めに傾いた形
  s += `<path d="M-30 -114 Q-12 -104 -16 -82 Q-20 -60 -42 -60 Q-62 -62 -64 -80 Q-62 -100 -44 -112 Q-38 -116 -30 -114 Z" fill="${cl}"/>`;
  s += `<path d="M-20 -100 Q-16 -82 -24 -66" stroke="${cd}" stroke-width="2" fill="none" opacity=".55"/>`;
  // 腰（後ろのかたまり）：丸い尻
  s += `<path d="M14 -104 Q34 -118 54 -108 Q68 -96 66 -78 Q62 -62 44 -60 Q26 -60 18 -74 Q10 -90 14 -104 Z" fill="${cl}"/>`;
  s += `<path d="M20 -96 Q16 -80 24 -66" stroke="${cd}" stroke-width="2" fill="none" opacity=".55"/>`;
  // 手前の脚：手前の前脚は一歩前へ、手前の後脚は後ろへ蹴る
  s += leg([[-46, -72], [-52, -34], [-56, -10], [-58, -3]], 20, 10, c);
  s += leg([[44, -76], [58, -36], [56, -10], [60, -3]], 26, 10, c);
  // 頭：額・ほお（丸い下あご）・鼻づらで組む。斜め下を向く
  s += `<path d="M-66 -164 Q-86 -168 -98 -150 L-114 -128 Q-120 -116 -110 -112 Q-100 -110 -94 -116 Q-86 -124 -80 -128 Q-64 -128 -62 -146 Q-60 -158 -66 -164 Z" fill="${c}"/>`;
  s += `<path d="M-80 -128 Q-64 -128 -63 -144 Q-70 -134 -82 -132 Z" fill="${cd}" opacity=".6"/>`;
  s += `<path d="M-96 -152 Q-108 -134 -114 -124" stroke="${cl}" stroke-width="3" fill="none" stroke-linecap="round" opacity=".7"/>`;
  // 耳（奥・手前）、目、鼻の穴、口
  s += `<path d="M-74 -162 L-76 -180 L-66 -164 Z" fill="${cdd}"/><path d="M-68 -162 L-64 -180 L-60 -160 Z" fill="${c}"/><path d="M-66 -164 L-64 -176 L-62 -162 Z" fill="${cd}"/>`;
  s += `<ellipse cx="-82" cy="-150" rx="3" ry="2.2" fill="#1a1410"/><circle cx="-83" cy="-151" r=".8" fill="#ffffff"/>`;
  s += `<path d="M-112 -124 q-3 2 -2 5" stroke="${mane}" stroke-width="1.8" fill="none" stroke-linecap="round"/><path d="M-112 -114 q4 1 8 -2" stroke="${cdd}" stroke-width="1.4" fill="none"/>`;
  // たてがみと前髪
  s += `<path d="M-64 -164 Q-42 -146 -22 -114 L-30 -112 Q-46 -140 -70 -158 Z" fill="${mane}"/>`;
  s += `<path d="M-70 -164 q-8 4 -12 12 q8 -2 14 -8 z" fill="${mane}"/>`;
  // おもがい（頭の革ひも）とはみ
  s += `<path d="M-68 -160 L-76 -134 L-104 -116 M-96 -146 Q-90 -134 -80 -134 M-108 -130 Q-98 -124 -94 -118" stroke="#4a2a1a" stroke-width="2" fill="none"/><circle cx="-104" cy="-116" r="2.2" fill="#9a9a9a"/>`;
  // 腹帯、鞍、障泥、鐙の革（乗り手の脚の下になる）
  s += `<path d="M-12 -108 L-14 -60" stroke="#4a2a1a" stroke-width="4"/>`;
  s += `<path d="M-30 -102 Q-8 -98 18 -102 L16 -62 Q-6 -58 -28 -62 Z" fill="#7a2e28"/><path d="M-28 -62 Q-6 -58 16 -62" stroke="#d8b24a" stroke-width="2" fill="none"/>`;
  s += `<path d="M-34 -104 Q-30 -116 -22 -110 Q-6 -114 14 -110 Q22 -118 26 -106 L22 -100 Q-6 -106 -30 -98 Z" fill="#4a2a1a"/>`;
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
  // 馬と、馬に乗った都の貴族（手児奈に求婚しに、都＝平城京からやって来た。浅緋の袍、口ひげ、腰の大刀。左向き）
  const hx = 330, hy = deck + 2, hs = .9;
  s += `<g transform="translate(${hx} ${hy}) scale(${hs})">${horse()}</g>`;
  // 乗り手は鞍にまたがる：骨盤を鞍の上に置き、手前の脚は太ももを前下へ、ひざを曲げてすねを下ろし、足を鐙に入れる
  const rs = .42, seat = [hx - 6 * hs, hy - 106 * hs];
  const rx = seat[0] - (122 - 120) * rs, ry = seat[1] + (334 - 250) * rs;
  // 奥の右腕は体と馬のかげに隠し、手前の左腕はひじを体に沿わせて、腹の前で手綱を持つ
  const rider = skeleton(MALE, {pelvis: [122, 250], chest: [118, 164], ankleL: [80, 380], ankleR: [80, 380], kneeL: 1, kneeR: 1,
    wristL: [40, 230], wristR: [80, 236], elbowL: -1, elbowR: -1, handL: 'grip', handR: 'grip', hideArmL: true, headDx: -2, headTilt: 4});
  const hip = [122, 250], knee = [65, 307], ankle = [80, 382];
  let rd = `<path d="M140 238 L206 268" stroke="#3a2a1e" stroke-width="6" stroke-linecap="round"/><path d="M134 234 L142 240" stroke="#d8b24a" stroke-width="6"/><circle cx="160" cy="247" r="3.4" fill="#d8b24a"/><circle cx="186" cy="259" r="3.4" fill="#d8b24a"/>`;
  // Scratch flattens group transforms without transforming clip paths. Draw the seated torso directly.
  rd += officialFigure(rider, {...MIYAKO, sword: false}, 'stand', {seated: true});
  // 袖は袍と同じ色なので、濃い色のふちを入れて腕の形を見せる（ひじは体に沿わせる）
  for (const [sh, a, side] of [[rider.sr, rider.armR, -1]]) {
    const pts = `M${P(sh)} L${P(a.mid)} L${P(a.end)}`;
    rd += `<path d="${pts}" stroke="${MIYAKO.robeDark}" stroke-width="22" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="${pts}" stroke="${MIYAKO.robe}" stroke-width="17" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
    rd += hand(a.end, ang(a.mid, a.end), MIYAKO.skin, {kind: 'grip', size: 1.05, side});
  }
  // すね（白い袴）と履、鐙
  // 鐙：革の吊りひもと輪（足の奥側）を先に描き、足の裏をのせる踏み板を後で描く
  rd += `<path d="M76 330 L72 372" stroke="#4a2a1a" stroke-width="3"/><path d="M54 394 Q50 370 70 366 Q90 370 86 394" stroke="#5a5a5a" stroke-width="4" fill="none"/>`;
  rd += limb(knee, ankle, 18, 15, '#efe8d8') + foot(ankle, -1, '#22201f', {size: 1.1});
  rd += `<rect x="52" y="391" width="36" height="5" rx="2" fill="#5a5a5a"/>`;
  // 袍の裾：腰から太ももを包み、ひざの下へ少し垂れる
  rd += `<path d="M92 228 L152 230 Q160 254 146 268 Q116 300 92 330 Q72 334 58 322 Q42 312 46 296 Q50 286 60 282 L100 244 Z" fill="${MIYAKO.robe}"/>`;
  rd += `<path d="M146 268 Q116 300 92 330 Q78 332 66 324 Q96 300 128 268 Z" fill="${MIYAKO.robeDark}" opacity=".5"/><path d="M110 250 Q86 274 64 296" stroke="${MIYAKO.robeDark}" stroke-width="2" fill="none" opacity=".6"/>`;
  s += place(rd, rx, ry, rs);
  // 手綱：馬のはみから乗り手の手前の手へ、もう1本は従者の手へ
  const bit = [hx - 104 * hs, hy - 116 * hs];
  s += `<path d="M${P(bit)} Q${r1(bit[0] + 34)} ${r1(bit[1] + 26)} ${r1(rx + (70 - 120) * rs)} ${r1(ry + (238 - 334) * rs)}" stroke="#4a2a1a" stroke-width="1.4" fill="none"/>`;
  // 従者：馬の前を歩き、後ろ手に手綱を引く（左向き）
  const groom = skeleton(MALE, {pelvis: [124, 180], chest: [114, 92], ankleL: [98, 334], ankleR: [148, 326], kneeL: 1, kneeR: 1, liftR: 8,
    wristL: [100, 190], wristR: [176, 168], elbowL: 1, elbowR: 1, headDx: -2, headTilt: 0});
  const gx = 208, gy = deck + 2, gs = .42;
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
  // 柱の下端は、礎石に据わる丸い柱らしく、下へふくらむゆるい曲線にする（明るい面・暗い面も同じ形で切る）
  const pillar = 'M42 -10 H98 V286 Q70 298 42 286 Z';
  defs.push(`<clipPath id="pillar"><path d="${pillar}"/></clipPath>`);
  s += `<path d="${pillar}" fill="#b8553a"/><g clip-path="url(#pillar)"><rect x="42" y="-10" width="16" height="320" fill="#d07858" opacity=".6"/><rect x="86" y="-10" width="12" height="320" fill="#8a3e2a" opacity=".5"/></g>`;
  s += `<path d="M44 287 Q70 297 96 287" stroke="#7a3424" stroke-width="1.6" fill="none" opacity=".7"/>`;
  s += `<path d="M42 200 h56 M42 120 h56" stroke="#8a3e2a" stroke-width="1.4" opacity=".5"/>`;
  // 人物：画面の中心より右に寄せた3人
  const M = (svg, x, y, sc, f = 1) => place(svg, x, y, sc, f);
  // 棟梁：物差しを立て、柱を指して説明する（右向き）
  const boss = skeleton(MALE, {pelvis: [122, 180], chest: [124, 92], ankleL: [104, 334], ankleR: [142, 334], kneeL: 1, kneeR: 1,
    // 左腕：肘を体の横に下ろし、肘から先を上へ立てて人差し指を立てる
    wristL: [70, 110], wristR: [150, 196], elbowL: -1, elbowR: -1, handL: 'point', headDx: -6, headTilt: -18});
  let b = recolor(satoFigure(boss, 'stand'), {[SATO.cloth]: '#b9a07a', [SATO.clothDark]: '#957c56', [SATO.skin]: '#d39a6a', [SATO.skinDark]: '#b07a4a'});
  b += `<path d="M152 120 L150 330" stroke="#c9a46a" stroke-width="5" stroke-linecap="round"/><path d="M146 140 h8 M146 170 h8 M146 200 h8 M146 230 h8 M146 260 h8 M146 290 h8" stroke="#7a5a34" stroke-width="1.2"/>`;
  s += M(b, 262, 334, .6, -1);
  // 役人1：木簡の束を手のひらの上に広げて読み上げる（左向き）
  const off1 = skeleton(MALE, {pelvis: [122, 180], chest: [120, 90], ankleL: [104, 334], ankleR: [138, 334], kneeL: 1, kneeR: 1,
    wristL: [24, 156], wristR: [102, 164], elbowL: -1, elbowR: -1, handL: 'grip', handR: 'grip', headDx: -6, headTilt: -22});
  let o1 = officialFigure(off1, KOKUFU, 'stand');
  // 体の前に重なった袖は、袍と同じ色で見分けにくいので、濃い色のふちを入れて腕の形を見せる（肘は体に沿わせる）
  for (const [sh, a] of [[off1.sr, off1.armR], [off1.sl, off1.armL]]) {
    const pts = `M${P(sh)} L${P(a.mid)} L${P(a.end)}`;
    o1 += `<path d="${pts}" stroke="${KOKUFU.robeDark}" stroke-width="22" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="${pts}" stroke="${KOKUFU.robe}" stroke-width="17" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
  }
  o1 += '<!--scroll-->';
  // 木簡の冊書：細長い木の札を横に並べ、上下2か所を紐で編んでつなぎ、巻物のように巻いたもの。
  // 左手に巻いたほうを持ち、右へ広げた札に縦書きの墨の文字が並ぶ
  {
    const x0 = 62, x1 = 120, y0 = 136, h = 40, n = 9, w = (x1 - x0 - 8) / n;
    // 1.5倍の大きさで、体の前に水平に広げる（上から見下ろす面がわずかに見える）。棟梁と2人で同じところをのぞきこむ
    const cx = (x0 + x1) / 2, cy = y0 + h / 2;
    let m = `<g transform="translate(64 156) skewX(-28) scale(1.6 .48) translate(${-cx} ${-cy})">`;
    // 巻いた部分（左端の筒）
    m += `<rect x="${x0 - 2}" y="${y0 - 1}" width="10" height="${h + 2}" rx="5" fill="#d8c69a"/><ellipse cx="${x0 + 3}" cy="${y0 - 1}" rx="5" ry="2" fill="#c4ae7e"/><path d="M${x0} ${y0 + 6} h6 M${x0} ${y0 + h - 6} h6" stroke="#b9a274" stroke-width="1"/>`;
    // 広げた札（すき間なく並ぶ）と墨の文字
    for (let j = 0; j < n; j++) {
      const xx = x0 + 8 + j * w;
      m += `<rect x="${r1(xx)}" y="${y0}" width="${r1(w)}" height="${h}" fill="${j % 2 ? '#eadcb4' : '#e2d2a6'}"/><path d="M${r1(xx)} ${y0} v${h}" stroke="#c4ae7e" stroke-width=".6"/>`;
      if (j > 0) { let t = ''; for (let k = 0; k < 6; k++) { const yy = y0 + 4 + k * 5.6 + (j % 3); if (yy < y0 + h - 4) t += ` M${r1(xx + w / 2)} ${r1(yy)} v${r1(2 + ((j + k) % 3))}`; } m += `<path d="${t}" stroke="#2a2a2a" stroke-width="1.1" stroke-linecap="round"/>`; }
    }
    // 木の厚み：手前の切り口（札の端の断面）を濃い色の帯で見せ、札ごとの境目を入れる
    m += `<rect x="${x0 + 8}" y="${y0 + h}" width="${r1(n * w)}" height="9" fill="#b39a68"/>`;
    for (let j = 0; j <= n; j++) m += `<path d="M${r1(x0 + 8 + j * w)} ${y0 + h} v9" stroke="#8a7044" stroke-width="1"/>`;
    m += `<path d="M${x0 + 8} ${y0 + h + 9} h${r1(n * w)}" stroke="#7a6038" stroke-width="1.2"/>`;
    // 巻いた筒の手前の端：巻きこんだ札の断面
    m += `<ellipse cx="${x0 + 3}" cy="${y0 + h + 2}" rx="6" ry="6" fill="#b39a68"/><path d="M${x0 + 3} ${y0 + h + 2} m-4 0 a4 4 0 1 0 4 -4 a3 3 0 1 0 -3 3 a2 2 0 1 0 2 -2" stroke="#7a6038" stroke-width="1" fill="none"/>`;
    // 上下2か所の編み紐（札と札のあいだを交互にくぐる）
    for (const yy of [y0 + 7, y0 + h - 7]) {
      m += `<path d="M${x0 + 4} ${yy} H${x1}" stroke="#7a5a34" stroke-width="1.6"/>`;
      for (let j = 0; j < n; j++) m += `<path d="M${r1(x0 + 8 + j * w + 1)} ${yy - 1.6} l${r1(w - 2)} 3.2" stroke="#5a3e22" stroke-width="1.1"/>`;
    }
    m += `<path d="M${x1} ${y0 + 7} q5 2 3 8 M${x1} ${y0 + h - 7} q5 -2 4 -8" stroke="#7a5a34" stroke-width="1.4" fill="none"/>`;
    // 両手：巻いた筒と、広げた端をそれぞれ握る（親指が札の上にかかる）
    // 両手：左は巻いた筒の下から、右は広げた端の下から支える（手は木簡の下）
    o1 = o1.replace('<!--scroll-->', m + `</g>`);
    const hand = (x, y, flip) => `<path d="M${x - 7} ${y} q0 -6 7 -6 q8 0 8 6 q-1 5 -8 5 q-6 0 -7 -5 z" fill="${KOKUFU.skin}"/><path d="M${x + flip * 6} ${y - 4} q${flip * 4} -4 ${flip * 2} -8" stroke="${KOKUFU.skin}" stroke-width="3.2" stroke-linecap="round" fill="none"/>`;
    o1 += hand(26, 162, 1) + hand(102, 166, -1);
  }
  s += M(o1, 350, 334, .6);
  // 役人2：笏を持ち、少し後ろで聞く（左向き、位の低い浅緑の袍）
  // 丸めた木簡の巻物を3巻、体の手前（胸から腹の前）で抱える。
  // 左を向いた斜めの体では、手前に見えるのは画面の右の肩（左肩）。左腕は手前の肩から下ろして、前腕で束を下から抱える。
  // 右腕は奥の肩（画面の左、体の前のふち）から下ろし、右手を胸の前で束の上に添える。手前に巻いた端の断面（渦）が見える
  const rolls = (() => {
    let r = `<g transform="translate(74 150) rotate(-8) scale(1.4 1)">`;
    for (const [dx, dy] of [[-2, -14], [3, -2], [-3, 10]]) {
      r += `<g transform="translate(${dx} ${dy})"><rect x="-26" y="-6" width="52" height="12" rx="6" fill="#d8c69a"/><rect x="-26" y="-6" width="52" height="4" rx="2" fill="#e8d9b0"/>`;
      // 札の境目と2本の紐は、筒のまわりをめぐる線なので、断面と同じ向き（右へふくらむ弧）に描く
      for (let x = -20; x <= 20; x += 5) r += `<path d="M${x} -6 Q${x + 2.6} 0 ${x} 6" stroke="#c4ae7e" stroke-width=".7" fill="none"/>`;
      r += `<path d="M-14 -6 Q-11 0 -14 6 M14 -6 Q17 0 14 6" stroke="#7a5a34" stroke-width="1.8" fill="none"/>`;
      // 巻いた端の断面：斜めから見るので、縦に細い楕円にする
      r += `<ellipse cx="-26" cy="0" rx="2" ry="6" fill="#b39a68"/><g transform="translate(-26 0) scale(.42 1)"><path d="M0 0 m-2 0 a2 2.6 0 1 0 2 -2.6 a1.4 1.8 0 1 0 -1.4 1.8" stroke="#7a6038" stroke-width="1" fill="none"/></g></g>`;
    }
    return r + `</g>`;
  })();
  const off2 = skeleton(MALE, {pelvis: [122, 180], chest: [124, 90], ankleL: [106, 334], ankleR: [138, 334], kneeL: 1, kneeR: 1,
    wristL: [42, 128], wristR: [100, 172], elbowL: -1, elbowR: -1, handL: 'open', handR: 'grip', under: rolls, underFirst: true, headDx: -2, headTilt: 6});
  const OFF2 = {...KOKUFU, robe: '#7fa679', robeDark: '#5f8a5a', type: 'sato', skin: '#e9bf98', skinDark: '#cf9d76'};
  // 奥にいるので先に描く（役人1の後ろに少し重なる）。袖は袍と同じ色なので、濃い色のふちを入れて腕の形を見せる
  let o2 = officialFigure(off2, OFF2, 'stand');
  const sleeve = (sh, a) => { const pts = `M${P(sh)} L${P(a.mid)} L${P(a.end)}`;
    return `<path d="${pts}" stroke="${OFF2.robeDark}" stroke-width="22" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="${pts}" stroke="${OFF2.robe}" stroke-width="17" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`; };
  // 右腕と右手（奥の肩から）：木簡の束より奥に描く（束の上のふちに指先がかかる）
  o2 += sleeve(off2.sl, off2.armL);
  o2 += `<path d="M${P(add(off2.armL.end, [-12, -2]))} q2 -6 10 -6 q8 0 10 4 q-2 5 -10 5 q-7 1 -10 -3 z" fill="${OFF2.skin}"/><path d="M${P(add(off2.armL.end, [-11, 0]))} h12" stroke="${OFF2.skinDark}" stroke-width=".8" opacity=".6"/>`;
  // 木簡の束を右腕の手前に描きなおす
  o2 += rolls;
  // 左腕と左手（手前の肩から）：束の手前で、下から抱える
  o2 += sleeve(off2.sr, off2.armR);
  o2 += `<path d="M${P(add(off2.armR.end, [-12, -2]))} q2 6 10 6 q8 0 10 -5 q-2 -4 -10 -4 q-7 -1 -10 3 z" fill="${OFF2.skin}"/>`;
  s = s.replace(/(<g transform="translate\(350)/, M(o2, 424, 318, .55) + '$1');
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
