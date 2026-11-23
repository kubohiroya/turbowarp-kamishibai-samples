// 背景（480x360）。考証メモ 2.1・2.2：北に国府台の台地、その下に真間の入江、南に市川砂州。
// 入江の玉藻と水鳥（にほ鳥）、葦原、伏屋（竪穴住居）、木の枠の井戸、砂州をつなぐ平らな板橋（継橋）。
const fs = require('fs');
const path = require('path');


// ---- アニメ背景風の部品 ----
let gid = 0;
const grad = (stops, x2 = 0, y2 = 1) => {
  const id = `g${++gid}`;
  defs.push(`<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}">${stops.map(([o, c, a = 1]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${a}"/>`).join('')}</linearGradient>`);
  return `url(#${id})`;
};
let defs = [];
const rgrad = (stops) => {
  const id = `r${++gid}`;
  defs.push(`<radialGradient id="${id}">${stops.map(([o, c, a = 1]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${a}"/>`).join('')}</radialGradient>`);
  return `url(#${id})`;
};
// 入道雲・積雲：白い玉を重ね、下側に青みの影
const cloud = (x, y, s, sh = '#c9dcec', hi = '#ffffff') => {
  const balls = [[-30, 6, 16], [-12, -4, 20], [10, -10, 24], [32, 0, 18], [48, 8, 12], [-44, 10, 10]];
  let r = `<g transform="translate(${x} ${y}) scale(${s})">`;
  r += balls.map(([a, b, c]) => `<circle cx="${a}" cy="${b + 4}" r="${c}" fill="${sh}"/>`).join('');
  r += balls.map(([a, b, c]) => `<circle cx="${a - 2}" cy="${b}" r="${c * .92}" fill="${hi}"/>`).join('');
  r += `<path d="M-54 18 H60 V30 H-54 Z" fill="${sh}" opacity="0"/>`;
  return r + `</g>`;
};
// 木の群れ：暗・中・明の3段の葉
const trees = (x0, x1, y, [dark, mid, light], seed = 3, size = 1) => {
  let r = '', q = seed;
  const rnd = () => ((q = (q * 9301 + 49297) % 233280) / 233280);
  const xs = [];
  for (let x = x0; x < x1; x += (12 + rnd() * 12) * size) xs.push([x, (10 + rnd() * 10) * size, rnd()]);
  for (const [x, rr] of xs) r += `<circle cx="${x.toFixed(1)}" cy="${(y - rr * .5).toFixed(1)}" r="${rr.toFixed(1)}" fill="${dark}"/>`;
  for (const [x, rr] of xs) r += `<circle cx="${(x - rr * .18).toFixed(1)}" cy="${(y - rr * .72).toFixed(1)}" r="${(rr * .78).toFixed(1)}" fill="${mid}"/>`;
  for (const [x, rr, k] of xs) if (k > .3) r += `<circle cx="${(x - rr * .36).toFixed(1)}" cy="${(y - rr * 1.0).toFixed(1)}" r="${(rr * .4).toFixed(1)}" fill="${light}"/>`;
  return r;
};
// 草むら
const grass = (x0, x1, y, c, seed = 5, h = 8) => {
  let r = '', q = seed;
  const rnd = () => ((q = (q * 9301 + 49297) % 233280) / 233280);
  for (let x = x0; x < x1; x += 6 + rnd() * 14) {
    const yy = y + rnd() * 20;
    r += `<path d="M${x.toFixed(1)} ${yy.toFixed(1)} l2 ${-h} l2 ${h} l3 ${-h * .7} l1 ${h * .7} z" fill="${c}"/>`;
  }
  return r;
};

