// 背景「真間の井の井戸端」（480x360、版4の絵柄：輪郭線なしの平面イラスト）。
// 真間の井で、この時代の里の女たちと子どもたちが水をくみ、話をして笑い合う。考証メモ 2.2・2.3・2.5 にもとづく。
// ・井戸：木を井の字に組んだ低い枠。屋根もつるべ車もない。曲物の桶になわをつけ、手でたぐって水を上げる。
// ・女たち：麻の上衣（腰丈、右前）と、ひだのある麻の裳、ひもの帯、はだし。髪は後ろで束ねるか、まげにまとめる。
//   水がめ（土師器の甕）は頭の上にのせて運ぶか、腰にかかえる。
// ・老女は白髪をまげにまとめ、腰をかがめて丸太に腰かける。子どもはひざ丈の上衣ひとつで、はだし。
// 人物は chars.cjs の骨格・顔・手足の部品で描く（腕と脚は長さを固定した2関節）。
const fs = require('fs');
const path = require('path');
const {face, placeHead, limb, hand, foot, lerp, add, seg, ang, P, r1, FEMALE, skeleton} = require('./chars.cjs');

let defs = [], gid = 0;
const grad = (stops, x2 = 0, y2 = 1) => {
  const id = `g${++gid}`;
  defs.push(`<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}">${stops.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join('')}</linearGradient>`);
  return `url(#${id})`;
};
const rnd0 = seed => { let r = seed; return () => ((r = (r * 9301 + 49297) % 233280) / 233280); };
// 凸包（服のかたちを、関節のまわりの点から作る）
const hull = pts => {
  const q = pts.map(p => [p[0], p[1]]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const v of q) { while (lo.length > 1 && cr(lo[lo.length - 2], lo[lo.length - 1], v) <= 0) lo.pop(); lo.push(v); }
  for (const v of q.slice().reverse()) { while (up.length > 1 && cr(up[up.length - 2], up[up.length - 1], v) <= 0) up.pop(); up.push(v); }
  return 'M' + lo.slice(0, -1).concat(up.slice(0, -1)).map(P).join(' L') + ' Z';
};

// 子どもの骨格（頭が大きく、手足が短い）
const CHILD = {ua: 34, fa: 30, th: 50, sh: 46, shoulder: 15, hip: 9, neck: 6, headR: 24};

// 髪（顔の部品と同じ、右向きの頭の座標）
const hairSvg = (style, c) => {
  const cap = `<path d="M-19 4 Q-23 -26 0 -28 Q22 -28 21 -8 Q14 -18 6 -19 Q-2 -20 -10 -14 Q-15 -6 -15 8 Z" fill="${c}"/>`;
  if (style === 'tied') return cap + `<path d="M-18 -4 Q-30 16 -26 44 L-20 44 Q-22 20 -12 0 Z" fill="${c}"/><rect x="-24" y="2" width="8" height="4" rx="2" fill="#d8c49a" transform="rotate(20 -20 4)"/>`;
  if (style === 'bun') return cap + `<circle cx="-18" cy="-16" r="9" fill="${c}"/><path d="M-26 -12 q8 4 14 -2" stroke="#d8c49a" stroke-width="2" fill="none"/>`;
  if (style === 'oldbun') return `<path d="M-19 4 Q-23 -26 0 -28 Q22 -28 21 -8 Q12 -16 4 -16 Q-6 -16 -12 -10 Q-15 -4 -15 8 Z" fill="${c}"/><circle cx="-17" cy="-19" r="7" fill="${c}"/>`;
  if (style === 'bob') return `<path d="M-20 10 Q-24 -26 0 -28 Q22 -28 22 -6 L20 -4 Q12 -16 4 -16 L2 -12 L-2 -16 Q-12 -12 -14 6 Z" fill="${c}"/>`;
  // 耳の横で束ねた子どもの髪。顔の側（奥）の房は頭の向こうに隠れるので描かない
  if (style === 'tufts') return cap + `<ellipse cx="-14" cy="6" rx="5" ry="8" fill="${c}"/>`;
  return cap;
};

