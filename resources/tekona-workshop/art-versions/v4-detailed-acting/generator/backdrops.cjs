// 背景（480x360、版4）。考証メモ 2.1・2.2：北に国府台の台地、その下に真間の入江、南に市川砂州。
// 入江の玉藻と水鳥（にほ鳥）、葦原、伏屋（竪穴住居）、木の枠の井戸、砂州をつなぐ平らな板橋（継橋）。
// 版4：空・海・砂地を淡いグラデーションに、砂州の松を1本ずつ形の違う松に、丸木舟・草で編んだかご・干した網の小道具を加える。
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

// ---- グラデーション（背景ごとに defs へ集める） ----
let defs = [], gid = 0;
const grad = (stops, x2 = 0, y2 = 1) => {
  const id = `g${++gid}`;
  defs.push(`<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}">${stops.map(([o, c, a = 1]) => `<stop offset="${o}" stop-color="${c}"${a === 1 ? '' : ` stop-opacity="${a}"`}/>`).join('')}</linearGradient>`);
  return `url(#${id})`;
};
const rnd0 = seed => { let r = seed; return () => ((r = (r * 9301 + 49297) % 233280) / 233280); };
// 松：幹は曲がり、枝先に平たい葉のかたまり（段）をつける。1本ずつ高さ・傾き・段の数を変える
function pineTree(x, y, s, [dark, light], rnd, lean = 0) {
  const h = (30 + rnd() * 24) * s, bend = (lean + (rnd() - .5) * 12) * s;
  const top = [x + bend, y - h];
  const tw = 2.4 * s;
  // 幹：根元が太く、くねって傾く
  let t = `<path d="M${(x - tw).toFixed(1)} ${y} Q${(x + bend * .1 - tw).toFixed(1)} ${(y - h * .55).toFixed(1)} ${(top[0] - tw * .4).toFixed(1)} ${top[1].toFixed(1)} L${(top[0] + tw * .4).toFixed(1)} ${top[1].toFixed(1)} Q${(x + bend * .1 + tw).toFixed(1)} ${(y - h * .55).toFixed(1)} ${(x + tw).toFixed(1)} ${y} Z" fill="${dark}"/>`;
  // 葉の段：下が平らで上がもこもこした、横に長いかたまりを左右に互い違いに重ねる
  const pads = 3 + Math.floor(rnd() * 3);
  for (let i = 0; i < pads; i++) {
    const f = i / (pads - 1 || 1), side = i === pads - 1 ? 0 : (i % 2 ? 1 : -1);
    const cx = x + bend * (0.5 + f * 0.5) + side * (5 + rnd() * 6) * s, py = y - h * (0.5 + f * 0.5) - 2 * s;
    const w = (13 + rnd() * 8) * s * (1.05 - f * .45), hh = (5 + rnd() * 2) * s;
    if (side) t += `<path d="M${(x + bend * (0.45 + f * .5)).toFixed(1)} ${(py + hh * .6).toFixed(1)} L${cx.toFixed(1)} ${(py + hh * .2).toFixed(1)}" stroke="${dark}" stroke-width="${(1.6 * s).toFixed(1)}"/>`;
    const n = 3 + Math.floor(rnd() * 2), bw = 2 * w / n;
    let d = `M${(cx - w).toFixed(1)} ${(py + hh * .5).toFixed(1)}`;
    for (let k = 0; k < n; k++) {
      const x0 = cx - w + k * bw, peak = hh * (0.8 + rnd() * .6) * (k === 0 || k === n - 1 ? .75 : 1);
      d += ` Q${(x0 + bw / 2).toFixed(1)} ${(py - peak * 1.3).toFixed(1)} ${(x0 + bw).toFixed(1)} ${(py + (k === n - 1 ? hh * .5 : -hh * .1)).toFixed(1)}`;
    }
    t += `<path d="${d} Z" fill="${dark}"/>`;
    t += `<path d="M${(cx - w * .7).toFixed(1)} ${(py - hh * .2).toFixed(1)} Q${(cx - w * .2).toFixed(1)} ${(py - hh * 1.1).toFixed(1)} ${(cx + w * .3).toFixed(1)} ${(py - hh * .5).toFixed(1)} Q${(cx - w * .2).toFixed(1)} ${(py - hh * .4).toFixed(1)} ${(cx - w * .7).toFixed(1)} ${(py - hh * .2).toFixed(1)} Z" fill="${light}"/>`;
  }
  return t;
}
// 松の列：間隔・大きさ・海側への傾きを1本ずつ変える
const pineRow = (xs, y, s, colors, seed, lean = 4) => { const rnd = rnd0(seed); return xs.map(x => pineTree(x, y + (rnd() - .5) * 3, s * (.75 + rnd() * .5), colors, rnd, lean)).join(''); };
// 丸木舟：一本の丸太をくりぬいた舟。櫂を添える。f=-1 で左右反転
const marukibune = (x, y, s = 1, {f = 1, dark = false, paddle = true} = {}) => {
  const c1 = dark ? '#2a2030' : '#8a5a30', c2 = dark ? '#1a1420' : '#5e3a1c', c3 = dark ? '#3a2e40' : '#b07a44';
  return `<g transform="translate(${x} ${y}) scale(${s * f} ${s})">` +
    `<path d="M-46 -4 Q-40 6 -20 8 L28 8 Q44 6 50 -6 Q20 -2 -10 -2 Q-30 -2 -46 -4 Z" fill="${c1}"/>` +
    `<path d="M-42 -4 Q-28 -9 -10 -8 L30 -8 Q44 -8 48 -6 Q20 -3 -10 -3 Q-30 -3 -42 -4 Z" fill="${c2}"/>` +
    `<path d="M-30 3 Q0 6 34 3" stroke="${c3}" stroke-width="1.6" fill="none" opacity=".8"/>` +
    (paddle ? `<path d="M-6 -6 L30 -22" stroke="${c3}" stroke-width="2.6" stroke-linecap="round"/><path d="M28 -24 q10 -6 14 -2 q-2 6 -10 6 z" fill="${c3}"/>` : '') +
    `</g>`;
};
// 草で編んだかご（中に魚や菜）
const kago = (x, y, s = 1, {fill = 'fish'} = {}) => {
  let g = `<g transform="translate(${x} ${y}) scale(${s})">`;
  if (fill === 'fish') g += `<path d="M-10 -12 q8 -8 18 -2 l4 -4 l0 9 l-4 -3 q-10 6 -18 0 z" fill="#8fa6b4"/><path d="M-4 -16 q8 -6 14 0 l3 -3 l0 7 l-3 -2 q-8 4 -14 -2 z" fill="#a9bcc6"/>`;
  else g += `<path d="M-10 -10 q-4 -12 4 -14 q2 8 -4 14 z M-2 -11 q2 -12 10 -10 q-2 8 -10 10 z M6 -10 q8 -8 12 -2 q-6 4 -12 2 z" fill="#6f9a4a"/>`;
  g += `<path d="M-15 -9 Q-14 6 -8 8 L8 8 Q14 6 15 -9 Z" fill="#c9a865"/>`;
  for (const yy of [-5, -1, 3]) g += `<path d="M-14 ${yy} Q0 ${yy + 2} 14 ${yy}" stroke="#9a7a3e" stroke-width="1.2" fill="none"/>`;
  for (const xx of [-9, -3, 3, 9]) g += `<path d="M${xx} -9 L${xx * .85} 8" stroke="#a8884a" stroke-width="1" opacity=".8"/>`;
  g += `<path d="M-16 -9 Q0 -7 16 -9" stroke="#8a6a32" stroke-width="2.4" fill="none" stroke-linecap="round"/>`;
  return g + `</g>`;
};
// 竿にかけて干した網と、網のおもり（土錘）
const net = (x, y, w, h) => {
  let g = `<path d="M${x} ${y + h + 6} V${y - 4} M${x + w} ${y + h + 6} V${y - 4}" stroke="#6a4a28" stroke-width="3" stroke-linecap="round"/>` +
    `<path d="M${x - 2} ${y} Q${x + w / 2} ${y + 4} ${x + w + 2} ${y}" stroke="#6a4a28" stroke-width="2.4" fill="none"/>` +
    `<path d="M${x + 2} ${y + 2} Q${x + w / 2} ${y + 8} ${x + w - 2} ${y + 2} L${x + w - 6} ${y + h} Q${x + w / 2} ${y + h + 4} ${x + 6} ${y + h} Z" fill="#b8a888" opacity=".55"/>`;
  for (let i = 1; i < 6; i++) g += `<path d="M${x + w * i / 6} ${y + 3} L${x + w * i / 6 + (i - 3) * .8} ${y + h}" stroke="#8a7a5a" stroke-width=".8" opacity=".8"/>`;
  for (let j = 1; j < 4; j++) g += `<path d="M${x + 3} ${y + 3 + h * j / 4} Q${x + w / 2} ${y + 6 + h * j / 4} ${x + w - 3} ${y + 3 + h * j / 4}" stroke="#8a7a5a" stroke-width=".8" fill="none" opacity=".8"/>`;
  for (let i = 0; i < 5; i++) g += `<ellipse cx="${x + 8 + i * (w - 16) / 4}" cy="${y + h + 1}" rx="2.2" ry="1.4" fill="#9a6a44"/>`;
  return g;
};
const ripples = (pts, c, op = 0.6) => pts.map(([x, y, w]) => `<path d="M${x} ${y} h${w}" stroke="${c}" stroke-width="2.5" stroke-linecap="round" opacity="${op}"/>`).join('');