const reedsOld = (x0, x1, base, color, seed = 1, h = 70) => {
  let s = '', r = seed;
  const rnd = () => ((r = (r * 9301 + 49297) % 233280) / 233280);
  for (let x = x0; x < x1; x += 5 + rnd() * 6) {
    const hh = h * (0.55 + rnd() * 0.6), lean = (rnd() - 0.5) * 22;
    s += `<path d="M${x.toFixed(1)} ${base} q${(lean / 3).toFixed(1)} ${(-hh / 2).toFixed(1)} ${lean.toFixed(1)} ${(-hh).toFixed(1)}" stroke="${color}" stroke-width="${(2 + rnd() * 1.5).toFixed(1)}" fill="none" stroke-linecap="round"/>`;
    if (rnd() > 0.55) s += `<path d="M${(x + lean).toFixed(1)} ${(base - hh).toFixed(1)} q2 10 0 18" stroke="${color}" stroke-width="5" fill="none" stroke-linecap="round" opacity=".8"/>`;
  }
  return s;
};
// 松（砂州の松。考証メモでは黒松の景観は後世の可能性ありとして控えめに）
const reeds = (x0, x1, base, color, seed = 1, h = 70, light) => {
  let r = '', q = seed;
  const rnd = () => ((q = (q * 9301 + 49297) % 233280) / 233280);
  for (let x = x0; x < x1; x += 4 + rnd() * 5) {
    const hh = h * (0.55 + rnd() * 0.6), lean = (rnd() - 0.5) * 24;
    r += `<path d="M${x.toFixed(1)} ${base} q${(lean / 3).toFixed(1)} ${(-hh / 2).toFixed(1)} ${lean.toFixed(1)} ${(-hh).toFixed(1)}" stroke="${rnd() > .5 && light ? light : color}" stroke-width="${(1.6 + rnd() * 1.6).toFixed(1)}" fill="none" stroke-linecap="round"/>`;
    if (rnd() > 0.7) r += `<path d="M${(x + lean / 2).toFixed(1)} ${(base - hh * .5).toFixed(1)} q${lean > 0 ? 12 : -12} -4 ${lean > 0 ? 20 : -20} 6" stroke="${color}" stroke-width="2" fill="none" stroke-linecap="round"/>`;
    if (rnd() > 0.6) r += `<path d="M${(x + lean).toFixed(1)} ${(base - hh).toFixed(1)} q${lean > 0 ? 5 : -5} 6 ${lean > 0 ? 3 : -3} 16" stroke="${light || color}" stroke-width="4.5" fill="none" stroke-linecap="round" opacity=".85"/>`;
  }
  return r;
};
const pine = (x, y, s, c) =>
  `<path d="M${x} ${y} v${-18 * s}" stroke="${c}" stroke-width="${3 * s}"/>` +
  `<path d="M${x - 16 * s} ${y - 16 * s} q${16 * s} -10 ${32 * s} 0 q-${8 * s} -6 -${16 * s} -12 q-${8 * s} 6 -${16 * s} 12 z M${x - 12 * s} ${y - 26 * s} q${12 * s} -8 ${24 * s} 0 q-${6 * s} -6 -${12 * s} -10 q-${6 * s} 4 -${12 * s} 10 z" fill="${c}"/>`;
// 雑木林（台地の上）
const grove = (x0, x1, y, c1, c2, seed = 3) => {
  let s = '', r = seed;
  const rnd = () => ((r = (r * 9301 + 49297) % 233280) / 233280);
  for (let x = x0; x < x1; x += 14 + rnd() * 10) {
    const rr = 10 + rnd() * 9;
    s += `<circle cx="${x.toFixed(1)}" cy="${(y - rr * 0.6).toFixed(1)}" r="${rr.toFixed(1)}" fill="${rnd() > 0.5 ? c1 : c2}"/>`;
  }
  return s;
};
// 伏屋（竪穴住居）：地面までとどく草ぶき屋根と煙出し
const fuseya = (x, y, w, roof, roofDark, door) =>
  `<path d="M${x - w / 2} ${y} Q${x - w * 0.42} ${y - w * 0.5} ${x - w * 0.12} ${y - w * 0.62} L${x + w * 0.12} ${y - w * 0.62} Q${x + w * 0.42} ${y - w * 0.5} ${x + w / 2} ${y} Z" fill="${roof}"/>` +
  `<path d="M${x - w * 0.14} ${y - w * 0.62} l${w * 0.14} -${w * 0.16} l${w * 0.14} ${w * 0.16} z" fill="${roofDark}"/>` +
  `<path d="M${x - w * 0.36} ${y - w * 0.18} q${w * 0.36} -${w * 0.08} ${w * 0.72} 0 M${x - w * 0.28} ${y - w * 0.36} q${w * 0.28} -${w * 0.06} ${w * 0.56} 0" stroke="${roofDark}" stroke-width="2" fill="none" opacity=".6"/>` +
  (door ? `<path d="M${x - w * 0.1} ${y} v-${w * 0.18} q${w * 0.1} -${w * 0.08} ${w * 0.2} 0 v${w * 0.18} z" fill="${door}"/>` : '');
