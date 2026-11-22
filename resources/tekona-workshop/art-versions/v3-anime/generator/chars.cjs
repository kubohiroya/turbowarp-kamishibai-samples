// 手児奈・求婚者の立ち絵（アニメ調）。240x380, viewBox 0 -20 240 380, 回転中心 120,190。
// 考証メモ resources/tekona-workshop/research-notes.md の 2.3・3.1 にもとづく衣装。
// 描き方：細い輪郭線＋アニメ塗り（光は左上、影1段）、6頭身前後。
const fs = require('fs');
const path = require('path');

const LINE = '#3a2620';
const LW = 1.7;
const SKIN = '#fbe3d0', SKIN_SH = '#efc2a6', SKIN_LINE = '#8a5040';
const ol = (fill, w = LW) => `fill="${fill}" stroke="${LINE}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;
const pts = p => p.map(q => q.map(v => +v.toFixed(1)).join(',')).join(' ');

// 輪郭つきの筒（腕・袖）
function tube(p, w, fill, shade) {
  let s = `<polyline points="${pts(p)}" fill="none" stroke="${LINE}" stroke-width="${w + LW * 2}" stroke-linecap="round" stroke-linejoin="round"/>`;
  s += `<polyline points="${pts(p)}" fill="none" stroke="${fill}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
  if (shade) s += `<polyline points="${pts(p.map(([x, y]) => [x + w * 0.22, y + 1]))}" fill="none" stroke="${shade}" stroke-width="${w * 0.4}" stroke-linecap="round" stroke-linejoin="round"/>`;
  return s;
}
// 手：指をそろえた手。angle は指先の向き（度）
function hand([x, y], angle = 90, {open = false, flip = 1} = {}) {
  const fingers = open
    ? `<path d="M-3 -4 l9 -2 M-3 0 l11 0 M-3 4 l9 2" stroke="${SKIN_LINE}" stroke-width="0.9" stroke-linecap="round" fill="none"/>`
    : `<path d="M2 -3 q5 3 0 6" stroke="${SKIN_LINE}" stroke-width="0.9" fill="none"/>`;
  return `<g transform="translate(${x} ${y}) rotate(${angle - 90 + 90}) scale(1 ${flip})">` +
    `<path d="M-7 -6 q4 -2 9 -1 q${open ? 9 : 6} 1 ${open ? 11 : 8} 6 q-${open ? 2 : 2} 6 -${open ? 11 : 8} 7 q-6 0 -10 -3 q-2 -5 2 -9 z" ${ol(SKIN)}/>` +
    `<path d="M-2 -6 q3 -6 8 -4" ${ol(SKIN)}/>` + fingers + `</g>`;
}
const handAt = (p, from, opts) => hand(p, Math.atan2(p[1] - from[1], p[0] - from[0]) * 180 / Math.PI, opts);

