// コウノトリが水辺から飛び立つ3枚の絵（版4の絵柄：輪郭線なしの平面イラスト）。
// 240x240, viewBox 0 -40 240 240。3枚とも足もとの水面を y=170 にそろえる。回転中心は画像の左上から (120, 210)（水面の中央）。
// コウノトリ：白い体、黒い風切羽、黒く長いくちばし、目のまわりと脚は赤。画面の左へ向かって飛び立つ。
const fs = require('fs');
const path = require('path');

const C = {white: '#f6f3ea', shade: '#dcd6c6', black: '#1f1e24', black2: '#34333b', bill: '#2a2a30', red: '#d8473c', eye: '#f2e6b0', water: '#ffffff'};
const r1 = v => +v.toFixed(1);

// 首から頭とくちばし。base は首の付け根、ang は首の向き（度、0 で右、180 で左）、len は首の長さ
function neckHead(base, ang, len, {billDown = 0, bend = 0} = {}) {
  const a = ang * Math.PI / 180, mid = [base[0] + Math.cos(a) * len * .5 + bend, base[1] + Math.sin(a) * len * .5 - Math.abs(bend) * .4];
  const head = [base[0] + Math.cos(a) * len, base[1] + Math.sin(a) * len];
  let s = `<path d="M${base[0]} ${base[1]} Q${r1(mid[0])} ${r1(mid[1])} ${r1(head[0])} ${r1(head[1])}" stroke="${C.white}" stroke-width="11" stroke-linecap="round" fill="none"/>`;
  const dir = Math.cos(a) < 0 ? -1 : 1, ba = (dir < 0 ? 180 : 0) + billDown * dir;
  s += `<g transform="translate(${r1(head[0])} ${r1(head[1])}) rotate(${r1(ba)})">`;
  s += `<ellipse cx="0" cy="0" rx="9" ry="7.5" fill="${C.white}"/>`;
  s += `<path d="M5 -3 L40 1 L5 3 Z" fill="${C.bill}"/><path d="M8 0 L38 1" stroke="#55545c" stroke-width=".8"/>`;
  s += `<ellipse cx="3" cy="-1.5" rx="3.6" ry="3" fill="${C.red}"/><circle cx="3.4" cy="-1.6" r="1.6" fill="${C.eye}"/><circle cx="3.6" cy="-1.6" r=".8" fill="#1a1a1a"/>`;
  return s + `</g>`;
}
// 胴体：中心 c、傾き tilt（度）。尾は黒い風切羽が少し見える
const body = (c, tilt) =>
  `<g transform="translate(${c[0]} ${c[1]}) rotate(${tilt})">` +
  `<path d="M28 -2 L46 -6 L44 4 L26 6 Z" fill="${C.black}"/>` +
  `<ellipse cx="0" cy="0" rx="32" ry="15" fill="${C.white}"/><path d="M-26 6 Q0 18 28 6 Q0 12 -26 6 Z" fill="${C.shade}"/>` +
  `</g>`;
// 翼：付け根 root から、角度 ang（度）の方向に長さ len で広げる。前半（腕）は白、後半の風切羽は黒
function wing(root, ang, len, {spread = 1, far = false} = {}) {
  const a = ang * Math.PI / 180, ux = Math.cos(a), uy = Math.sin(a), nx = -uy, ny = ux;
  const P = (t, n) => [root[0] + ux * len * t + nx * n, root[1] + uy * len * t + ny * n];
  const w = 20 * spread;
  const tip = P(1, 0), elbow = P(.42, -4);
  const cov = far ? C.shade : C.white;
  // 風切羽（黒）：先が指のように分かれる
  const pt = q => q.map(r1).join(' ');
  let d = `M${pt(P(0, 2))} L${pt(elbow)} L${pt(tip)}`;
  // 先の5枚の初列風切は指のように分かれ、次列風切の後ろのふちはなめらかに
  for (let i = 0; i < 5; i++) { const t = 1 - i * .055; d += ` Q${pt(P(t + .01, w * (.12 + i * .15)))} ${pt(P(t - .02, w * (.2 + i * .15)))} L${pt(P(t - .13, w * (.24 + i * .15)))}`; }
  d += ` Q${pt(P(.6, w * 1.05))} ${pt(P(.35, w * .98))} Q${pt(P(.15, w * .95))} ${pt(P(0, w * .6))} Z`;
  let s = `<path d="${d}" fill="${far ? C.black2 : C.black}"/>`;
  // 雨覆（白）
  s += `<path d="M${pt(P(0, -2))} L${pt(elbow)} Q${pt(P(.7, 2))} ${pt(P(.78, w * .35))} Q${pt(P(.45, w * .55))} ${pt(P(.1, w * .5))} Z" fill="${cov}"/>`;
  return s;
}
// 脚：赤く細長い。ひざ（実際はかかと）が後ろへ曲がる
const leg = (hip, knee, foot, toeDir = -1) =>
  `<path d="M${hip[0]} ${hip[1]} L${knee[0]} ${knee[1]} L${foot[0]} ${foot[1]}" stroke="${C.red}" stroke-width="3.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>` +
  `<path d="M${foot[0]} ${foot[1]} l${toeDir * 9} 1 M${foot[0]} ${foot[1]} l${toeDir * 5} 3 M${foot[0]} ${foot[1]} l${-toeDir * 5} 1" stroke="${C.red}" stroke-width="2.2" stroke-linecap="round"/>`;