// にほ鳥（カイツブリ）
const grebe = (x, y, s = 1, c = '#5a4632', d = '#8a5a3a') =>
  `<g transform="translate(${x} ${y}) scale(${s})"><path d="M-12 0 q2 -10 14 -9 q6 -9 13 -4 q2 3 -1 5 l5 1 l-5 2 q-1 6 -10 6 h-14 q-4 0 -2 -1 z" fill="${c}"/><circle cx="12" cy="-9" r="1.5" fill="#f5e6a8"/><path d="M4 -7 q4 3 7 -1" stroke="${d}" stroke-width="2.5" fill="none"/><path d="M-16 4 h34" stroke="#ffffff" stroke-width="1.5" opacity=".6"/></g>`;
// 玉藻（入江の藻）
const tamamo = (x, y, c, n = 3) => {
  let s = '';
  for (let i = 0; i < n; i++) s += `<path d="M${x + i * 7} ${y} q-5 -8 0 -14 q5 -6 0 -14" stroke="${c}" stroke-width="3" fill="none" stroke-linecap="round"/>`;
  return s;
};
const ripples = (pts, c, op = 0.6) => pts.map(([x, y, w]) => `<path d="M${x} ${y} h${w}" stroke="${c}" stroke-width="2.5" stroke-linecap="round" opacity="${op}"/>`).join('');

// ---------- 真間の井（昼） ----------
// 伏屋（アニメ背景風）：草ぶきの段と陰
const fuseya2 = (x, y, w) => {
  const h = w * .62;
  let r = `<ellipse cx="${x}" cy="${y + 2}" rx="${w * .56}" ry="${w * .08}" fill="#000" opacity=".12"/>`;
  r += `<path d="M${x - w / 2} ${y} Q${x - w * .44} ${y - h * .8} ${x - w * .12} ${y - h} L${x + w * .12} ${y - h} Q${x + w * .44} ${y - h * .8} ${x + w / 2} ${y} Z" fill="${grad([[0, '#d9bf86'], [1, '#a88650']])}"/>`;
  r += `<path d="M${x + w * .06} ${y - h} L${x + w * .12} ${y - h} Q${x + w * .44} ${y - h * .8} ${x + w / 2} ${y} L${x + w * .12} ${y} Z" fill="#8a6a3c" opacity=".45"/>`;
  for (let i = 1; i < 5; i++) {
    const t = i / 5, yy = y - h * (1 - t), hw = w * (.12 + .38 * Math.sqrt(t));
    r += `<path d="M${x - hw} ${yy} q${hw} ${w * .05} ${hw * 2} 0" stroke="#8a6a3c" stroke-width="1.6" fill="none" opacity=".55"/>`;
    for (let k = -3; k <= 3; k++) r += `<path d="M${x + k * hw / 3.5} ${yy + 1} l${k} 6" stroke="#e8d3a0" stroke-width="1" opacity=".6"/>`;
  }
  r += `<path d="M${x - w * .14} ${y - h} l${w * .14} -${w * .17} l${w * .14} ${w * .17} z" fill="#7a5a32"/>`;
  r += `<path d="M${x - w * .11} ${y} v-${w * .2} q${w * .11} -${w * .09} ${w * .22} 0 v${w * .2} z" fill="#3a2716"/>`;
  return r;
};
const sparkles = (pts, c = '#ffffff') => pts.map(([x, y, w]) => `<path d="M${x} ${y} h${w}" stroke="${c}" stroke-width="2" stroke-linecap="round" opacity=".8"/><path d="M${x + w * .3} ${y + 5} h${w * .4}" stroke="${c}" stroke-width="1.4" stroke-linecap="round" opacity=".5"/>`).join('');