// ---------------- 顔 ----------------
// f: -1=画面の左向き、+1=右向き。mood: smile | open | serious | proud | gentle | resolve | sad
function head({cx = 120, f = 0, mood = 'smile', iris = '#5a3424', brow = '#2a1a14', female = false, mustache = false, ears = true}) {
  const eyeS = female ? 1.18 : 1.05;
  const top = 4, eyeY = 38, chin = 60;
  const fx = f * 4;
  let s = '';
  // 耳（向きと反対側）
  if (f && ears) {
    const ex = cx - f * 20.5;
    s += `<path d="M${ex} 33 q${-f * 7} -2 ${-f * 7} 7 q0 7 ${f * 6} 9" ${ol(SKIN)}/><path d="M${ex - f * 2} 37 q${-f * 3} 2 0 6" stroke="${SKIN_LINE}" stroke-width="1" fill="none"/>`;
  }
  // 顔の輪郭（あごを向きの側へ）
  s += `<path d="M${cx - 21} 24 C${cx - 22} 41 ${cx - 14 + fx * 0.6} 54 ${cx + fx} ${chin} C${cx + 14 + fx * 0.6} 54 ${cx + 22} 41 ${cx + 21} 24 C${cx + 21} ${top} ${cx - 21} ${top} ${cx - 21} 24 Z" ${ol(SKIN)}/>`;
  // 髪の影（額）
  s += `<path d="M${cx - 19} 24 q19 9 38 0 q-19 4 -38 0 z" fill="${SKIN_SH}" opacity=".8"/>`;
  const eye = (x, near, kind) => {
    const sx = near ? 1 : 0.82;
    let e = `<g transform="translate(${x} ${eyeY}) scale(${sx * eyeS} ${eyeS})">`;
    if (kind === 'closedUp') {
      e += `<path d="M-6 1 q6 -6 12 0" stroke="${LINE}" stroke-width="2.2" fill="none" stroke-linecap="round"/>`;
    } else if (kind === 'closedDown') {
      e += `<path d="M-6 -1 q6 5 12 0" stroke="${LINE}" stroke-width="2.2" fill="none" stroke-linecap="round"/><path d="M-6.5 -1 l-2 -1.5" stroke="${LINE}" stroke-width="1.4" stroke-linecap="round"/>`;
    } else {
      const h = kind === 'half' ? 0.62 : 1;
      e += `<path d="M-6.5 ${-5 * h + 1} q6.5 -3 13 0 v${9 * h} q-6.5 3 -13 0 z" fill="#fffaf4"/>`;
      e += `<ellipse cx="${f * 0.8}" cy="${0.5 + (1 - h) * 2}" rx="4.4" ry="${6 * h}" fill="url(#iris)"/>`;
      e += `<ellipse cx="${f * 0.8}" cy="${2.6 + (1 - h) * 2}" rx="3.2" ry="${3 * h}" fill="#ffffff" opacity=".22"/>`;
      e += `<ellipse cx="${f * 0.8}" cy="${0.8 + (1 - h) * 2}" rx="2" ry="${3 * h}" fill="#1c100c"/>`;
      e += `<circle cx="${f * 0.8 - 1.6}" cy="${-2 + (1 - h) * 3}" r="1.6" fill="#fff"/><circle cx="${f * 0.8 + 1.8}" cy="${3 + (1 - h)}" r=".8" fill="#fff"/>`;
      e += `<path d="M-7.5 ${-4.5 * h + 1} q7 -${female ? 4.5 : 3.5} 14 -0.5 ${female ? 'l2 -1' : ''}" stroke="${LINE}" stroke-width="${female ? 2.3 : 2.1}" fill="none" stroke-linecap="round"/>`;
      e += `<path d="M-4 ${5 * h + 0.5} q4 1.2 8 0" stroke="${LINE}" stroke-width=".9" fill="none" opacity=".7"/>`;
      if (kind === 'sad') e += `<path d="M-4 9 q1 3 0 5" stroke="#9fd0ee" stroke-width="1.6" fill="none" stroke-linecap="round"/>`;
    }
    return e + `</g>`;
  };
  const ex1 = cx - 9.8 + f * 3.2, ex2 = cx + 9.8 + f * 3.2;
  const near1 = f >= 0, near2 = f <= 0;
  const kinds = {smile: 'open', open: 'open', serious: 'open', proud: 'closedUp', gentle: 'closedUp', resolve: 'open', sad: 'closedDown', worried: 'half'};
  const k = kinds[mood] || 'open';
  s += eye(ex1, near1, k) + eye(ex2, near2, k);
  // 眉
  const browTilt = {serious: 1.6, resolve: 1.4, sad: -2.2, worried: -2, gentle: -0.8, proud: 0.4}[mood] || 0;
  const browLift = {proud: -2, sad: 0, worried: -1, smile: -1}[mood] || 0;
  s += `<path d="M${ex1 - 5} ${eyeY - 9 + browLift - browTilt} q5 -2.5 ${10} ${browTilt * 1.2}" stroke="${brow}" stroke-width="${female ? 1.3 : 1.9}" fill="none" stroke-linecap="round"/>`;
  s += `<path d="M${ex2 + 5} ${eyeY - 9 + browLift - browTilt} q-5 -2.5 ${-10} ${browTilt * 1.2}" stroke="${brow}" stroke-width="${female ? 1.3 : 1.9}" fill="none" stroke-linecap="round"/>`;
  // 鼻
  const nx = cx + f * 6.5;
  s += `<path d="M${nx} 44 l${f * 1.8} 4.5 l${-f * 2.2} .6" stroke="${SKIN_LINE}" stroke-width="1.1" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
  // 口
  const mx = cx + f * 4.5, my = 53.5;
  const mouths = {
    smile: `<path d="M${mx - 4.5} ${my - .5} q4.5 3.5 9 0" stroke="${SKIN_LINE}" stroke-width="1.5" fill="none" stroke-linecap="round"/>`,
    open: `<path d="M${mx - 5} ${my - 1.5} q5 7 10 0 z" fill="#b8545a" stroke="${SKIN_LINE}" stroke-width="1.2" stroke-linejoin="round"/><path d="M${mx - 2.5} ${my + 2} q2.5 1.5 5 0" stroke="#f08b90" stroke-width="1.4" fill="none"/>`,
    proud: `<path d="M${mx - 6} ${my - 2} q6 9 12 0 z" fill="#b8545a" stroke="${SKIN_LINE}" stroke-width="1.2" stroke-linejoin="round"/><path d="M${mx - 5} ${my - 1.6} h10 v1.6 h-10 z" fill="#fff"/>`,
    serious: `<path d="M${mx - 3.5} ${my} h7" stroke="${SKIN_LINE}" stroke-width="1.5" stroke-linecap="round"/>`,
    gentle: `<path d="M${mx - 3.5} ${my - .3} q3.5 2.6 7 0" stroke="${SKIN_LINE}" stroke-width="1.4" fill="none" stroke-linecap="round"/>`,
    resolve: `<path d="M${mx - 3.5} ${my} q3.5 1.6 7 -.4" stroke="${SKIN_LINE}" stroke-width="1.5" fill="none" stroke-linecap="round"/>`,
    sad: `<path d="M${mx - 4} ${my + 1.5} q4 -3.5 8 0" stroke="${SKIN_LINE}" stroke-width="1.5" fill="none" stroke-linecap="round"/>`,
    worried: `<path d="M${mx - 3.5} ${my + 1} q1.5 -2 3.5 0 q2 2 3.5 0" stroke="${SKIN_LINE}" stroke-width="1.4" fill="none" stroke-linecap="round"/>`,
  };
  s += mouths[mood] || mouths.smile;
  if (mustache) s += `<path d="M${mx - 8} ${my - 5} q4 -3 8 -.6 q4 -2.4 8 .6" stroke="${brow}" stroke-width="1.8" fill="none" stroke-linecap="round"/>`;
  // ほお
  const blush = mood === 'sad' ? .25 : female ? .55 : .35;
  for (const x of [ex1, ex2]) {
    s += `<ellipse cx="${x}" cy="48" rx="5.5" ry="2.6" fill="#f4a0a0" opacity="${blush}"/>`;
    s += `<path d="M${x - 3} 49 l2 -2.4 M${x} 49 l2 -2.4 M${x + 3} 49 l2 -2.4" stroke="#e07a7a" stroke-width=".8" opacity="${blush}"/>`;
  }
  return s;
}
const neck = (cx = 120, dy = 0) =>
  `<path d="M${cx - 7} 52 L${cx - 7.5} ${76 + dy} L${cx + 7.5} ${76 + dy} L${cx + 7} 52 Z" ${ol(SKIN)}/><path d="M${cx - 7} 58 q7 6 14 0 v6 q-7 4 -14 0 z" fill="${SKIN_SH}"/>`;
const gloom = (x, y) =>
  `<g stroke="#5466a0" stroke-width="1.6" opacity=".7" stroke-linecap="round"><path d="M${x - 12} ${y} v12 M${x - 6} ${y - 3} v16 M${x} ${y - 4} v17 M${x + 6} ${y - 3} v16 M${x + 12} ${y} v12"/></g>`;
const drop = (x, y, s = 1) => `<path d="M${x} ${y} q${5 * s} ${8 * s} 0 ${11 * s} q${-5 * s} -3 0 ${-11 * s} z" fill="#bfe4f8" stroke="#5a9cc8" stroke-width="1"/>`;
const sparkle = (x, y, r, c = '#f7d96a') => `<path d="M${x} ${y - r} q${r * .18} ${r * .82} ${r} ${r} q${-r * .82} ${r * .18} ${-r} ${r} q${-r * .18} ${-r * .82} ${-r} ${-r} q${r * .82} ${-r * .18} ${r} ${-r} z" fill="${c}"/>`;
const heart = (x, y, r, c = '#ee6a82') => `<path d="M${x} ${y + r * .9} C${x - r * 1.6} ${y - r * .2} ${x - r * .9} ${y - r * 1.3} ${x} ${y - r * .45} C${x + r * .9} ${y - r * 1.3} ${x + r * 1.6} ${y - r * .2} ${x} ${y + r * .9} Z" fill="${c}" stroke="#a83a52" stroke-width="1"/>`;

// 頭の傾き（うつむき）をかけるラッパ
const tiltHead = (svg, deg, dx = 0, dy = 0) => `<g transform="translate(${dx} ${dy}) rotate(${deg} 120 60)">${svg}</g>`;

// ---------------- 手児奈 ----------------
const TK = {cloth: '#f2ebda', clothSh: '#d9ccae', mo: '#e7dcc2', moSh: '#cbbd9b', eri: '#2f5b9a', eriSh: '#22457a',
  hair: '#1e1a2c', hairHi: '#4a4a7a', iris: '#3f2a3a'};
function tekonaHairBack(sway = 0) {
  return `<path d="M99 14 C84 24 82 60 84 100 C86 130 ${88 + sway} 150 ${90 + sway} 168 L${98 + sway} 162 L${104 + sway} 170 L${112 + sway} 163 L${120 + sway} 171 L${128 + sway} 163 L${136 + sway} 170 L${142 + sway} 162 L${150 + sway} 168 C${152 + sway} 150 154 130 156 100 C158 60 156 24 141 14 Z" ${ol(TK.hair)}/>` +
    `<path d="M${94 + sway} 120 q2 24 ${2 + sway * .2} 40 M${146 + sway} 120 q-1 24 ${0 + sway * .2} 40" stroke="${TK.hairHi}" stroke-width="1.2" fill="none" opacity=".7"/>`;
}
function tekonaHairFront(f = 1) {
  const d = f * 2;
  // 中央で分けた前髪（毛先をとがらせる）と、胸の前へ垂れる横の髪。飾りはつけない
  return `<path d="M98 32 C94 8 108 -1 120 -1 C134 -1 148 6 143 32 Q140 24 137 31 Q134 20 129 16 Q128 24 124 28 Q${123 + d} 16 ${121 + d} 9 Q${117 + d} 20 112 27 Q110 20 110 16 Q105 22 103 31 Q101 24 98 32 Z" ${ol(TK.hair)}/>` +
    `<path d="M104 7 q16 -8 32 0" stroke="${TK.hairHi}" stroke-width="3" fill="none" stroke-linecap="round" opacity=".85"/>` +
    `<path d="M99 20 C93 50 92 86 95 118 L99 112 L102 120 C102 90 100 56 102 36 Z" ${ol(TK.hair)}/>` +
    `<path d="M141 20 C147 50 148 86 145 118 L141 112 L138 120 C138 90 140 56 138 36 Z" ${ol(TK.hair)}/>`;
}
function shitsuObi(y) {
  let s = `<path d="M94 ${y} Q120 ${y + 3} 146 ${y} L147 ${y + 8} Q120 ${y + 11} 93 ${y + 8} Z" ${ol('#7a4a3a')}/>`;
  const cols = ['#2f5b9a', '#efe2c4', '#a8483a', '#efe2c4'];
  for (let i = 0; i < 13; i++) s += `<rect x="${95.5 + i * 4}" y="${y + 1.2}" width="1.8" height="6.6" fill="${cols[i % 4]}"/>`;
  return s + `<path d="M104 ${y + 8} q-2 12 1 22 M108 ${y + 8} q2 10 6 18" stroke="#7a4a3a" stroke-width="2.2" fill="none" stroke-linecap="round"/>`;
}
function tekonaBody() {
  let s = '';
  // 裳（ひだのある長い衣）
  s += `<path d="M96 146 L144 146 L162 336 Q120 342 78 336 Z" ${ol(TK.mo)}/>`;
  s += `<path d="M132 150 L144 146 L162 336 Q150 338 140 339 Z" fill="${TK.moSh}"/>`;
  for (const [a, b] of [[104, 92], [112, 108], [120, 121], [128, 134], [136, 148]]) s += `<path d="M${a} 172 L${b} 336" stroke="${TK.moSh}" stroke-width="1.3"/>`;
  // はだし
  s += `<path d="M100 336 q-8 1 -10 6 q8 4 20 2 l-1 -8 z" ${ol(SKIN)}/><path d="M132 336 q-1 6 2 8 q12 2 18 -2 q-4 -5 -12 -6 z" ${ol(SKIN)}/>`;
  // 麻の上衣（腰丈）
  s += `<path d="M100 76 Q120 72 140 76 L148 172 Q120 178 92 172 Z" ${ol(TK.cloth)}/>`;
  s += `<path d="M130 92 L140 78 L148 172 Q140 174 134 175 Z" fill="${TK.clothSh}"/>`;
  s += `<path d="M93 160 q27 6 54 0" stroke="${TK.clothSh}" stroke-width="2" fill="none"/>`;
  // 青い衿（右前：外側の衿は画面の右上から左下へ）
  s += `<path d="M112 72 L121 100 L126 98 L118 72 Z" ${ol(TK.eriSh)}/>`;
  s += `<path d="M126 72 L132 73 L104 172 L97 171 Z" ${ol(TK.eri)}/>`;
  s += shitsuObi(146);
  return s;
}
function tekona(pose) {
  const f = 1;
  const arm = p => tube(p, 13, TK.cloth, TK.clothSh);
  let s = tekonaHairBack(pose === 'resolve' ? -5 : 0) + tekonaBody() + neck();
  const face = mood => head({f, mood, iris: TK.iris, brow: TK.hair, female: true, ears: false}) + tekonaHairFront(f);
  if (pose === 'stand') {
    // 土師器の甕を両手でかかえる
    const L = [[101, 80], [92, 126], [106, 150]], R = [[139, 80], [148, 126], [134, 150]];
    s += face('smile') + arm(L) + arm(R);
    s += `<path d="M108 142 C92 150 92 182 108 190 Q120 195 132 190 C148 182 148 150 132 142 Z" ${ol('#b8703e')}/>`;
    s += `<path d="M128 146 C142 154 142 180 128 188 Q138 186 141 176 C146 160 140 148 132 144 Z" fill="#94552a"/>`;
    s += `<path d="M100 160 q20 5 40 0" stroke="#94552a" stroke-width="1.2" fill="none"/>`;
    s += `<path d="M105 142 Q120 136 135 142 L133 146 Q120 141 107 146 Z" ${ol('#a5602f')}/><ellipse cx="120" cy="142" rx="12" ry="2.6" fill="#47627a"/>`;
    s += `<path d="M104 150 q4 -3 8 1" stroke="#fff" stroke-width="2" opacity=".35" fill="none"/>`;
    s += handAt([106, 152], [92, 126]) + hand([134, 152], 50, {flip: -1});
    return s;
  }
  if (pose === 'refuse') {
    // やさしく、はっきり：手のひらを相手（上手）へ向ける
    const L = [[101, 80], [94, 128], [100, 178]], R = [[139, 80], [160, 112], [178, 88]];
    s += face('gentle') + arm(L) + arm(R);
    s += handAt([100, 180], [94, 128]);
    s += `<g transform="translate(182 80)"><path d="M-6 8 q-4 -10 0 -18 l2 -8 q2 -2 3 0 l0 7 l1 -9 q2 -2 3 0 l0 9 l1 -8 q2 -2 3 0 l0 9 l1 -6 q2 -2 3 0 q1 10 -3 18 q-6 6 -13 6 z" ${ol(SKIN)}/></g>`;
    s += drop(156, 20, .9);
    return s;
  }
  // resolve：両手を胸に当て、まっすぐ前を見る
  const L = [[101, 80], [94, 128], [114, 112]], R = [[139, 80], [146, 128], [126, 114]];
  s += face('resolve') + arm(L) + arm(R);
  s += hand([114, 110], -10) + hand([126, 113], 190, {flip: -1});
  s += `<g opacity=".9"><path d="M40 70 q6 -9 12 0 q-6 9 -12 0 z" fill="#f7c9d4" stroke="#d98aa0" stroke-width=".8"/><path d="M192 44 q5 -7 10 0 q-5 7 -10 0 z" fill="#f7c9d4" stroke="#d98aa0" stroke-width=".8"/><path d="M200 120 q4 -6 8 0 q-4 6 -8 0 z" fill="#f7c9d4" stroke="#d98aa0" stroke-width=".8"/></g>`;
  return s;
}

// ---------------- 里の若者 ----------------
const SATO = {cloth: '#d2ba8f', clothSh: '#ae956a', hakama: '#b49b70', hakamaSh: '#8e7650', cord: '#6a5034', hair: '#2a1d16', hairHi: '#5a4234', iris: '#5a3424'};
function satoHairBack() {
  return `<path d="M100 20 C98 32 99 40 100 44 L104 38 Z M140 20 C142 32 141 40 140 44 L136 38 Z" ${ol(SATO.hair)}/>`;
}
function satoHair(f = -1) {
  // 頭の上でまとめた髻と麻ひも、短い前髪
  return `<ellipse cx="${120 - f * 1}" cy="-4" rx="9" ry="8" ${ol(SATO.hair)}/>` +
    `<path d="M${112 - f} 0 h16 l-1 5 h-14 z" ${ol('#d8c49a')}/>` +
    `<path d="M98 30 C96 10 108 2 120 2 C134 2 146 10 142 30 L138 22 L134 28 L131 18 L124 26 L120 16 L114 26 L109 18 L105 28 Z" ${ol(SATO.hair)}/>` +
    `<path d="M108 9 q12 -6 24 0" stroke="${SATO.hairHi}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`;
}
function satoBody(drop = 0) {
  let s = '';
  // 麻の袴（ひざ下を足結で結ぶ）と、すね・はだし
  s += `<path d="M100 300 L100 334 L112 334 L112 300 Z" ${ol(SKIN)}/><path d="M128 300 L128 334 L140 334 L140 300 Z" ${ol(SKIN)}/>`;
  s += `<path d="M100 332 q-10 2 -12 8 q10 4 24 1 v-8 z" ${ol(SKIN)}/><path d="M128 332 q-10 2 -12 8 q10 4 24 1 v-8 z" ${ol(SKIN)}/>`;
  s += `<path d="M96 180 L92 266 Q100 300 110 300 L118 300 L120 206 L122 300 L130 300 Q140 300 148 266 L144 180 Z" ${ol(SATO.hakama)}/>`;
  s += `<path d="M128 206 L122 300 L130 300 Q140 300 148 266 L144 180 L136 184 Z" fill="${SATO.hakamaSh}"/>`;
  s += `<path d="M120 206 V298" stroke="${LINE}" stroke-width="1.2"/>`;
  s += `<path d="M95 294 q8 4 16 0 M125 294 q8 4 16 0" stroke="${SATO.cord}" stroke-width="3.2" fill="none" stroke-linecap="round"/>`;
  s += `<path d="M97 296 q-4 6 -6 9 M141 296 q4 6 6 9" stroke="${SATO.cord}" stroke-width="1.8" fill="none" stroke-linecap="round"/>`;
  // 麻の上衣（太もも丈）
  s += `<path d="M99 ${77 + drop} Q120 ${73 + drop} 141 ${77 + drop} L150 210 Q120 216 90 210 Z" ${ol(SATO.cloth)}/>`;
  s += `<path d="M132 ${94 + drop} L141 ${78 + drop} L150 210 Q142 212 136 213 Z" fill="${SATO.clothSh}"/>`;
  s += `<path d="M112 ${73 + drop} L121 100 L126 98 L118 ${73 + drop} Z" ${ol(SATO.clothSh)}/>`;
  s += `<path d="M126 ${73 + drop} L132 ${74 + drop} L106 209 L99 208 Z" ${ol('#c3a97c')}/>`;
  // ひもの帯と結び目
  s += `<path d="M92 150 Q120 156 148 150" stroke="${LINE}" stroke-width="6" fill="none"/><path d="M92 150 Q120 156 148 150" stroke="${SATO.cord}" stroke-width="3.6" fill="none"/>`;
  s += `<path d="M108 154 q-4 10 -2 18 M110 154 q3 9 8 14" stroke="${SATO.cord}" stroke-width="2.2" fill="none" stroke-linecap="round"/>`;
  return s;
}
function sato(pose) {
  const f = -1;
  const arm = p => tube(p, 15, SATO.cloth, SATO.clothSh);
  const face = mood => satoHairBack() + head({f, mood, iris: SATO.iris, brow: SATO.hair}) + satoHair(f);
  if (pose === 'stand') {
    const L = [[100, 82], [90, 130], [92, 180]], R = [[140, 82], [150, 130], [148, 180]];
    return satoBody() + neck() + face('smile') + arm(L) + arm(R) + handAt([92, 184], [90, 130]) + handAt([148, 184], [150, 130]);
  }
  if (pose === 'kime') {
    // 両うでで頭の上に大きなハート
    const L = [[100, 82], [72, 40], [80, 2], [112, -10]], R = [[140, 82], [168, 40], [160, 2], [128, -10]];
    return satoBody() + neck() + face('open') + arm(L) + arm(R) +
      hand([113, -10], 10) + hand([127, -10], 170, {flip: -1}) +
      heart(34, 120, 9) + heart(208, 80, 7) + heart(204, 140, 5);
  }
  // rejected：肩を落とし、両手を下に垂らしてうつむく
  const L = [[101, 88], [96, 138], [100, 188]], R = [[139, 88], [144, 138], [140, 188]];
  return satoBody(4) + neck(120, 4) + tiltHead(face('sad'), -9, -2, 6) + gloom(116, 14) + drop(150, 26) +
    arm(L) + arm(R) + handAt([100, 192], [96, 138]) + handAt([140, 192], [144, 138]);
}

