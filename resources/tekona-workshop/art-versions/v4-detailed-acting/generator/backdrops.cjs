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
  return `<g data-ambient="reeds" data-pivot-x="${(x0 + x1) / 2}" data-pivot-y="${base}">${s}</g>`;
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
// 玉藻（入江の藻）：水面から出た茎と葉を、本数・間隔・高さ・傾き・揺れ方をばらつかせて不規則に生やす
const tamamo = (x, y, c, n = 3) => {
  const rnd = rnd0(Math.round(x * 7 + y * 13));
  const light = '#5f9a6e';
  let s = '';
  const count = n + 1 + Math.floor(rnd() * 3);
  let px = x - 6;
  for (let i = 0; i < count; i++) {
    px += 3 + rnd() * 9;
    const by = y + (rnd() - .5) * 6, h = 10 + rnd() * 18, lean = (rnd() - .5) * 10, sway = (rnd() > .5 ? 1 : -1) * (2 + rnd() * 4);
    const tx = px + lean, ty = by - h, w = (1.6 + rnd() * 1.6).toFixed(1);
    s += `<path d="M${px.toFixed(1)} ${by.toFixed(1)} Q${(px + sway + lean * .3).toFixed(1)} ${(by - h * .5).toFixed(1)} ${tx.toFixed(1)} ${ty.toFixed(1)}" stroke="${rnd() > .6 ? light : c}" stroke-width="${w}" fill="none" stroke-linecap="round"/>`;
    // ところどころに細長い葉
    if (rnd() > .45) { const ly = by - h * (.35 + rnd() * .35), lx = px + sway * .6 + lean * .3, d = rnd() > .5 ? 1 : -1;
      s += `<path d="M${lx.toFixed(1)} ${ly.toFixed(1)} q${(d * 4).toFixed(1)} -2 ${(d * 7).toFixed(1)} -6 q${(-d * 4).toFixed(1)} 4 ${(-d * 7).toFixed(1)} 6 z" fill="${c}" opacity=".9"/>`; }
  }
  // 水面の小さな輪
  s += `<path d="M${(x - 8).toFixed(1)} ${(y + 2).toFixed(1)} q${((px - x) / 2 + 8).toFixed(1)} 4 ${(px - x + 16).toFixed(1)} 0" stroke="#ffffff" stroke-width="1.2" fill="none" opacity=".5"/>`;
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
// 草むら：低い草の小さな株を、間隔と位置をばらつかせて置く
const grass = (x0, x1, y, c, seed = 5, h = 8) => {
  const rnd = rnd0(seed * 97 + 11);
  let r = '';
  for (let x = x0; x < x1; x += 14 + rnd() * 26) {
    const yy = y + rnd() * 18;
    r += `<path d="M${x.toFixed(1)} ${yy.toFixed(1)} l2 ${-h} l2 ${h} l3 ${(-h * .7).toFixed(1)} l1 ${(h * .7).toFixed(1)} z" fill="${c}"/>`;
  }
  return r;
};
const ripples = (pts, c, op = 0.6) => pts.map(([x, y, w]) => `<path d="M${x} ${y} h${w}" stroke="${c}" stroke-width="2.5" stroke-linecap="round" opacity="${op}"/>`).join('');

// 昼の背景は、人物と表情が目立つよう明るく淡い色へ寄せて明暗の差を小さくする（soften）。
// 水平線（遠くの海・砂州・台地のすそ）は、夕日の入江と同じく人物の顔（画面の上から 140〜180）より下の y≈200 に置く。
// 人物は手児奈が画面の左（x 20〜160）、求婚者が右（x 310〜450）に立つので、井戸・家・舟などの小道具は左右に寄せ、人物の後ろに重ねる。
const soften = (svg, t = .3, to = [0xee, 0xf3, 0xef]) => svg.replace(/#([0-9a-f]{6})/gi, (_, h) =>
  '#' + [0, 2, 4].map(i => { const v = parseInt(h.slice(i, i + 2), 16); return Math.round(v + (to[i / 2] - v) * t).toString(16).padStart(2, '0'); }).join(''));
const HORIZON = 200;
// ---------- 真間の井（昼） ----------
function mamaWell() {
  const H = HORIZON;
  let s = `<rect width="480" height="360" fill="${grad([[0, '#b4dcf2'], [.55, '#d6edf8'], [1, '#f1f9fc']])}"/>`;
  s += `<path d="M40 52 q10 -10 24 -4 q12 -8 22 2 q10 0 8 8 h-56 q-6 -4 2 -6 z M330 40 q8 -8 18 -2 q10 -6 18 2 q8 0 6 6 h-46 q-4 -4 4 -6z" fill="#ffffff" opacity=".85"/>`;
  // 遠くの海と砂州・松（右）
  s += `<rect x="220" y="${H - 8}" width="260" height="12" fill="${grad([[0, '#a6d4ea'], [1, '#8cc4de']])}"/>`;
  s += `<path d="M230 ${H + 2} Q350 ${H - 6} 480 ${H} V${H + 8} H230 Z" fill="${grad([[0, '#ecdcae'], [1, '#d9c38e']])}"/>`;
  s += pineRow([300, 318, 340, 362, 384, 408, 432, 454, 474], H + 1, .34, ['#4f7a52', '#6a9466'], 21);
  // 国府台：左手に低くのびる台地のすそ（上は y≈190、木の頭でも 182 まで。人物の顔より下）
  s += `<path d="M0 ${H - 9} Q70 ${H - 12} 150 ${H - 9} Q200 ${H - 6} 236 ${H + 4} H0 Z" fill="${grad([[0, '#8fbf72'], [1, '#6f9f5c']])}"/>`;
  s += grove(0, 200, H - 8, '#5f8f4f', '#6f9f58', 4).replace(/r="([\d.]+)"/g, (m, r) => `r="${(r * .4).toFixed(1)}"`);
  // 真間の入江（右手前に広がる）
  s += `<path d="M236 ${H + 4} H480 V318 Q430 290 372 284 Q318 276 290 252 Q268 224 236 ${H + 4} Z" fill="${grad([[0, '#8ac6e0'], [.6, '#72b4d6'], [1, '#62a8cc']])}"/>`;
  s += `<path d="M290 252 Q318 276 372 284 Q430 290 480 318 V306 Q430 280 374 274 Q322 268 298 248 Z" fill="#a8d8ec" opacity=".6"/>`;
  s += ripples([[300, 218, 30], [372, 230, 40], [430, 214, 34], [340, 256, 26], [420, 262, 40]], '#ffffff', .5);
  s += tamamo(300, 232, '#3f7f5a') + tamamo(452, 252, '#3f7f5a', 2);
  // 里の地面
  s += `<path d="M0 ${H} H236 Q268 224 290 252 Q318 276 372 284 Q430 290 480 318 V360 H0 Z" fill="${grad([[0, '#e6d3a2'], [.5, '#dcc492'], [1, '#cdb07a']])}"/>`;
  s += `<path d="M284 248 Q318 274 372 282 Q430 288 480 316 L480 324 Q430 296 372 290 Q314 282 280 254 Z" fill="#c4a670" opacity=".55"/>`;
  s += `<path d="M0 258 Q120 250 230 262" stroke="#c9ae78" stroke-width="3" fill="none" opacity=".5"/>`;
  // 左：伏屋（手児奈の後ろ）と、木を井の字に組んだ真間の井
  s += fuseya(26, 232, 62, '#b89a5e', '#8a6c3c', '#4a3720') + fuseya(116, 226, 52, '#c2a66a', '#8a6c3c', '#4a3720');
  s += `<path d="M116 192 q-4 -8 2 -14 q6 -6 0 -12" stroke="#ffffff" stroke-width="3" fill="none" opacity=".6" stroke-linecap="round"/>`;
  const wx = 150, wy = 266;
  s += `<ellipse cx="${wx}" cy="${wy + 26}" rx="60" ry="9" fill="#c2a46f"/>`;
  s += `<path d="M${wx - 42} ${wy - 6} h84 l10 14 h-104 z" fill="${grad([[0, '#2c4d63'], [1, '#4f7e98']])}"/>`;
  s += `<path d="M${wx - 36} ${wy - 2} q36 5 72 0" stroke="#9fd3ea" stroke-width="2.5" fill="none" opacity=".8"/>`;
  for (let i = 0; i < 3; i++) s += `<rect x="${wx - 52}" y="${wy + 8 + i * 9}" width="104" height="9" rx="3" fill="${i % 2 ? '#8a5a30' : '#7a4c26'}"/>`;
  s += `<rect x="${wx - 56}" y="${wy + 2}" width="9" height="33" rx="3" fill="#6a4020"/><rect x="${wx + 47}" y="${wy + 2}" width="9" height="33" rx="3" fill="#6a4020"/>`;
  s += `<rect x="${wx - 60}" y="${wy}" width="120" height="8" rx="3" fill="#9a6a3a"/>`;
  s += `<path d="M${wx + 30} ${wy - 2} q18 -4 24 10" stroke="#a88a5a" stroke-width="2" fill="none"/><rect x="${wx + 48}" y="${wy + 6}" width="18" height="14" rx="2" fill="#c8a46a"/><path d="M${wx + 48} ${wy + 10} h18" stroke="#9a7a48" stroke-width="2"/>`;
  s += `<path d="M30 ${wy + 12} q-12 16 -4 30 q14 10 28 0 q8 -14 -4 -30 z" fill="#b5703c"/><ellipse cx="40" cy="${wy + 12}" rx="10" ry="3.5" fill="#7a4a24"/>`;
  s += kago(wx + 2, wy + 54, .85) + kago(wx - 40, wy + 50, .7, {fill: 'greens'});
  // 右：岸に引き上げた丸木舟と、竿に干した網（求婚者の後ろ）
  s += net(404, H + 6, 36, 26);
  s += marukibune(372, 280, .7, {f: -1});
  s += `<path d="M332 288 q40 6 84 2" stroke="#ffffff" stroke-width="1.6" fill="none" opacity=".7"/>`;
  // 手前の葦
  s += reeds(0, 50, 360, '#5f8d44', 7, 80) + reeds(436, 480, 360, '#4f7a3a', 11, 86);
  return soften(s);
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
  s += `<g data-ambient="birds"><path d="M150 70 q6 -6 12 0 q6 -6 12 0 M182 56 q5 -5 10 0 q5 -5 10 0 M126 84 q4 -4 8 0 q4 -4 8 0" stroke="#3b2d4b" stroke-width="2.5" fill="none" stroke-linecap="round"/></g>`;
  // 手前の岸と葦
  s += `<path d="M0 300 Q120 284 220 312 T480 300 V360 H0 Z" fill="${grad([[0, '#4a3e2c'], [1, '#2e281c']])}"/>`;
  s += marukibune(236, 318, .9, {dark: true, f: -1});
  s += reeds(0, 80, 340, '#2a2a1a', 5, 100) + reeds(400, 480, 340, '#2a2a1a', 9, 110);
  return s;
}

// ---------- 真間の継橋（昼） ----------
function tsugihashi() {
  const H = HORIZON;
  let s = `<rect width="480" height="360" fill="${grad([[0, '#b4dcf2'], [.55, '#d6edf8'], [1, '#f1f9fc']])}"/>`;
  s += `<path d="M380 52 q10 -10 24 -4 q12 -8 22 2 q10 0 8 8 h-56 q-6 -4 2 -6 z M60 70 q8 -8 18 -2 q10 -6 18 2 q8 0 6 6 h-46 q-4 -4 4 -6z" fill="#ffffff" opacity=".85"/>`;
  // 国府台（奥、低く）
  s += `<path d="M0 ${H - 9} Q110 ${H - 12} 210 ${H - 9} Q250 ${H - 6} 270 ${H + 2} H0 Z" fill="${grad([[0, '#a6cf8c'], [1, '#86b46c']])}"/>`;
  s += grove(0, 250, H - 8, '#78a862', '#86b46c', 5).replace(/r="([\d.]+)"/g, (m, r) => `r="${(r * .4).toFixed(1)}"`);
  // 入江と海
  s += `<rect y="${H}" width="480" height="${360 - H}" fill="${grad([[0, '#9acfe6'], [.4, '#7cbcdb'], [1, '#5ea3c8']])}"/>`;
  s += `<rect x="270" y="${H}" width="210" height="6" fill="#b2dbee"/>`;
  s += ripples([[30, 292, 40], [140, 300, 30], [330, 302, 44], [210, 296, 40], [250, 280, 30]], '#ffffff', .5);
  // 左右の砂州と、その上の道・松
  const sand = grad([[0, '#f0e1b4'], [1, '#d6bd86']]);
  s += `<path d="M-10 238 Q70 226 168 234 Q184 244 168 256 H-10 Z" fill="${sand}"/>`;
  s += `<path d="M312 236 Q410 224 490 230 V258 H306 Q292 246 312 236 Z" fill="${sand}"/>`;
  s += `<path d="M-10 254 Q80 260 168 256 M306 258 Q400 262 490 258" stroke="#c4a670" stroke-width="3" fill="none" opacity=".6"/>`;
  s += `<path d="M0 244 Q80 238 166 244 M314 244 Q400 238 480 240" stroke="#cdb57f" stroke-width="4" fill="none" stroke-linecap="round"/>`;
  s += pineRow([8, 32, 58, 84, 108, 136], 236, .5, ['#466e4a', '#5f8a5e'], 7, -4);
  s += pineRow([326, 352, 378, 404, 430, 456, 476], 234, .5, ['#466e4a', '#5f8a5e'], 13, 4);
  // 継橋：水面すれすれの低い板橋を、短い杭で支えて中ほどでつなぐ
  const deck = 247, water = 255;
  for (const x of [170, 196, 222, 238, 264, 290]) s += `<rect x="${x}" y="${deck + 2}" width="5" height="${water - deck + 3}" fill="#5a3a20"/><path d="M${x - 3} ${water + 4} q5.5 2 11 0" stroke="#ffffff" stroke-width="1.4" fill="none" opacity=".7"/>`;
  s += `<rect x="160" y="${deck - 3}" width="84" height="6" rx="1" fill="${grad([[0, '#c4884e'], [1, '#8a5a30']])}"/><rect x="234" y="${deck - 2}" width="82" height="6" rx="1" fill="${grad([[0, '#c88e54'], [1, '#8f5f34']])}"/>`;
  s += `<path d="M160 ${deck - 3} h84 M234 ${deck - 2} h82" stroke="#f0c890" stroke-width="1.2"/>`;
  for (let x = 166; x < 314; x += 10) s += `<path d="M${x} ${deck - 2} v5" stroke="#7a4a24" stroke-width="1" opacity=".7"/>`;
  s += `<path d="M160 ${water + 1} h156" stroke="#2a5a7a" stroke-width="5" opacity=".15"/>`;
  s += ripples([[176, 262, 20], [226, 264, 30], [276, 262, 22]], '#ffffff', .65);
  // 左：砂州のかご（手児奈の後ろ）／右：岸につないだ丸木舟（求婚者の後ろ）
  s += kago(118, 246, .6) + kago(140, 250, .5, {fill: 'greens'});
  s += `<path d="M352 258 q4 10 12 18" stroke="#8a6a3a" stroke-width="1.4" fill="none"/>`;
  s += marukibune(390, 282, .72, {f: -1});
  s += `<path d="M352 290 q40 6 80 0" stroke="#ffffff" stroke-width="1.8" fill="none" opacity=".7"/>`;
  s += tamamo(220, 300, '#3f7f5a') + tamamo(96, 296, '#3f7f5a', 2);
  // 手前の低い砂地：人物が水の中に立って見えないよう、足もとにゆるやかな起伏のある浜を置く
  s += `<path d="M0 326 Q50 314 110 320 Q170 326 230 318 Q300 310 360 320 Q420 328 480 316 V360 H0 Z" fill="${grad([[0, '#ead9a8'], [1, '#d4ba84']])}"/>`;
  s += `<path d="M0 326 Q50 314 110 320 Q170 326 230 318 Q300 310 360 320 Q420 328 480 316" stroke="#f6edd2" stroke-width="2.4" fill="none" opacity=".8"/>`;
  s += `<path d="M0 330 Q50 320 110 325 Q170 331 230 323 Q300 316 360 325 Q420 333 480 321 L480 326 Q420 338 360 330 Q300 322 230 328 Q170 336 110 330 Q50 325 0 335 Z" fill="#c4a670" opacity=".45"/>`;
  s += `<path d="M40 344 q30 -6 60 0 M180 350 q36 -6 70 0 M330 346 q30 -5 60 0" stroke="#c9ad78" stroke-width="2" fill="none" opacity=".6"/>`;
  s += grass(56, 430, 330, '#9ab066', 4, 5);
  // 手前の葦
  s += reeds(0, 48, 360, '#4f7a3a', 3, 84) + reeds(438, 480, 360, '#5f8d44', 13, 86);
  return soften(s);
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

module.exports = {reeds, pine, grove, fuseya, grebe, tamamo, rnd0, pineTree, pineRow, marukibune, kago, net, grass, ripples, soften, HORIZON};
if (require.main === module) {
const out = process.argv[2];
for (const [n, f] of Object.entries({'mama-well': mamaWell, 'inlet-sunset': inletSunset, tsugihashi, 'title-card': titleCard})) {
  defs = []; gid = 0;
  const body = f();
  fs.writeFileSync(path.join(out, `${n}.svg`), `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="360" viewBox="0 0 480 360"><title>${n}</title>${defs.length ? `<defs>${defs.join('')}</defs>` : ''}${body}</svg>\n`);
}
console.log('4 files');
}