// ---------- 真間の井（昼） ----------
function mamaWell() {
  let s = `<rect width="480" height="360" fill="${grad([[0, '#a9d8f1'], [.6, '#d4ecf8'], [1, '#f1f9fc']])}"/>`;
  s += `<path d="M40 52 q10 -10 24 -4 q12 -8 22 2 q10 0 8 8 h-56 q-6 -4 2 -6 z M330 34 q8 -8 18 -2 q10 -6 18 2 q8 0 6 6 h-46 q-4 -4 4 -6z" fill="#ffffff" opacity=".85"/>`;
  // 遠くの海と砂州（右）
  s += `<rect x="250" y="150" width="230" height="20" fill="${grad([[0, '#a6d4ea'], [1, '#86c0dc']])}"/>`;
  s += `<path d="M250 168 Q360 158 480 166 V176 H250 Z" fill="${grad([[0, '#ecdcae'], [1, '#d9c38e']])}"/>`;
  s += pineRow([288, 304, 326, 350, 372, 398, 424, 446, 468], 168, .42, ['#4f7a52', '#6a9466'], 21);
  // 国府台の台地（左・平らな上面と急な崖）
  s += `<path d="M0 98 Q60 92 150 96 Q205 100 226 128 Q250 160 300 176 H0 Z" fill="#7fae67"/>`;
  s += grove(0, 214, 100, '#5f8f4f', '#6f9f58');
  s += `<path d="M150 104 Q200 112 226 140 Q246 162 300 176 H160 Z" fill="#6c9a58" opacity=".7"/>`;
  // 真間の入江（右手前に広がる）
  s += `<path d="M230 176 H480 V300 Q430 268 360 262 Q300 256 268 230 Q248 206 230 176 Z" fill="${grad([[0, '#86c4e0'], [.55, '#6fb3d6'], [1, '#5aa2c8']])}"/>`;
  s += `<path d="M268 230 Q300 256 360 262 Q430 268 480 300 V286 Q430 258 362 252 Q306 246 276 226 Z" fill="#9fd3ea" opacity=".55"/>`;
  s += ripples([[300, 200, 30], [360, 214, 40], [420, 196, 34], [330, 236, 26], [410, 240, 40]], '#ffffff', 0.55);
  s += tamamo(318, 250, '#3f7f5a') + tamamo(402, 258, '#3f7f5a', 4) + tamamo(452, 230, '#3f7f5a', 2);
  s += grebe(372, 226, 0.9) + grebe(430, 210, 0.7);
  // 里の地面
  s += `<path d="M0 176 H230 Q248 206 268 230 Q300 256 360 262 Q430 268 480 300 V360 H0 Z" fill="${grad([[0, '#e6d3a2'], [.5, '#dcc492'], [1, '#cdb07a']])}"/>`;
  s += `<path d="M262 226 Q300 254 360 260 Q430 266 480 298 L480 306 Q430 274 360 268 Q296 262 258 232 Z" fill="#c4a670" opacity=".6"/>`;
  s += `<path d="M0 230 Q120 222 240 236" stroke="#c9ae78" stroke-width="3" fill="none" opacity=".6"/>`;
  // 伏屋（竪穴住居）
  s += fuseya(54, 192, 70, '#b89a5e', '#8a6c3c', '#4a3720') + fuseya(146, 186, 56, '#c2a66a', '#8a6c3c', '#4a3720');
  s += `<path d="M146 152 q-4 -10 2 -18 q6 -8 0 -16" stroke="#ffffff" stroke-width="3" fill="none" opacity=".6" stroke-linecap="round"/>`;
  // 干した網（伏屋のわき）と、岸に引き上げた丸木舟
  s += net(178, 156, 34, 26);
  s += marukibune(300, 226, .62, {f: -1});
  s += `<path d="M266 232 q34 6 70 2" stroke="#ffffff" stroke-width="1.6" fill="none" opacity=".7"/>`;
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
  // 草で編んだかご（貝や魚を入れて井戸のそばに置く）
  s += kago(wx + 2, wy + 52, .9) + kago(wx - 44, wy + 48, .75, {fill: 'greens'});
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
  s += pineRow([340, 358, 380, 404, 428, 450, 472], 196, .55, ['#4a3446', '#553c50'], 33, 5);
  // 水鳥（ねぐらへ帰る）
  s += `<path d="M150 70 q6 -6 12 0 q6 -6 12 0 M182 56 q5 -5 10 0 q5 -5 10 0 M126 84 q4 -4 8 0 q4 -4 8 0" stroke="#3b2d4b" stroke-width="2.5" fill="none" stroke-linecap="round"/>`;
  // 手前の岸と葦
  s += `<path d="M0 300 Q120 284 220 312 T480 300 V360 H0 Z" fill="${grad([[0, '#4a3e2c'], [1, '#2e281c']])}"/>`;
  s += marukibune(236, 318, .9, {dark: true, f: -1});
  s += reeds(0, 80, 340, '#2a2a1a', 5, 100) + reeds(400, 480, 340, '#2a2a1a', 9, 110);
  return s;
}

