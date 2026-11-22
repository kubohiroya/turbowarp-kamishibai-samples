// 背景（480x360）。考証メモ 2.1・2.2：北に国府台の台地、その下に真間の入江、南に市川砂州。
// 入江の玉藻と水鳥（にほ鳥）、葦原、伏屋（竪穴住居）、木の枠の井戸、砂州をつなぐ平らな板橋（継橋）。
const fs = require('fs');
const path = require('path');

const reeds = (x0, x1, base, color, seed = 1, h = 70) => {
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
function mamaWell() {
  let s = `<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#bfe3f5"/><stop offset="1" stop-color="#eaf6fb"/></linearGradient></defs>`;
  s += `<rect width="480" height="360" fill="url(#sky)"/>`;
  s += `<path d="M40 52 q10 -10 24 -4 q12 -8 22 2 q10 0 8 8 h-56 q-6 -4 2 -6 z M330 34 q8 -8 18 -2 q10 -6 18 2 q8 0 6 6 h-46 q-4 -4 4 -6z" fill="#ffffff" opacity=".85"/>`;
  // 遠くの海と砂州（右）
  s += `<rect x="250" y="150" width="230" height="20" fill="#8cc6df"/>`;
  s += `<path d="M250 168 Q360 158 480 166 V176 H250 Z" fill="#e3cf9c"/>`;
  for (const x of [300, 322, 352, 384, 420, 452]) s += pine(x, 168, 0.5, '#4f7a52');
  // 国府台の台地（左・平らな上面と急な崖）
  s += `<path d="M0 98 Q60 92 150 96 Q205 100 226 128 Q250 160 300 176 H0 Z" fill="#7fae67"/>`;
  s += grove(0, 214, 100, '#5f8f4f', '#6f9f58');
  s += `<path d="M150 104 Q200 112 226 140 Q246 162 300 176 H160 Z" fill="#6c9a58" opacity=".7"/>`;
  // 真間の入江（右手前に広がる）
  s += `<path d="M230 176 H480 V300 Q430 268 360 262 Q300 256 268 230 Q248 206 230 176 Z" fill="#6fb3d6"/>`;
  s += ripples([[300, 200, 30], [360, 214, 40], [420, 196, 34], [330, 236, 26], [410, 240, 40]], '#ffffff', 0.55);
  s += tamamo(318, 250, '#3f7f5a') + tamamo(402, 258, '#3f7f5a', 4) + tamamo(452, 230, '#3f7f5a', 2);
  s += grebe(372, 226, 0.9) + grebe(430, 210, 0.7);
  // 里の地面
  s += `<path d="M0 176 H230 Q248 206 268 230 Q300 256 360 262 Q430 268 480 300 V360 H0 Z" fill="#d9c28f"/>`;
  s += `<path d="M0 230 Q120 222 240 236" stroke="#c9ae78" stroke-width="3" fill="none" opacity=".6"/>`;
  // 伏屋（竪穴住居）
  s += fuseya(54, 192, 70, '#b89a5e', '#8a6c3c', '#4a3720') + fuseya(146, 186, 56, '#c2a66a', '#8a6c3c', '#4a3720');
  s += `<path d="M146 152 q-4 -10 2 -18 q6 -8 0 -16" stroke="#ffffff" stroke-width="3" fill="none" opacity=".6" stroke-linecap="round"/>`;
  // 真間の井：木を井の字に組んだ低い枠。屋根もつるべもつけない
  const wx = 240, wy = 250;
  s += `<ellipse cx="${wx}" cy="${wy + 26}" rx="62" ry="10" fill="#c2a46f"/>`;
  s += `<path d="M${wx - 44} ${wy - 6} h88 l10 14 h-108 z" fill="#3c5f74"/>`;
  s += `<path d="M${wx - 40} ${wy - 2} q40 6 80 0" stroke="#9fd3ea" stroke-width="2.5" fill="none" opacity=".8"/>`;
  for (let i = 0; i < 3; i++) {
    const y = wy + 8 + i * 9;
    s += `<rect x="${wx - 54}" y="${y}" width="108" height="9" rx="3" fill="${i % 2 ? '#8a5a30' : '#7a4c26'}"/>`;
  }
  s += `<rect x="${wx - 58}" y="${wy + 2}" width="9" height="34" rx="3" fill="#6a4020"/><rect x="${wx + 49}" y="${wy + 2}" width="9" height="34" rx="3" fill="#6a4020"/>`;
  s += `<rect x="${wx - 62}" y="${wy}" width="124" height="8" rx="3" fill="#9a6a3a"/>`;
  // 曲物のつるべ桶となわ、水がめ（土師器・須恵器）
  s += `<path d="M${wx + 32} ${wy - 2} q20 -4 26 10" stroke="#a88a5a" stroke-width="2" fill="none"/>`;
  s += `<rect x="${wx + 52}" y="${wy + 6}" width="18" height="14" rx="2" fill="#c8a46a"/><path d="M${wx + 52} ${wy + 10} h18" stroke="#9a7a48" stroke-width="2"/>`;
  s += `<path d="M${wx - 92} ${wy + 6} q-12 16 -4 30 q14 10 28 0 q8 -14 -4 -30 z" fill="#b5703c"/><ellipse cx="${wx - 82}" cy="${wy + 6}" rx="10" ry="3.5" fill="#7a4a24"/>`;
  s += `<path d="M${wx + 82} ${wy + 14} q-8 12 -2 22 q10 8 20 0 q6 -10 -2 -22 z" fill="#7d8486"/><ellipse cx="${wx + 90}" cy="${wy + 14}" rx="7" ry="2.6" fill="#55595b"/>`;
  // 手前の葦
  s += reeds(0, 60, 360, '#5f8d44', 7, 90) + reeds(424, 480, 360, '#4f7a3a', 11, 100);
  return s;
}

// ---------- 夕日の入江 ----------
function inletSunset() {
  let s = `<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3b2d6b"/><stop offset=".55" stop-color="#f08a4b"/><stop offset="1" stop-color="#fcd27a"/></linearGradient>` +
    `<linearGradient id="sea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e98a56"/><stop offset=".35" stop-color="#7a5a7a"/><stop offset="1" stop-color="#2f3f6a"/></linearGradient></defs>`;
  s += `<rect width="480" height="360" fill="url(#sky)"/>`;
  s += `<path d="M60 90 q30 -8 70 0 M90 104 q40 -6 80 0 M300 70 q40 -8 90 0 M330 86 q30 -6 60 0" stroke="#f7b38a" stroke-width="5" stroke-linecap="round" opacity=".7"/>`;
  s += `<circle cx="300" cy="196" r="42" fill="#ffde7a"/>`;
  // 入江の水面
  s += `<rect y="196" width="480" height="164" fill="url(#sea)"/>`;
  s += ripples([[262, 212, 76], [276, 228, 48], [286, 246, 28], [292, 262, 16], [120, 236, 30], [400, 250, 36]], '#ffd27a', 0.85);
  // 国府台（左の台地）と砂州・松のシルエット
  s += `<path d="M0 120 Q70 112 130 118 Q170 124 186 160 Q196 186 230 198 H0 Z" fill="#3e2e4a"/>`;
  s += grove(0, 170, 122, '#3e2e4a', '#463452');
  s += `<path d="M330 198 Q400 188 480 192 V202 H330 Z" fill="#4a3446"/>`;
  for (const x of [350, 378, 410, 446, 470]) s += pine(x, 196, 0.6, '#4a3446');
  // 水鳥（ねぐらへ帰る）
  s += `<path d="M150 70 q6 -6 12 0 q6 -6 12 0 M182 56 q5 -5 10 0 q5 -5 10 0 M126 84 q4 -4 8 0 q4 -4 8 0" stroke="#3b2d4b" stroke-width="2.5" fill="none" stroke-linecap="round"/>`;
  // 手前の岸と葦
  s += `<path d="M0 300 Q120 284 220 312 T480 300 V360 H0 Z" fill="#3a3326"/>`;
  s += reeds(0, 80, 340, '#2a2a1a', 5, 100) + reeds(400, 480, 340, '#2a2a1a', 9, 110);
  return s;
}

// ---------- 真間の継橋（昼） ----------
function tsugihashi() {
  let s = `<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#cdeaf7"/><stop offset="1" stop-color="#eef8fc"/></linearGradient></defs>`;
  s += `<rect width="480" height="360" fill="url(#sky)"/>`;
  s += `<path d="M380 48 q10 -10 24 -4 q12 -8 22 2 q10 0 8 8 h-56 q-6 -4 2 -6 z" fill="#ffffff" opacity=".85"/>`;
  // 国府台（奥）
  s += `<path d="M0 132 Q120 124 220 130 Q260 134 280 160 H0 Z" fill="#8fbf74"/>`;
  s += grove(0, 260, 132, '#78a862', '#86b46c', 5);
  // 入江と海
  s += `<rect y="158" width="480" height="202" fill="#6fb6d8"/>`;
  s += `<rect x="280" y="158" width="200" height="12" fill="#8cc6df"/>`;
  s += ripples([[30, 290, 40], [150, 300, 30], [330, 296, 44], [420, 318, 30], [200, 330, 50], [80, 334, 30]], '#ffffff', 0.55);
  // 左右の砂州と道
  s += `<path d="M-10 214 Q70 200 160 210 Q178 222 160 236 H-10 Z" fill="#e3cf9c"/>`;
  s += `<path d="M330 212 Q420 200 490 206 V238 H322 Q306 224 330 212 Z" fill="#e3cf9c"/>`;
  s += `<path d="M0 222 Q80 214 160 222 M330 222 Q410 214 480 218" stroke="#cdb57f" stroke-width="5" fill="none" stroke-linecap="round"/>`;
  for (const x of [20, 62, 104]) s += pine(x, 212, 0.75, '#4f7a52');
  for (const x of [380, 420, 462]) s += pine(x, 210, 0.75, '#4f7a52');
  // 継橋：杭で支えた平らな板橋を、中ほどでつなぐ
  const deckY = 212;
  for (const x of [168, 200, 232, 248, 280, 312]) s += `<rect x="${x}" y="${deckY}" width="7" height="${x === 232 || x === 248 ? 46 : 40}" fill="#5a3a20"/>`;
  s += `<rect x="156" y="${deckY - 6}" width="86" height="9" fill="#a0683a"/><rect x="236" y="${deckY - 4}" width="92" height="9" fill="#a8703f"/>`;
  s += `<path d="M156 ${deckY - 6} h86 M236 ${deckY - 4} h92" stroke="#7a4a24" stroke-width="2"/>`;
  for (let x = 162; x < 326; x += 12) s += `<path d="M${x} ${deckY - 5} v7" stroke="#8a5a30" stroke-width="1.2" opacity=".7"/>`;
  s += ripples([[166, 254, 14], [198, 254, 14], [230, 260, 30], [278, 254, 14], [310, 254, 14]], '#ffffff', 0.7);
  // 入江の玉藻と水鳥
  s += tamamo(110, 290, '#3f7f5a') + tamamo(360, 300, '#3f7f5a', 4);
  s += grebe(84, 268, 0.8) + grebe(396, 274, 0.9);
  // 手前の葦
  s += reeds(0, 56, 360, '#4f7a3a', 3, 96) + reeds(430, 480, 360, '#5f8d44', 13, 100);
  return s;
}

// ---------- タイトル（月夜の入江） ----------
function titleCard() {
  let s = `<defs><radialGradient id="glow" cx="380" cy="78" r="110" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#f3e3a3" stop-opacity=".35"/><stop offset="1" stop-color="#f3e3a3" stop-opacity="0"/></radialGradient></defs>`;
  s += `<rect width="480" height="360" fill="#16213e"/><circle cx="380" cy="78" r="110" fill="url(#glow)"/>`;
  for (const [x, y, r] of [[40, 40, 1.4], [96, 70, 1], [150, 30, 1.2], [214, 56, 1], [270, 24, 1.3], [60, 120, 1], [310, 120, 1], [460, 160, 1.1], [24, 180, 1]]) s += `<circle cx="${x}" cy="${y}" r="${r}" fill="#f3e3a3" opacity=".7"/>`;
  s += `<circle cx="380" cy="78" r="40" fill="#f3e3a3"/>`;
  // 国府台と砂州のシルエット
  s += `<path d="M0 214 Q60 206 120 212 Q150 218 160 244 H0 Z" fill="#101a32"/>`;
  s += grove(0, 140, 214, '#101a32', '#13203a', 9);
  s += `<path d="M280 246 Q380 236 480 240 V252 H280 Z" fill="#101a32"/>`;
  for (const x of [300, 334, 372, 414, 452]) s += pine(x, 246, 0.6, '#101a32');
  // 入江と月の道
  s += `<rect y="244" width="480" height="116" fill="#22385e"/>`;
  s += ripples([[350, 256, 60], [360, 270, 40], [366, 284, 28], [372, 298, 16], [80, 280, 30], [180, 300, 40]], '#f3e3a3', 0.6);
  s += `<path d="M0 316 Q160 300 280 322 T480 312 V360 H0 Z" fill="#141e36"/>`;
  s += reeds(0, 70, 360, '#0f1a30', 2, 100) + reeds(410, 480, 360, '#0f1a30', 6, 110);
  return s;
}

const out = process.argv[2];
const svg = (name, body) => `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="360" viewBox="0 0 480 360"><title>${name}</title>${body}</svg>\n`;
for (const [n, f] of Object.entries({'mama-well': mamaWell, 'inlet-sunset': inletSunset, tsugihashi, 'title-card': titleCard})) fs.writeFileSync(path.join(out, `${n}.svg`), svg(n, f()));
console.log('4 files');