// ---------- 真間の井（昼） ----------
function mamaWell() {
  let s = `<rect width="480" height="360" fill="${grad([[0, '#6fb4e6'], [.55, '#b7def5'], [1, '#eef8fc']])}"/>`;
  s += cloud(84, 52, 1.05) + cloud(330, 34, .8) + cloud(440, 70, .55);
  // 遠景：海と砂州（かすみ）
  s += `<rect x="230" y="146" width="250" height="26" fill="${grad([[0, '#9fd0ea'], [1, '#7fbcdc']])}"/>`;
  s += `<path d="M236 166 Q360 156 480 164 V178 H236 Z" fill="#e8d7aa"/>`;
  for (const x of [292, 312, 340, 372, 404, 436, 462]) s += pine(x, 166, .5, '#5f8a6a');
  // 国府台：平らな上面と崖。手前ほど濃く
  s += `<path d="M0 96 Q70 88 150 92 Q204 96 226 126 Q250 160 300 178 H0 Z" fill="${grad([[0, '#8fbf72'], [1, '#5f9150']])}"/>`;
  s += trees(-6, 216, 98, ['#3f6e3e', '#5a8f4c', '#86b866'], 4);
  s += `<path d="M168 104 Q206 112 228 140 Q248 164 300 178 H210 Q196 150 168 104 Z" fill="#4f7f44" opacity=".55"/>`;
  s += `<path d="M184 120 l6 20 M196 128 l5 18 M210 142 l4 14" stroke="#a89a6a" stroke-width="2" opacity=".5"/>`;
  // 真間の入江
  s += `<path d="M226 176 H480 V300 Q430 268 360 262 Q300 256 266 230 Q246 206 226 176 Z" fill="${grad([[0, '#7cc0e2'], [1, '#3f8fbd']])}"/>`;
  s += sparkles([[290, 196, 30], [350, 212, 42], [420, 194, 34], [320, 236, 24], [404, 240, 40], [446, 222, 20]]);
  s += tamamo(318, 252, '#2f6f4a') + tamamo(402, 260, '#2f6f4a', 4) + tamamo(452, 232, '#2f6f4a', 2);
  s += grebe(372, 228, .9) + grebe(430, 212, .7);
  // 里の地面
  s += `<path d="M0 176 H226 Q246 206 266 230 Q300 256 360 262 Q430 268 480 300 V360 H0 Z" fill="${grad([[0, '#e3cd98'], [1, '#c9ad74']])}"/>`;
  s += `<path d="M262 228 Q300 254 360 260 Q430 266 480 298" stroke="#f3e6c0" stroke-width="3" fill="none" opacity=".8"/>`;
  s += grass(0, 220, 186, '#8aa860', 3, 7) + grass(0, 480, 300, '#a6a568', 9, 6);
  s += `<path d="M0 232 Q120 222 240 236" stroke="#b99a62" stroke-width="2.5" fill="none" opacity=".5"/>`;
  // 伏屋と煙
  s += fuseya2(54, 194, 74) + fuseya2(148, 186, 58);
  s += `<path d="M148 146 q-6 -10 2 -18 q8 -8 0 -18 q-6 -8 2 -14" stroke="#ffffff" stroke-width="4" fill="none" opacity=".55" stroke-linecap="round"/>`;
  // 真間の井：木を井の字に組んだ低い枠。屋根もつるべ車もつけない
  const wx = 240, wy = 248;
  s += `<ellipse cx="${wx + 6}" cy="${wy + 38}" rx="72" ry="10" fill="#6a5434" opacity=".25"/>`;
  s += `<path d="M${wx - 46} ${wy - 4} h92 l10 14 h-112 z" fill="${grad([[0, '#2c4d63'], [1, '#4f7e98']])}"/>`;
  s += `<path d="M${wx - 34} ${wy + 1} q34 5 68 0" stroke="#bfe6f6" stroke-width="2" fill="none" opacity=".9"/><path d="M${wx - 10} ${wy + 5} h20" stroke="#ffffff" stroke-width="1.5" opacity=".7"/>`;
  for (let i = 0; i < 3; i++) {
    const y = wy + 10 + i * 9;
    s += `<rect x="${wx - 56}" y="${y}" width="112" height="9" rx="3" fill="${grad([[0, '#9a6a3a'], [1, '#6e4524']])}"/>`;
    s += `<path d="M${wx - 50} ${y + 3} h30 M${wx + 6} ${y + 5} h36" stroke="#5a3818" stroke-width="1" opacity=".6"/>`;
    s += `<rect x="${wx + 30}" y="${y}" width="26" height="9" fill="#4a2c14" opacity=".35"/>`;
  }
  s += `<rect x="${wx - 62}" y="${wy + 2}" width="10" height="36" rx="3" fill="#6a4020"/><rect x="${wx + 52}" y="${wy + 2}" width="10" height="36" rx="3" fill="#4a2c14"/>`;
  s += `<rect x="${wx - 66}" y="${wy}" width="132" height="9" rx="3" fill="${grad([[0, '#c08a52'], [1, '#8a5a30']])}"/>`;
  s += `<path d="M${wx - 60} ${wy + 2} h70" stroke="#e8c08a" stroke-width="1.5" opacity=".7"/>`;
  // 曲物のつるべ桶、土師器・須恵器の甕
  s += `<path d="M${wx + 30} ${wy - 2} q22 -6 30 12" stroke="#a88a5a" stroke-width="2" fill="none"/>`;
  s += `<rect x="${wx + 54}" y="${wy + 8}" width="20" height="16" rx="2" fill="${grad([[0, '#e0bc80'], [1, '#b08a52']], 1, 0)}"/><path d="M${wx + 54} ${wy + 13} h20" stroke="#8a6a3a" stroke-width="2"/>`;
  s += `<path d="M${wx - 96} ${wy + 6} q-14 18 -4 32 q16 10 32 0 q10 -14 -4 -32 z" fill="${grad([[0, '#d08a52'], [1, '#93522a']], 1, 0)}"/><ellipse cx="${wx - 86}" cy="${wy + 6}" rx="11" ry="3.6" fill="#6a3a1c"/><path d="M${wx - 100} ${wy + 14} q4 -4 8 0" stroke="#ffe0c0" stroke-width="2" opacity=".5" fill="none"/>`;
  s += `<path d="M${wx + 84} ${wy + 16} q-9 13 -2 24 q11 8 22 0 q7 -11 -2 -24 z" fill="${grad([[0, '#a3a9ab'], [1, '#62686a']], 1, 0)}"/><ellipse cx="${wx + 93}" cy="${wy + 16}" rx="7.5" ry="2.8" fill="#45494b"/>`;
  // 手前の葦
  s += reeds(0, 64, 360, '#4f7a3a', 7, 96, '#8cbf5c') + reeds(420, 480, 360, '#46703a', 11, 104, '#7fb052');
  return s;
}