// 人物を1人描く。k は skeleton() の結果。o に服の色・髪・表情・持ち物
function person(k, o) {
  const c = o.colors, child = o.child;
  const profile = child ? 'child' : o.old ? 'elder' : o.hair === 'bun' ? 'village-bun' : c === C.ochre ? 'village-wide' : 'village-narrow';
  const dirty = !child && !o.old;
  const mud = (q, sc = 1) => `<g transform="translate(${P(q)}) scale(${sc})"><path d="M-3 -1 q4 -2 7 .4 q-.4 3 -5 2 Z" fill="#806344" opacity=".27"/><circle cx="5" cy="1" r=".9" fill="#806344" opacity=".22"/></g>`;
  let s = '';
  const neckBase = lerp(k.sl, k.sr, .5);
  // 奥の腕（体の後ろ）
  const arm = (a, sh, side, kind) => limb(sh, a.mid, child ? 10 : 13, child ? 9 : 12, side > 0 ? c.cloth : c.clothDark) + limb(a.mid, a.end, child ? 9 : 12, child ? 8 : 10, side > 0 ? c.cloth : c.clothDark) +
    hand(a.end, ang(a.mid, a.end), c.skin, {kind, size: child ? .65 : .85, side}) + (dirty ? mud(a.end, .9) : '');
  if (o.backArm !== false) s += arm(k.armR, k.sr, -1, o.handR || 'relaxed');
  // 脚と足（はだし）
  for (const [leg, hip] of [[k.legR, k.hr], [k.legL, k.hl]]) {
    if (o.skirt === 'long') s += foot(leg.end, 1, c.skin, {size: child ? .7 : .9});
    else s += limb(hip, leg.mid, child ? 11 : 13, child ? 9 : 11, c.skin) + limb(leg.mid, leg.end, child ? 9 : 11, child ? 7 : 9, c.skin) + foot(leg.end, 1, c.skin, {size: child ? .7 : .9});
    if (dirty) s += mud(add(leg.end, [5, 5]), 1.2);
  }
  // 下の衣：女は足首までの裳、子どもはひざ丈の上衣の裾
  const waist = lerp(neckBase, k.pelvis, .66);
  if (o.skirt === 'long') {
    const pts = [add(waist, [-20, 0]), add(waist, [20, 0]), add(k.hl, [-12, 4]), add(k.hr, [12, 4]),
      add(k.legL.mid, [-12, 0]), add(k.legL.mid, [12, 0]), add(k.legR.mid, [-12, 0]), add(k.legR.mid, [12, 0]),
      add(k.legL.end, [-16, -4]), add(k.legL.end, [14, -4]), add(k.legR.end, [-16, -4]), add(k.legR.end, [14, -4])];
    s += `<path d="${hull(pts)}" fill="${c.mo}"/>`;
    for (let i = 1; i < 5; i++) { const a = lerp(add(waist, [-18, 12]), add(waist, [18, 12]), i / 5), b = lerp(add(lerp(k.legL.end, k.legR.end, i / 5), [-6, -6]), add(lerp(k.legL.end, k.legR.end, i / 5), [6, -6]), .5);
      s += `<path d="M${P(a)} L${P(lerp(a, b, .9))}" stroke="${c.moDark}" stroke-width="1.4" opacity=".7"/>`; }
  }
  // 上衣：女は腰丈、子どもはひざ丈
  const hemDepth = child ? .55 : .18;
  const hemL = lerp(k.hl, k.legL.mid, hemDepth), hemR = lerp(k.hr, k.legR.mid, hemDepth);
  const top = [add(k.sl, [-5, -5]), add(k.sr, [5, -5]), add(neckBase, [0, -7]), add(k.hl, [-13, 6]), add(k.hr, [13, 6]), add(hemL, [-12, 4]), add(hemR, [12, 4])];
  s += `<path d="${hull(top)}" fill="${c.cloth}"/>`;
  s += `<path d="M${P(add(neckBase, [8, 4]))} L${P(add(k.sr, [5, -4]))} L${P(add(hemR, [12, 4]))} L${P(lerp(add(hemL, [-12, 4]), add(hemR, [12, 4]), .65))} Z" fill="${c.clothDark}" opacity=".4"/>`;
  // 衿（右前）とひもの帯。後ろ姿は衿の代わりに背縫いと、うなじの衿
  if (o.back) s += `<path d="M${P(neckBase)} L${P(waist)}" stroke="${c.clothDark}" stroke-width="1.6"/><path d="M${P(add(neckBase, [-7, 1]))} Q${P(add(neckBase, [0, 5]))} ${P(add(neckBase, [7, 1]))}" stroke="${c.eri}" stroke-width="4" fill="none"/>`;
  else {
  s += `<path d="M${P(add(neckBase, [-6, -1]))} L${P(add(neckBase, [1, 14]))}" stroke="${c.eriDark}" stroke-width="${child ? 4 : 5}" stroke-linecap="round"/>`;
  s += `<path d="M${P(add(neckBase, [6, -1]))} L${P(lerp(add(k.hl, [-6, 0]), waist, .3))}" stroke="${c.eri}" stroke-width="${child ? 4.6 : 6}" stroke-linecap="round"/>`;
  }
  s += seg(add(waist, [-19, 2]), add(waist, [19, 2]), child ? 4 : 5, c.belt);
  s += `<path d="M${P(add(waist, [-8, 4]))} q-2 10 1 16" stroke="${c.belt}" stroke-width="2" fill="none" stroke-linecap="round"/>`;
  // 首と頭
  s += `<path d="M${P(add(neckBase, [-5, 3]))} L${P(add(k.neckTop, [-5, 0]))} L${P(add(k.neckTop, [5, 0]))} L${P(add(neckBase, [5, 3]))} Z" fill="${c.skin}"/>`;
  // 後ろ姿で肩ごしに振り向く：顔は右の端（ほお・片目・鼻・口もと）だけが見え、残りは後ろ髪に隠れる
  if (o.back && o.lookBack) s += placeHead(k.head, 1, k.headTilt || 0,
    face({kind: 'female', type: profile, dirty, mood: o.mood || 'smile', skin: c.skin, skinDark: c.skinDark, brow: c.hair, eye: '#2a1d2a'}) +
    `<path d="M-22 -2 Q-24 -28 -2 -29 Q14 -29 16 -18 Q8 -14 6 -2 Q5 12 8 22 Q0 30 -12 26 Q-24 16 -22 -2 Z" fill="${c.hair}"/>` +
    `<path d="M-4 20 Q-2 46 -6 62 L2 62 Q4 40 6 20 Z" fill="${c.hair}"/><rect x="-6" y="20" width="10" height="4" rx="2" fill="#d8c49a"/>`);
  else if (o.back) s += placeHead(k.head, 1, k.headTilt || 0, `<ellipse cx="-15" cy="4" rx="4" ry="7" fill="${c.skin}"/><ellipse cx="17" cy="4" rx="4" ry="7" fill="${c.skin}"/><ellipse cx="1" cy="-2" rx="19" ry="25" fill="${c.hair}"/><path d="M-6 18 Q1 46 -2 62 L6 62 Q6 40 8 18 Z" fill="${c.hair}"/><rect x="-4" y="18" width="10" height="4" rx="2" fill="#d8c49a"/>`);
  else s += placeHead(k.head, 1, k.headTilt || 0, face({kind: 'female', type: profile, dirty, mood: o.mood, old: o.old, skin: c.skin, skinDark: c.skinDark, brow: o.brow || c.hair, eye: '#2a1d2a'}) + hairSvg(o.hair, c.hair));
  // 頭にのせた水がめ
  // 頭にのせた水がめ：頭頂の輪（わら・布の当て物）の上、体の重心の真上に置く
  if (o.jarHead) { const t0 = add(k.head, [1, -26]); const t = [0, 0]; let js = '';
    js += `<ellipse cx="${r1(t[0])}" cy="${r1(t[1])}" rx="13" ry="4" fill="#c9b07a"/><ellipse cx="${r1(t[0])}" cy="${r1(t[1] - 1)}" rx="8" ry="2" fill="#a88f58"/>`;
    js += `<path d="M${r1(t[0] - 9)} ${r1(t[1] - 1)} Q${r1(t[0] - 22)} ${r1(t[1] - 16)} ${r1(t[0] - 10)} ${r1(t[1] - 30)} L${r1(t[0] + 10)} ${r1(t[1] - 30)} Q${r1(t[0] + 22)} ${r1(t[1] - 16)} ${r1(t[0] + 9)} ${r1(t[1] - 1)} Z" fill="#b5703c"/>`;
    js += `<path d="M${r1(t[0] + 6)} ${r1(t[1] - 26)} Q${r1(t[0] + 18)} ${r1(t[1] - 16)} ${r1(t[0] + 8)} ${r1(t[1] - 3)}" stroke="#94552a" stroke-width="3" fill="none"/><ellipse cx="${r1(t[0])}" cy="${r1(t[1] - 30)}" rx="10" ry="3" fill="#7a4a24"/>`; 
    s += `<g transform="translate(${P(t0)}) scale(1.4)">${js}</g>`; }
  if (o.midFront) s += o.midFront;
  // 手前の腕
  s += arm(k.armL, k.sl, 1, o.handL || 'relaxed');
  if (o.overFront) s += o.overFront;
  if (o.jarHip) { const j = add(k.armL.end, [-2, 6]); s += `<path d="M${P(add(j, [-12, -14]))} q-12 14 -4 28 q16 10 32 0 q8 -14 -4 -28 z" fill="#b5703c"/><ellipse cx="${r1(j[0] + 4)}" cy="${r1(j[1] - 14)}" rx="12" ry="3.6" fill="#7a4a24"/>` + hand(k.armL.end, ang(k.armL.mid, k.armL.end), c.skin, {kind: 'grip', size: .85}); }
  return s;
}
// 置く：足もとの基準（120, 334）を (x, y) に、倍率 s、f=-1 で左右反転（画面の左向き）
const place = (svg, x, y, s, f = 1) => `<g transform="translate(${r1(x)} ${r1(y)}) scale(${r1(s * f * 100) / 100} ${s}) translate(-120 -334)">${svg}</g>`;