// ---------------- 官人（国府の役人・都の貴族） ----------------
function zukinBack(f, c) {
  const b = -f;
  // 後ろに垂れる2本の纓
  return `<path d="M${120 + b * 14} 8 C${120 + b * 30} 20 ${120 + b * 34} 40 ${120 + b * 30} 62 L${120 + b * 36} 62 C${120 + b * 40} 40 ${120 + b * 36} 18 ${120 + b * 20} 4 Z" ${ol(c)}/>` +
    `<path d="M${120 + b * 18} 10 C${120 + b * 38} 22 ${120 + b * 44} 38 ${120 + b * 44} 54 L${120 + b * 49} 52 C${120 + b * 48} 34 ${120 + b * 42} 18 ${120 + b * 24} 6 Z" ${ol(c)}/>`;
}
function zukin(f, c = '#1c1a1e', hi = '#4a4652') {
  // 頭巾：頭をおおう黒い布。頂の髻のふくらみ
  return `<path d="M98 30 C94 6 108 -4 120 -4 C134 -4 147 6 142 30 C138 20 130 16 120 16 C110 16 102 20 98 30 Z" ${ol(c)}/>` +
    `<path d="M${109 - f * 2} 0 C${108 - f * 2} -18 ${132 - f * 2} -18 ${131 - f * 2} 0 Z" ${ol(c)}/>` +
    `<path d="M${114 - f * 2} -8 q6 -4 12 0" stroke="${hi}" stroke-width="2" fill="none" stroke-linecap="round"/>` +
    `<path d="M102 22 q18 -10 36 0" stroke="${hi}" stroke-width="1.5" fill="none"/>` +
    `<path d="M99 28 q-1 8 1 14 l3 -4 z M141 28 q1 8 -1 14 l-3 -4 z" fill="#1c1410"/>`;
}
const shaku = (x, y, angle = 0) =>
  `<g transform="rotate(${angle} ${x} ${y})"><path d="M${x - 4} ${y - 44} q4 -2 8 0 l1 50 q-5 2 -10 0 z" ${ol('#efe2c4')}/><path d="M${x + 2} ${y - 44} l2 50" stroke="#d2bf98" stroke-width="2"/></g>`;