// ---------- 夕日の入江 ----------
function inletSunset() {
  let s = `<rect width="480" height="360" fill="${grad([[0, '#2e2660'], [.35, '#8a4f86'], [.62, '#f08a4b'], [1, '#ffd88a']])}"/>`;
  s += `<circle cx="300" cy="190" r="120" fill="${rgrad([[0, '#fff0b0', .7], [.4, '#ffd27a', .35], [1, '#ffd27a', 0]])}"/>`;
  for (const [x, y, w] of [[40, 80, 120], [70, 96, 90], [280, 58, 150], [320, 76, 110], [140, 128, 100]]) s += `<path d="M${x} ${y} q${w / 2} -10 ${w} 0 q-${w / 2} 6 -${w} 0 z" fill="#f6a079" opacity=".75"/><path d="M${x + 10} ${y - 2} q${w / 2 - 10} -6 ${w - 20} 0" stroke="#ffd0a0" stroke-width="2" fill="none" opacity=".8"/>`;
  s += `<circle cx="300" cy="192" r="40" fill="#fff0b0"/><circle cx="300" cy="192" r="34" fill="#ffe489"/>`;
  // 水面
  s += `<rect y="196" width="480" height="164" fill="${grad([[0, '#f0a060'], [.25, '#9a6a8a'], [1, '#26365e']])}"/>`;
  s += sparkles([[256, 210, 88], [270, 226, 60], [282, 244, 36], [290, 262, 20], [296, 278, 10], [120, 236, 30], [400, 250, 36], [60, 270, 24]], '#ffe08a');
  // 国府台と砂州・松のシルエット（逆光）
  s += `<path d="M0 116 Q70 108 130 114 Q170 120 186 156 Q196 184 232 198 H0 Z" fill="#3a2a48"/>`;
  s += trees(-6, 176, 118, ['#3a2a48', '#3f2e4e', '#4a3858'], 4);
  s += `<path d="M120 116 Q170 120 186 156 Q196 184 232 198 H200 Q170 160 120 116 Z" fill="#6a4a6a" opacity=".35"/>`;
  s += `<path d="M330 198 Q400 188 480 192 V202 H330 Z" fill="#4a3446"/>`;
  for (const x of [350, 378, 410, 446, 470]) s += pine(x, 196, .6, '#4a3446');
  s += `<path d="M150 70 q6 -6 12 0 q6 -6 12 0 M182 56 q5 -5 10 0 q5 -5 10 0 M126 84 q4 -4 8 0 q4 -4 8 0" stroke="#2e2440" stroke-width="2.4" fill="none" stroke-linecap="round"/>`;
  // 手前の岸と葦
  s += `<path d="M0 300 Q120 284 220 312 T480 300 V360 H0 Z" fill="${grad([[0, '#4a3a2e'], [1, '#2a2018']])}"/>`;
  s += `<path d="M0 300 Q120 284 220 312 T480 300" stroke="#f0a060" stroke-width="2" fill="none" opacity=".6"/>`;
  s += reeds(0, 84, 340, '#241e16', 5, 110, '#3a2e20') + reeds(396, 480, 340, '#241e16', 9, 120, '#3a2e20');
  return s;
}