const C = {
  ochre: {skin: '#dfaf88', skinDark: '#bb855f', cloth: '#e6dcc3', clothDark: '#c9bb97', mo: '#b9a27a', moDark: '#9a845e', eri: '#6f8fb0', eriDark: '#55728f', belt: '#6e5638', hair: '#231a14'},
  indigo: {skin: '#e3b992', skinDark: '#c08f69', cloth: '#d9dfe3', clothDark: '#b7c0c6', mo: '#5f7f9e', moDark: '#4b6680', eri: '#2f5b9a', eriDark: '#22457a', belt: '#7a4a3a', hair: '#1d1a2b'},
  brown: {skin: '#d9aa83', skinDark: '#b8815d', cloth: '#d8c8a6', clothDark: '#b8a47e', mo: '#8f6e4e', moDark: '#74583c', eri: '#a8483a', eriDark: '#86382c', belt: '#4f3a26', hair: '#2b2118'},
  old: {skin: '#d7aa88', skinDark: '#b38a6b', cloth: '#c9bda4', clothDark: '#a99c82', mo: '#857a66', moDark: '#6c6252', eri: '#7a7a6e', eriDark: '#5f5f55', belt: '#4f3a26', hair: '#d6d2cb'},
  childA: {skin: '#f0c19a', skinDark: '#d39d76', cloth: '#e9dfc8', clothDark: '#cbbd98', eri: '#a8483a', eriDark: '#86382c', belt: '#6e5638', hair: '#231a14'},
  childB: {skin: '#ecbb94', skinDark: '#cf9a74', cloth: '#c7d3c0', clothDark: '#a7b59e', eri: '#2f5b9a', eriDark: '#22457a', belt: '#6e5638', hair: '#2b2118'},
};