// ---------- 真間の継橋（昼） ----------
function tsugihashi() {
  let s = `<rect width="480" height="360" fill="${grad([[0, '#b2dcf2'], [.55, '#d9eef8'], [1, '#f2f9fc']])}"/>`;
  s += `<path d="M380 48 q10 -10 24 -4 q12 -8 22 2 q10 0 8 8 h-56 q-6 -4 2 -6 z" fill="#ffffff" opacity=".85"/>`;
  // 国府台（奥）
  s += `<path d="M0 132 Q120 124 220 130 Q260 134 280 160 H0 Z" fill="#8fbf74"/>`;
  s += grove(0, 260, 132, '#78a862', '#86b46c', 5);
  // 入江と海
  s += `<rect y="158" width="480" height="202" fill="${grad([[0, '#93cbe4'], [.4, '#74b8d9'], [1, '#559fc6']])}"/>`;
  s += `<rect x="280" y="158" width="200" height="12" fill="${grad([[0, '#b2dbee'], [1, '#93cbe4']])}"/>`;
  s += ripples([[30, 290, 40], [150, 300, 30], [330, 296, 44], [420, 318, 30], [200, 330, 50], [80, 334, 30]], '#ffffff', 0.55);
  // 左右の砂州と道
  const sand = grad([[0, '#f0e1b4'], [1, '#d6bd86']]);
  s += `<path d="M-10 214 Q70 200 160 210 Q178 222 160 236 H-10 Z" fill="${sand}"/>`;
  s += `<path d="M330 212 Q420 200 490 206 V238 H322 Q306 224 330 212 Z" fill="${sand}"/>`;
  s += `<path d="M-10 232 Q80 238 160 236 M322 236 Q400 240 490 236" stroke="#c4a670" stroke-width="3" fill="none" opacity=".6"/>`;
  s += `<path d="M0 222 Q80 214 160 222 M330 222 Q410 214 480 218" stroke="#cdb57f" stroke-width="5" fill="none" stroke-linecap="round"/>`;
  s += pineRow([10, 34, 62, 86, 112, 138], 212, .62, ['#466e4a', '#5f8a5e'], 7, -4);
  s += pineRow([346, 372, 398, 424, 452, 474], 210, .62, ['#466e4a', '#5f8a5e'], 13, 4);
  // 継橋：杭で支えた平らな板橋を、中ほどでつなぐ
  const deckY = 212;
  for (const x of [168, 200, 232, 248, 280, 312]) s += `<rect x="${x}" y="${deckY}" width="7" height="${x === 232 || x === 248 ? 46 : 40}" fill="#5a3a20"/>`;
  s += `<rect x="156" y="${deckY - 6}" width="86" height="9" fill="#a0683a"/><rect x="236" y="${deckY - 4}" width="92" height="9" fill="#a8703f"/>`;
  s += `<path d="M156 ${deckY - 6} h86 M236 ${deckY - 4} h92" stroke="#7a4a24" stroke-width="2"/>`;
  for (let x = 162; x < 326; x += 12) s += `<path d="M${x} ${deckY - 5} v7" stroke="#8a5a30" stroke-width="1.2" opacity=".7"/>`;
  s += ripples([[166, 254, 14], [198, 254, 14], [230, 260, 30], [278, 254, 14], [310, 254, 14]], '#ffffff', 0.7);
  // 橋のたもとにつないだ丸木舟と、橋の上に置いたかご
  s += `<path d="M206 262 q-8 4 -14 14" stroke="#8a6a3a" stroke-width="1.4" fill="none"/>`;
  s += marukibune(236, 280, .72);
  s += `<path d="M200 288 q36 6 76 0" stroke="#ffffff" stroke-width="1.8" fill="none" opacity=".7"/>`;
  s += kago(176, 204, .55);
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
  s += pineRow([292, 312, 336, 362, 388, 414, 440, 466], 246, .55, ['#101a32', '#152240'], 41, 4);
  // 入江と月の道
  s += `<rect y="244" width="480" height="116" fill="${grad([[0, '#2a4470'], [1, '#18264a']])}"/>`;
  s += ripples([[350, 256, 60], [360, 270, 40], [366, 284, 28], [372, 298, 16], [80, 280, 30], [180, 300, 40]], '#f3e3a3', 0.6);
  s += marukibune(214, 292, .7, {dark: true, paddle: false});
  s += `<path d="M180 298 q34 4 70 0" stroke="#f3e3a3" stroke-width="1.4" fill="none" opacity=".5"/>`;
  s += `<path d="M0 316 Q160 300 280 322 T480 312 V360 H0 Z" fill="#141e36"/>`;
  s += reeds(0, 70, 360, '#0f1a30', 2, 100) + reeds(410, 480, 360, '#0f1a30', 6, 110);
  return s;
}

const out = process.argv[2];
for (const [n, f] of Object.entries({'mama-well': mamaWell, 'inlet-sunset': inletSunset, tsugihashi, 'title-card': titleCard})) {
  defs = []; gid = 0;
  const body = f();
  fs.writeFileSync(path.join(out, `${n}.svg`), `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="360" viewBox="0 0 480 360"><title>${n}</title>${defs.length ? `<defs>${defs.join('')}</defs>` : ''}${body}</svg>\n`);
}
console.log('4 files');