// ---------- 真間の継橋（昼） ----------
function tsugihashi() {
  let s = `<rect width="480" height="360" fill="${grad([[0, '#79bce8'], [.6, '#c7e7f7'], [1, '#f0f9fc']])}"/>`;
  s += cloud(390, 48, .9) + cloud(150, 40, .6) + cloud(260, 84, .45);
  // 国府台（奥、かすむ）
  s += `<path d="M0 128 Q120 120 220 126 Q262 130 282 160 H0 Z" fill="${grad([[0, '#a6cf8c'], [1, '#7fae6c']])}"/>`;
  s += trees(-6, 262, 130, ['#6d9e62', '#82b070', '#a6cf8c'], 5, .85);
  // 入江と海
  s += `<rect y="158" width="480" height="202" fill="${grad([[0, '#8ccbe6'], [1, '#3f8fbd']])}"/>`;
  s += `<rect x="282" y="158" width="198" height="10" fill="#a7d8ec"/>`;
  s += sparkles([[30, 290, 40], [150, 300, 30], [330, 296, 44], [420, 318, 30], [200, 332, 50], [80, 336, 30], [380, 270, 30]]);
  // 砂州と道
  s += `<path d="M-10 212 Q70 198 160 208 Q180 222 160 238 H-10 Z" fill="${grad([[0, '#f0dfb0'], [1, '#d2b77e']])}"/>`;
  s += `<path d="M330 210 Q420 198 490 204 V240 H322 Q304 224 330 210 Z" fill="${grad([[0, '#f0dfb0'], [1, '#d2b77e']])}"/>`;
  s += `<path d="M0 222 Q80 214 158 222 M332 222 Q410 214 480 218" stroke="#c4a66e" stroke-width="5" fill="none" stroke-linecap="round"/>`;
  s += grass(0, 150, 214, '#9ab066', 2, 6) + grass(340, 480, 212, '#9ab066', 8, 6);
  for (const x of [20, 62, 104]) s += pine(x, 212, .78, '#3f6e48');
  for (const x of [380, 420, 462]) s += pine(x, 210, .78, '#3f6e48');
  // 継橋：杭で支えた平らな板橋を中ほどでつなぐ
  const deckY = 212;
  for (const x of [168, 200, 232, 248, 280, 312]) {
    const h = x === 232 || x === 248 ? 48 : 42;
    s += `<rect x="${x}" y="${deckY}" width="7" height="${h}" fill="${grad([[0, '#7a5030'], [1, '#3a2414']])}"/><rect x="${x + 4}" y="${deckY}" width="3" height="${h}" fill="#2a1a0c" opacity=".4"/>`;
    s += `<path d="M${x - 4} ${deckY + h} q7.5 3 15 0" stroke="#ffffff" stroke-width="1.6" fill="none" opacity=".7"/>`;
  }
  s += `<path d="M168 ${deckY + 18} L200 ${deckY + 30} M200 ${deckY + 18} L168 ${deckY + 30} M280 ${deckY + 18} L312 ${deckY + 30}" stroke="#5a3a20" stroke-width="2.5"/>`;
  s += `<rect x="156" y="${deckY - 6}" width="88" height="9" fill="${grad([[0, '#c4884e'], [1, '#8a5a30']])}"/><rect x="236" y="${deckY - 3}" width="94" height="9" fill="${grad([[0, '#c88e54'], [1, '#8f5f34']])}"/>`;
  s += `<path d="M156 ${deckY - 6} h88 M236 ${deckY - 3} h94" stroke="#f0c890" stroke-width="1.5"/>`;
  s += `<rect x="156" y="${deckY + 3}" width="88" height="3" fill="#4a2c14" opacity=".4"/><rect x="236" y="${deckY + 6}" width="94" height="3" fill="#4a2c14" opacity=".4"/>`;
  for (let x = 164; x < 328; x += 12) s += `<path d="M${x} ${deckY - 4} v7" stroke="#7a4a24" stroke-width="1" opacity=".7"/>`;
  s += `<path d="M158 ${deckY + 22} h170" stroke="#2a5a7a" stroke-width="10" opacity=".18"/>`;
  s += tamamo(110, 292, '#2f6f4a') + tamamo(360, 302, '#2f6f4a', 4);
  s += grebe(84, 268, .8) + grebe(396, 276, .9);
  s += reeds(0, 60, 360, '#46703a', 3, 100, '#86b858') + reeds(424, 480, 360, '#4f7a3a', 13, 104, '#8cbf5c');
  return s;
}