function scene() {
  let s = `<rect width="480" height="360" fill="${grad([[0, '#b4dcf2'], [.6, '#d8eef8'], [1, '#f1f9fc']])}"/>`;
  s += `<path d="M50 50 q10 -10 24 -4 q12 -8 22 2 q10 0 8 8 h-56 q-6 -4 2 -6 z M330 36 q8 -8 18 -2 q10 -6 18 2 q8 0 6 6 h-46 q-4 -4 4 -6z" fill="#ffffff" opacity=".85"/>`;
  // 低い台地と、右手の入江
  s += `<path d="M0 186 Q80 180 170 184 Q220 188 250 200 H0 Z" fill="${grad([[0, '#9cc583'], [1, '#86b46c']])}"/>`;
  { const r = rnd0(5); for (let x = 4; x < 230; x += 9 + r() * 10) { const rr = 4 + r() * 4; s += `<circle cx="${r1(x)}" cy="${r1(186 - rr * .5 + (x > 160 ? (x - 160) * .14 : 0))}" r="${r1(rr)}" fill="${r() > .5 ? '#7aa866' : '#86b46c'}"/>`; } }
  s += `<path d="M250 200 H480 V250 Q420 236 360 234 Q300 230 270 214 Z" fill="${grad([[0, '#9ccfe5'], [1, '#7fbcd9']])}"/>`;
  s += `<path d="M300 210 h30 M360 220 h40 M420 208 h34" stroke="#ffffff" stroke-width="1.6" stroke-linecap="round" opacity=".55"/>`;
  // 里の地面
  s += `<path d="M0 200 H250 Q270 214 300 230 Q360 234 420 236 Q450 240 480 250 V360 H0 Z" fill="${grad([[0, '#e6d5a6'], [1, '#d2b984']])}"/>`;
  s += `<path d="M268 212 Q300 228 360 232 Q420 234 480 248" stroke="#f3e6c0" stroke-width="3" fill="none" opacity=".8"/>`;
  // 伏屋（左奥）
  const fuseya = (x, y, w) => `<path d="M${x - w / 2} ${y} Q${x - w * .42} ${y - w * .5} ${x - w * .12} ${y - w * .62} L${x + w * .12} ${y - w * .62} Q${x + w * .42} ${y - w * .5} ${x + w / 2} ${y} Z" fill="#c4a76c"/><path d="M${x - w * .14} ${y - w * .62} l${w * .14} -${w * .16} l${w * .14} ${w * .16} z" fill="#8a6c3c"/><path d="M${x - w * .36} ${y - w * .18} q${w * .36} -${w * .08} ${w * .72} 0" stroke="#8a6c3c" stroke-width="2" fill="none" opacity=".6"/><path d="M${x - w * .1} ${y} v-${w * .18} q${w * .1} -${w * .08} ${w * .2} 0 v${w * .18} z" fill="#4a3720"/>`;
  s += fuseya(46, 222, 70) + fuseya(132, 214, 52);
  // 干した布（竿にかけた麻布）
  s += `<path d="M176 196 V226 M222 196 V226" stroke="#7a5a34" stroke-width="2.4"/><path d="M174 198 H224" stroke="#7a5a34" stroke-width="2"/><path d="M180 199 h18 v20 q-9 3 -18 0 z" fill="#ece4cf"/><path d="M201 199 h18 v16 q-9 3 -18 0 z" fill="#7a9ab8"/>`;
  // 位置のめやす：人物の足もとの基準（120, 334）を (x, y) に、倍率 sc、向き f で置いたときの画面の座標
  const at = (q, x, y, sc, f = 1) => [x + (q[0] - 120) * sc * f, y + (q[1] - 334) * sc];
  const wx = 236, wy = 262;
  const well = () => {
    let w = `<ellipse cx="${wx}" cy="${wy + 32}" rx="68" ry="10" fill="#c2a46f"/>`;
    w += `<path d="M${wx - 44} ${wy - 6} h88 l10 14 h-108 z" fill="${grad([[0, '#2c4d63'], [1, '#4f7e98']])}"/>`;
    w += `<path d="M${wx - 38} ${wy - 2} q38 5 76 0" stroke="#9fd3ea" stroke-width="2.5" fill="none" opacity=".8"/>`;
    for (let i = 0; i < 3; i++) w += `<rect x="${wx - 54}" y="${wy + 8 + i * 9}" width="108" height="9" rx="3" fill="${i % 2 ? '#8a5a30' : '#7a4c26'}"/>`;
    w += `<rect x="${wx - 58}" y="${wy + 2}" width="9" height="34" rx="3" fill="#6a4020"/><rect x="${wx + 49}" y="${wy + 2}" width="9" height="34" rx="3" fill="#6a4020"/>`;
    return w + `<rect x="${wx - 62}" y="${wy}" width="124" height="8" rx="3" fill="#9a6a3a"/>`;
  };
  // 曲物の木桶。tilt で傾ける
  const bucket = (x, y, tilt = 0, sc = 1, water = true) => `<g transform="translate(${r1(x)} ${r1(y)}) rotate(${tilt}) scale(${sc})">` +
    `<path d="M-10 -9 L10 -9 L9 9 L-9 9 Z" fill="#c8a46a"/><path d="M-10 -4 h20 M-9.6 4 h19" stroke="#9a7a48" stroke-width="2"/>` +
    (water ? `<ellipse cx="0" cy="-9" rx="10" ry="2.6" fill="#7fbcd9"/>` : '') + `<path d="M-9 -9 Q0 -22 9 -9" stroke="#8a6a3a" stroke-width="1.6" fill="none"/></g>`;
  const jar = (x, y, sc = 1) => `<g transform="translate(${r1(x)} ${r1(y)}) scale(${sc})"><path d="M-10 -30 Q-26 -14 -12 0 Q0 6 12 0 Q26 -14 10 -30 Z" fill="#b5703c"/>` +
    `<path d="M6 -27 Q20 -14 9 -2" stroke="#94552a" stroke-width="3" fill="none"/><ellipse cx="0" cy="-30" rx="11" ry="3.4" fill="#7a4a24"/><ellipse cx="0" cy="-30.4" rx="7.4" ry="2" fill="#4d6f8f"/></g>`;

  // ---- いちばん奥：水がめを頭にのせ、伏屋のほうへ帰っていく女（後ろ姿）。頭・体・足の重心が一直線
  const R = skeleton(FEMALE, {pelvis: [120, 182], chest: [120, 88], ankleL: [108, 334], ankleR: [134, 326], kneeL: -1, kneeR: -1,
    wristL: [104, 196], wristR: [140, 8], elbowL: 1, elbowR: -1, headDx: 0, headTilt: 0, liftR: 6});
  s += place(person(R, {colors: C.ochre, back: true, lookBack: true, mood: 'smile', hair: 'tied', skirt: 'long', jarHead: true, handR: 'open'}), 150, 276, .38);
  // 奥：丸太に腰かけ、身ぶりをまじえて笑う白髪の老女（右向き）
  s += `<rect x="18" y="286" width="84" height="13" rx="6.5" fill="#8a5a30"/><ellipse cx="102" cy="292" rx="5" ry="6.5" fill="#b07a44"/>`;
  const O = skeleton(FEMALE, {pelvis: [112, 236], chest: [126, 158], shoulderTilt: .06, ankleL: [150, 334], ankleR: [166, 332], kneeL: -1, kneeR: -1,
    wristL: [176, 196], wristR: [170, 252], elbowL: 1, elbowR: 1, headDx: 6, headTilt: 4});
  s += place(person(O, {colors: C.old, hair: 'oldbun', brow: '#a8a39b', old: true, mood: 'laugh', skirt: 'long', handL: 'open'}), 44, 310, .44);
  s += well();
  // ---- 井戸の右：縄をたぐって、水の入った木桶を井戸から引き上げる女（左向き）。腰を落とし、上体を後ろへ引く
  const Pk = skeleton(FEMALE, {pelvis: [100, 188], chest: [90, 100], ankleL: [92, 334], ankleR: [132, 330], kneeL: -1, kneeR: -1,
    wristL: [150, 112], wristR: [138, 146], elbowL: -1, elbowR: -1, headDx: 4, headTilt: 12});
  const px = 300, py = 304, ps = .47;
  s += place(person(Pk, {colors: C.indigo, hair: 'tied', mood: 'smile', skirt: 'long', handL: 'grip', handR: 'grip'}), px, py, ps, -1);
  const h1 = at(Pk.wristL, px, py, ps, -1), h2 = at(Pk.wristR, px, py, ps, -1);
  // 井戸の中から桶まで張った縄、桶から手へ、手からたぐった縄の余りが足もとへ
  const bx = wx + 14, by = wy - 30;
  s += `<path d="M${bx} ${by - 12} L${r1(h2[0])} ${r1(h2[1])} L${r1(h1[0])} ${r1(h1[1])}" stroke="#a88a5a" stroke-width="1.8" fill="none"/>`;
  s += `<path d="M${r1(h1[0])} ${r1(h1[1])} Q${r1(h1[0] + 18)} ${r1(h1[1] + 30)} ${r1(px + 10)} ${py - 2} q12 4 20 -2" stroke="#a88a5a" stroke-width="1.6" fill="none"/>`;
  s += bucket(bx, by, -8, 1.1);
  s += `<path d="M${bx - 6} ${by + 11} q1 6 -1 10 M${bx + 4} ${by + 11} q2 8 0 14" stroke="#9fd3ea" stroke-width="1.6" fill="none" stroke-linecap="round"/><circle cx="${bx - 2}" cy="${by + 30}" r="1.4" fill="#9fd3ea"/>`;
  // ---- 井戸の左手前：井戸のふちに手をかけて、のぞきこむ子（右向き）
  const K1 = skeleton(CHILD, {pelvis: [114, 250], chest: [128, 204], ankleL: [104, 330], ankleR: [122, 326], kneeL: -1, kneeR: -1,
    wristL: [164, 232], wristR: [156, 236], elbowL: 1, elbowR: 1, headDx: 4, headTilt: 18, liftL: 8, liftR: 8});
  s += place(person(K1, {child: true, colors: C.childB, hair: 'tufts', mood: 'laugh', handL: 'grip', handR: 'grip'}), 168, 312, .54);
  // ---- 手前の左：木桶をかたむけて、地面の水がめへ水を移す女（右向き）。桶の重さで腰を少し落とし、ひじを張る
  const Q = skeleton(FEMALE, {pelvis: [112, 188], chest: [134, 104], shoulderTilt: .06, ankleL: [98, 334], ankleR: [134, 334], kneeL: -1, kneeR: -1,
    wristL: [176, 196], wristR: [160, 176], elbowL: 1, elbowR: 1, headDx: 6, headTilt: 20});
  const pour = bucket(184, 180, 52, 1.5, false) +
    `<path d="M190 196 Q200 214 202 256" stroke="#8fc7ea" stroke-width="5" fill="none" stroke-linecap="round" opacity=".9"/><path d="M193 200 Q201 220 203 254" stroke="#ffffff" stroke-width="1.4" fill="none" opacity=".8"/>` +
    jar(204, 300, 1.35).replace('<ellipse cx="0" cy="-30.4" rx="7.4" ry="2" fill="#4d6f8f"/>', '<ellipse cx="0" cy="-30.4" rx="7.4" ry="2" fill="#8fc7ea"/><path d="M-6 -32 q6 -5 12 0" stroke="#ffffff" stroke-width="1.2" fill="none"/>');
  s += place(person(Q, {colors: C.brown, hair: 'bun', mood: 'smile', skirt: 'long', handL: 'grip', handR: 'grip', overFront: pour}), 96, 336, .54);
  // ---- 手前の右：水の入った大きな水がめを、腰に当てて体に抱き寄せる女（左向き）。重さで上体を反らし、肩を下げる
  const H = skeleton(FEMALE, {pelvis: [124, 182], hipTilt: -3, chest: [112, 92], shoulderTilt: -.1, ankleL: [100, 334], ankleR: [140, 334], kneeL: -1, kneeR: -1,
    wristL: [148, 238], wristR: [140, 170], elbowL: -1, elbowR: 1, headDx: -2, headTilt: -10});
  const hip = jar(126, 238, 1.55);
  s += place(person(H, {colors: C.ochre, hair: 'tied', mood: 'talk', skirt: 'long', handL: 'grip', handR: 'grip', midFront: hip}), 404, 344, .55, -1);
  // ---- 右の女のすそにつかまり、見上げる小さな子（左向き）
  const K2 = skeleton(CHILD, {pelvis: [120, 244], chest: [118, 198], ankleL: [108, 334], ankleR: [130, 334], kneeL: -1, kneeR: -1,
    wristL: [98, 230], wristR: [104, 240], elbowL: -1, elbowR: -1, headDx: -2, headTilt: -22});
  s += place(person(K2, {child: true, colors: C.childA, hair: 'bob', mood: 'smile', handL: 'grip', handR: 'grip'}), 352, 350, .5, -1);
  return s;
}

// ほかの場面（漁・浜）からも人物の部品を使えるようにする
module.exports = {person, place, hull, hairSvg, CHILD, C, rnd0};
if (require.main === module) {
  const out = process.argv[2];
  defs = []; gid = 0;
  const body = scene();
  fs.writeFileSync(path.join(out, 'ido-bata.svg'), `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="360" viewBox="0 0 480 360"><title>ido-bata</title><defs>${defs.join('')}</defs>${body}</svg>\n`);
  console.log('1 file');
}