function officialBody(o, drop = 0) {
  let s = '';
  if (o.sword) s += `<path d="M150 150 L196 252" stroke="${LINE}" stroke-width="7.4" stroke-linecap="round"/><path d="M150 150 L196 252" stroke="#3a2a1e" stroke-width="4.6" stroke-linecap="round"/><path d="M143 136 L152 156" stroke="${LINE}" stroke-width="6" stroke-linecap="round"/><path d="M143 136 L152 156" stroke="#d8b24a" stroke-width="3.6" stroke-linecap="round"/><circle cx="166" cy="186" r="3" ${ol('#e0bb4f')}/><circle cx="182" cy="221" r="3" ${ol('#e0bb4f')}/>`;
  // 白い袴と黒い履
  s += `<path d="M100 290 L98 330 L118 330 L120 300 L122 330 L142 330 L140 290 Z" ${ol('#f3eee2')}/><path d="M132 292 L140 290 L142 330 L132 330 Z" fill="#d9d2c2"/>`;
  s += `<path d="M98 328 q-12 2 -14 10 h34 v-10 z M122 328 q-12 2 -14 10 h34 v-10 z" ${ol('#22201f')}/><path d="M90 334 q6 -3 12 -3" stroke="#5a5656" stroke-width="1.5" fill="none"/>`;
  // 袍
  s += `<path d="M99 ${77 + drop} Q120 ${73 + drop} 141 ${77 + drop} L156 300 Q120 306 84 300 Z" ${ol(o.robe)}/>`;
  s += `<path d="M132 ${92 + drop} L141 ${78 + drop} L156 300 Q146 302 138 303 Z" fill="${o.robeSh}"/>`;
  s += `<path d="M106 172 L100 298 M128 172 L134 300" stroke="${o.robeSh}" stroke-width="1.4"/>`;
  s += `<path d="M86 282 q34 8 68 0" stroke="${o.robeSh}" stroke-width="3" fill="none"/>`;
  // 盤領（まるいえり）とひも
  s += `<path d="M104 ${74 + drop} Q120 ${96 + drop} 136 ${74 + drop}" stroke="${LINE}" stroke-width="7.4" fill="none" stroke-linecap="round"/><path d="M104 ${74 + drop} Q120 ${96 + drop} 136 ${74 + drop}" stroke="${o.robeSh}" stroke-width="4.4" fill="none" stroke-linecap="round"/>`;
  s += `<circle cx="133" cy="${82 + drop}" r="2.6" ${ol(o.robeSh)}/>`;
  // 帯と帯金具
  s += `<path d="M90 148 Q120 154 150 148 L151 158 Q120 164 89 158 Z" ${ol('#22201f')}/>`;
  for (const x of [96, 106, 116, 126, 136, 145]) s += `<rect x="${x - 3}" y="${150.5 + (Math.abs(x - 120) < 20 ? 2 : 1)}" width="6" height="5" rx="1" ${ol(o.fitting, 0.8)}/>`;
  return s;
}
function official(pose, o) {
  const f = -1;
  const arm = p => tube(p, 17, o.robe, o.robeSh);
  const cuff = (p, from) => handAt(p, from);
  const face = mood => zukinBack(f, '#1c1a1e') + head({f, mood, iris: '#3e2a20', brow: '#1c1410', mustache: o.mustache}) + zukin(f);
  if (pose === 'stand') {
    // 笏を両手で胸の前に持つ
    const L = [[100, 82], [90, 126], [112, 140]], R = [[140, 82], [150, 126], [128, 140]];
    return officialBody(o) + neck() + face(o.standMood) + arm(L) + arm(R) + shaku(120, 150) +
      hand([112, 141], 0) + hand([128, 141], 180, {flip: -1}) + (o.standDrop ? drop(146, 18) : '');
  }
  if (pose === 'kime') {
    if (o.kime === 'offer') {
      // 片手を胸に当て、もう片方の手を手児奈のほう（画面の左）へさしだす
      const R = [[140, 82], [152, 126], [128, 112]], L = [[100, 82], [66, 100], [32, 96]];
      return officialBody(o) + neck() + face(o.kimeMood) + arm(R) + shaku(130, 118, 16) + hand([128, 112], 190, {flip: -1}) +
        arm(L) + `<g transform="translate(26 96) scale(-1 1)"><path d="M-6 6 q-4 -8 0 -14 h14 q4 0 4 3 q0 2 -4 3 h3 q3 0 3 3 q0 2 -3 2 h2 q3 0 3 3 q-1 3 -4 3 h-10 q-6 2 -8 -3 z" ${ol(SKIN)}/></g>`;
    }
    // 両うでを横へ大きく広げる
    const L = [[100, 82], [64, 72], [28, 50]], R = [[140, 82], [176, 72], [208, 52]];
    return officialBody(o) + neck() + face(o.kimeMood) + arm(L) + arm(R) +
      handAt([24, 47], [64, 72], {open: true}) + shaku(212, 52, -20) + hand([210, 50], -30) +
      sparkle(40, 12, 10) + sparkle(196, 0, 7) + sparkle(220, 110, 6);
  }
  // rejected：肩を落とし、笏を下げて、うつむく
  const L = [[101, 88], [96, 138], [100, 188]], R = [[139, 88], [144, 138], [140, 188]];
  return officialBody(o, 4) + neck(120, 4) + tiltHead(face('sad'), -9, -2, 6) + gloom(116, 10) + drop(152, 26) +
    arm(L) + arm(R) + handAt([100, 192], [96, 138]) +
    `<g transform="rotate(160 140 192)">${shaku(140, 200)}</g>` + hand([140, 192], 80, {flip: -1});
}