// ---------- タイトル（月夜の入江） ----------
function titleCard() {
  let s = `<rect width="480" height="360" fill="${grad([[0, '#0c1430'], [.7, '#1c2a52'], [1, '#2a3a66']])}"/>`;
  s += `<circle cx="380" cy="78" r="130" fill="${rgrad([[0, '#f3e3a3', .35], [.45, '#f3e3a3', .12], [1, '#f3e3a3', 0]])}"/>`;
  for (const [x, y, r] of [[40, 40, 1.4], [96, 70, 1], [150, 30, 1.2], [214, 56, 1], [270, 24, 1.3], [60, 120, 1], [310, 120, 1], [460, 160, 1.1], [24, 180, 1], [120, 150, .9], [250, 100, .8], [180, 20, .8]]) s += `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff6d0" opacity=".8"/>`;
  s += `<circle cx="380" cy="78" r="44" fill="#fff4c4" opacity=".5"/><circle cx="380" cy="78" r="40" fill="${grad([[0, '#fffbe2'], [1, '#f0dc94']])}"/>`;
  s += `<circle cx="366" cy="70" r="7" fill="#e6d08a" opacity=".5"/><circle cx="392" cy="92" r="5" fill="#e6d08a" opacity=".5"/>`;
  s += `<path d="M300 100 q40 -8 80 -2 q20 2 36 -2" stroke="#3a4a7a" stroke-width="5" fill="none" opacity=".6" stroke-linecap="round"/>`;
  // 国府台と砂州のシルエット
  s += `<path d="M0 212 Q60 204 120 210 Q150 216 162 244 H0 Z" fill="#0f1830"/>`;
  s += trees(-6, 146, 214, ['#0f1830', '#121d38', '#18264a'], 9);
  s += `<path d="M280 246 Q380 236 480 240 V252 H280 Z" fill="#0f1830"/>`;
  for (const x of [300, 334, 372, 414, 452]) s += pine(x, 246, .6, '#0f1830');
  // 入江と月の道
  s += `<rect y="244" width="480" height="116" fill="${grad([[0, '#2a4270'], [1, '#121c3a']])}"/>`;
  s += sparkles([[344, 256, 70], [354, 270, 50], [362, 284, 32], [368, 298, 18], [80, 280, 30], [180, 300, 40]], '#f3e3a3');
  s += `<path d="M0 316 Q160 300 280 322 T480 312 V360 H0 Z" fill="#0d1428"/>`;
  s += reeds(0, 74, 360, '#0a1022', 2, 110, '#18264a') + reeds(406, 480, 360, '#0a1022', 6, 120, '#18264a');
  // 蛍
  for (const [x, y] of [[90, 296], [130, 270], [430, 280], [60, 250]]) s += `<circle cx="${x}" cy="${y}" r="5" fill="#e8f5a0" opacity=".25"/><circle cx="${x}" cy="${y}" r="1.8" fill="#f4ffc0"/>`;
  return s;
}

const out = process.argv[2];
for (const [n, f] of Object.entries({'mama-well': mamaWell, 'inlet-sunset': inletSunset, tsugihashi, 'title-card': titleCard})) {
  defs = []; gid = 0;
  const body = f();
  fs.writeFileSync(path.join(out, `${n}.svg`), `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="360" viewBox="0 0 480 360"><title>${n}</title><defs>${defs.join('')}</defs>${body}</svg>\n`);
}
console.log('4 files');