const ripple = (cx, cy, rx, op = .8) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${r1(rx * .18)}" fill="none" stroke="${C.water}" stroke-width="2" opacity="${op}"/>`;
const drops = pts => pts.map(([x, y, r]) => `<path d="M${x} ${y - r * 1.6} Q${x + r} ${y} ${x} ${y + r} Q${x - r} ${y} ${x} ${y - r * 1.6} Z" fill="#bfe6f6"/>`).join('');
const splash = (cx, cy, w) => `<path d="M${cx - w} ${cy} Q${cx - w * .7} ${cy - w * .6} ${cx - w * .4} ${cy - 2} Q${cx - w * .2} ${cy - w * .9} ${cx} ${cy - 2} Q${cx + w * .25} ${cy - w * .8} ${cx + w * .45} ${cy - 2} Q${cx + w * .75} ${cy - w * .5} ${cx + w} ${cy} Z" fill="#d6f0fa" opacity=".9"/>`;

// 1枚目：身をかがめ、翼を半分ひらいて飛び立つ構え
function frame1() {
  let s = ripple(118, 171, 44, .7) + ripple(118, 171, 26, .9);
  s += leg([124, 122], [138, 144], [122, 168], -1) + leg([112, 122], [124, 146], [104, 168], -1);
  s += wing([132, 96], -150, 70, {spread: .8, far: true});
  s += body([120, 112], -12);
  s += neckHead([94, 104], 200, 30, {billDown: 28, bend: -4});
  s += wing([126, 100], -132, 76, {spread: .9});
  return s;
}
// 2枚目：脚で水をけり、翼を高く振り上げる
function frame2() {
  let s = splash(116, 170, 34) + ripple(116, 172, 52, .6);
  s += drops([[86, 150, 2.4], [96, 140, 2], [140, 146, 2.6], [150, 156, 2], [118, 134, 1.8]]);
  s += leg([126, 104], [140, 130], [128, 162], -1) + leg([114, 104], [128, 132], [114, 166], -1);
  s += wing([128, 74], -112, 84, {spread: .85, far: true});
  s += body([118, 92], -24);
  s += neckHead([92, 78], 205, 34, {billDown: 8});
  s += wing([122, 80], -96, 92, {spread: 1});
  return s;
}
// 3枚目：首をのばし、翼を打ちおろして宙に浮く。脚は後ろへのばす
function frame3() {
  let s = ripple(130, 172, 60, .45) + ripple(130, 172, 36, .6);
  s += drops([[120, 120, 2], [134, 138, 2.2], [146, 154, 1.8]]);
  s += `<path d="M142 72 L196 82 M138 74 L194 90" stroke="${C.red}" stroke-width="3.2" stroke-linecap="round"/><path d="M196 82 l7 -2 M194 90 l7 1" stroke="${C.red}" stroke-width="2" stroke-linecap="round"/>`;
  s += wing([124, 62], -200, 86, {spread: .85, far: true});
  s += body([120, 70], -4);
  s += neckHead([92, 64], 188, 36);
  s += wing([118, 66], 150, 96, {spread: 1});
  return s;
}

const out = process.argv[2];
const svg = (name, b) => `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 -40 240 240"><title>${name}</title>${b}</svg>\n`;
const files = {'stork-1': frame1(), 'stork-2': frame2(), 'stork-3': frame3()};
for (const [n, b] of Object.entries(files)) fs.writeFileSync(path.join(out, `${n}.svg`), svg(n, b));
console.log('3 files');