// ---------------- 参加者の枠の仮の人物（「？」） ----------------
function newcomer(pose) {
  const GREY = {cloth: '#a7adb3', clothSh: '#8a9096', skin: '#cfd3d7'};
  let s = sato(pose)
    .replaceAll(SATO.cloth, GREY.cloth).replaceAll(SATO.clothSh, GREY.clothSh).replaceAll('#c3a97c', GREY.clothSh)
    .replaceAll(SATO.hakama, GREY.clothSh).replaceAll(SATO.hakamaSh, '#767c82').replaceAll(SATO.cord, '#5f656b')
    .replaceAll(SATO.hair, '#7d8389').replaceAll(SATO.hairHi, '#9aa0a6').replaceAll('#d8c49a', '#b8bdc2')
    .replaceAll(SKIN, GREY.skin).replaceAll(SKIN_SH, '#b9bec3').replaceAll('#ee6a82', '#c9ced3').replaceAll('#a83a52', '#8a9096');
  // 顔を「？」でおおう
  const dy = pose === 'rejected' ? 6 : 0;
  s += `<path d="M98 26 C98 46 108 60 120 60 C132 60 142 46 142 26 Z" fill="${GREY.skin}" transform="translate(0 ${dy})"/>`;
  s += `<text x="120" y="${57 + dy}" font-size="34" font-family="sans-serif" font-weight="bold" fill="#ffffff" stroke="#7d8389" stroke-width="1.2" text-anchor="middle">?</text>`;
  return s;
}

const IRIS = {tekona: ['#2a1830', '#8a5a8a'], sato: ['#2e1a12', '#9a6a44'], kokufu: ['#22160f', '#7a5a3a'], miyako: ['#2a160c', '#a8703a'], newcomer: ['#5a5e62', '#9aa0a6']};
const svg = (name, body) => {
  const [a, b] = IRIS[name.split('-')[0]];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="380" viewBox="0 -20 240 380"><title>${name}</title>` +
    `<defs><linearGradient id="iris" x1="0" y1="0" x2="0" y2="1"><stop offset=".15" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>${body}</svg>\n`;
};

const out = process.argv[2];
const KOKUFU = {robe: '#2f6a48', robeSh: '#20503a', fitting: '#a2946a', standMood: 'serious', standDrop: true, kimeMood: 'serious', kime: 'offer'};
const MIYAKO = {robe: '#ec8a70', robeSh: '#c8644c', fitting: '#e6c055', sword: true, mustache: true, standMood: 'smile', kimeMood: 'proud', kime: 'wide'};
const files = {};
for (const p of ['stand', 'refuse', 'resolve']) files[`tekona-${p}`] = tekona(p);
for (const p of ['stand', 'kime', 'rejected']) {
  files[`sato-${p}`] = sato(p);
  files[`kokufu-${p}`] = official(p, KOKUFU);
  files[`miyako-${p}`] = official(p, MIYAKO);
  files[`newcomer-${p}`] = newcomer(p);
}
for (const [n, b] of Object.entries(files)) fs.writeFileSync(path.join(out, `${n}.svg`), svg(n, b));
console.log(Object.keys(files).length, 'files');
