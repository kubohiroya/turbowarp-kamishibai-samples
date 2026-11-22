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
  s += `<ellipse cx="2.6" cy="-3.4" rx="3.4" ry="2.8" fill="${C.red}"/><circle cx="3" cy="-3.5" r="1.5" fill="${C.eye}"/><circle cx="3.2" cy="-3.5" r=".8" fill="#1a1a1a"/>`;
  return s + `</g>`;
}
// 首を胴体の中から生やす：胴体の前寄り（中心 c、傾き tilt）の点から、もとの首の先（頭）までを結ぶ。
// 付け根は太く、頭へ向かって細くする。胴体より先に描き、付け根を胴体で隠す
function neckFromBody(c, tilt, base, ang, len, opts = {}) {
  const t = tilt * Math.PI / 180, lx = -20, ly = -6;
  const root = [c[0] + lx * Math.cos(t) - ly * Math.sin(t), c[1] + lx * Math.sin(t) + ly * Math.cos(t)];
  const a = ang * Math.PI / 180, head = [base[0] + Math.cos(a) * len, base[1] + Math.sin(a) * len];
  const na = Math.atan2(head[1] - root[1], head[0] - root[0]) * 180 / Math.PI, nl = Math.hypot(head[0] - root[0], head[1] - root[1]);
  // 付け根（太さ18）から首の中ほど（太さ11）へ、なめらかに細くなる形
  const ux = (head[0] - root[0]) / nl, uy = (head[1] - root[1]) / nl, nx = -uy, ny = ux;
  const end = [root[0] + ux * nl * .6, root[1] + uy * nl * .6];
  const q = (p, w) => `${r1(p[0] + nx * w)} ${r1(p[1] + ny * w)}`;
  return `<path d="M${q(root, 9)} Q${q([root[0] + ux * nl * .3, root[1] + uy * nl * .3], 6.2)} ${q(end, 5.5)} L${q(end, -5.5)} Q${q([root[0] + ux * nl * .3, root[1] + uy * nl * .3], -6.2)} ${q(root, -9)} Z" fill="${C.white}"/>` +
    `<circle cx="${r1(root[0])}" cy="${r1(root[1])}" r="9" fill="${C.white}"/>` +
    neckHead(root, na, nl, opts);
}
// 胴体：中心 c、傾き tilt（度）。尾は黒い風切羽が少し見える
const body = (c, tilt) =>
  `<g transform="translate(${c[0]} ${c[1]}) rotate(${tilt})">` +
  `<path d="M28 -2 L46 -6 L44 4 L26 6 Z" fill="${C.black}"/>` +
  `<ellipse cx="0" cy="0" rx="32" ry="15" fill="${C.white}"/><path d="M-26 6 Q0 18 28 6 Q0 12 -26 6 Z" fill="${C.shade}"/>` +
  `</g>`;
// 胴体の座標（中心 c・傾き tilt の胴体の上での位置 lx, ly）を画面の座標へ
const bodyPt = (c, tilt, lx, ly) => { const t = tilt * Math.PI / 180; return [r1(c[0] + lx * Math.cos(t) - ly * Math.sin(t)), r1(c[1] + lx * Math.sin(t) + ly * Math.cos(t))]; };
// 斜めの楕円（a から b の向きに長い）
const oval = (a, b, ry, fill, t = .5) => {
  const cx = a[0] + (b[0] - a[0]) * t, cy = a[1] + (b[1] - a[1]) * t, ang = Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI;
  return `<ellipse cx="${r1(cx)}" cy="${r1(cy)}" rx="${r1(Math.hypot(b[0] - a[0], b[1] - a[1]) / 2)}" ry="${ry}" transform="rotate(${r1(ang)} ${r1(cx)} ${r1(cy)})" fill="${fill}"/>`;
};
// 肩から上腕：翼の付け根（肩）から、翼の向きへのびる白い楕円。翼の白い雨覆につながる
const upperArm = (shoulder, ang, len, far = false) => {
  const a = ang * Math.PI / 180, end = [shoulder[0] + Math.cos(a) * len * .4, shoulder[1] + Math.sin(a) * len * .4];
  const start = [shoulder[0] - Math.cos(a) * 6, shoulder[1] - Math.sin(a) * 6];
  return oval(start, end, 8.5, far ? C.shade : C.white);
};
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
// 足：前の3本の指と、その付け根をつなぐ水かき、後ろの短い指。dir は指先の向き（度）
function foot(p, dir, {far = false} = {}) {
  const red = far ? '#b83a32' : C.red, web = far ? '#d9837a' : '#f4ada4';
  const toe = (d, l) => [p[0] + Math.cos(d * Math.PI / 180) * l, p[1] + Math.sin(d * Math.PI / 180) * l];
  const t1 = toe(dir - 24, 13), t2 = toe(dir, 15), t3 = toe(dir + 24, 12), hind = toe(dir + 160, 5);
  const m = (t, k) => [p[0] + (t[0] - p[0]) * k, p[1] + (t[1] - p[1]) * k];
  let s = `<path d="M${p.map(r1).join(' ')} L${m(t1, .7).map(r1).join(' ')} Q${m(t2, .42).map(r1).join(' ')} ${m(t2, .72).map(r1).join(' ')} Q${m(t2, .42).map(r1).join(' ')} ${m(t3, .7).map(r1).join(' ')} Z" fill="${web}"/>`;
  for (const t of [t1, t2, t3, hind]) s += `<path d="M${p.map(r1).join(' ')} L${t.map(r1).join(' ')}" stroke="${red}" stroke-width="1.5" stroke-linecap="round"/>`;
  for (const t of [t1, t2, t3]) s += `<circle cx="${r1(t[0])}" cy="${r1(t[1])}" r=".9" fill="#3a2a28"/>`;
  return s;
}
// 脚：赤く細長い。曲がって後ろへ出る関節（かかと）、指と水かき
const leg = (hip, knee, ft, toeDir = 180, far = false) =>
  `<path d="M${hip[0]} ${hip[1]} L${knee[0]} ${knee[1]} L${ft[0]} ${ft[1]}" stroke="${far ? '#b83a32' : C.red}" stroke-width="3.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>` +
  foot(ft, toeDir, {far});
// 脚の付け根の羽毛：すねの上をおおう斜めの白い楕円（胴体の後に描く）
const thigh = (hip, knee, far = false) => oval([hip[0] + (hip[0] - knee[0]) * .25, hip[1] + (hip[1] - knee[1]) * .25], [hip[0] + (knee[0] - hip[0]) * .42, hip[1] + (knee[1] - hip[1]) * .42], 5.5, far ? C.shade : C.white);
const ripple = (cx, cy, rx, op = .8) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${r1(rx * .18)}" fill="none" stroke="${C.water}" stroke-width="2" opacity="${op}"/>`;
const drops = pts => pts.map(([x, y, r]) => `<path d="M${x} ${y - r * 1.6} Q${x + r} ${y} ${x} ${y + r} Q${x - r} ${y} ${x} ${y - r * 1.6} Z" fill="#bfe6f6"/>`).join('');
const splash = (cx, cy, w) => `<path d="M${cx - w} ${cy} Q${cx - w * .7} ${cy - w * .6} ${cx - w * .4} ${cy - 2} Q${cx - w * .2} ${cy - w * .9} ${cx} ${cy - 2} Q${cx + w * .25} ${cy - w * .8} ${cx + w * .45} ${cy - 2} Q${cx + w * .75} ${cy - w * .5} ${cx + w} ${cy} Z" fill="#d6f0fa" opacity=".9"/>`;

// 1枚目：身をかがめ、翼を半分ひらいて飛び立つ構え
function frame1() {
  const c = [120, 112], tilt = -12;
  const legs = [[[124, 120], [138, 144], [122, 168], true], [[112, 120], [124, 146], [104, 168], false]];
  let s = ripple(118, 171, 44, .7) + ripple(118, 171, 26, .9);
  for (const [h, k, f, far] of legs) s += leg(h, k, f, 184, far) + (far ? thigh(h, k, true) : '');
  const sf = bodyPt(c, tilt, -4, -11), sn = bodyPt(c, tilt, -10, -8);
  s += wing(sf, -140, 74, {spread: .8, far: true}) + upperArm(sf, -140, 74, true);
  s += neckFromBody(c, tilt, [94, 104], 200, 30, {billDown: 28, bend: -4});
  s += body(c, tilt);
  for (const [h, k, , far] of legs) if (!far) s += thigh(h, k);
  s += wing(sn, -124, 80, {spread: .9}) + upperArm(sn, -124, 80);
  return s;
}
// 2枚目：脚で水をけり、翼を高く振り上げる
function frame2() {
  const c = [118, 92], tilt = -24;
  const legs = [[[126, 102], [140, 130], [128, 162], true], [[114, 102], [128, 132], [114, 166], false]];
  let s = splash(116, 170, 34) + ripple(116, 172, 52, .6);
  s += drops([[86, 150, 2.4], [96, 140, 2], [140, 146, 2.6], [150, 156, 2], [118, 134, 1.8]]);
  for (const [h, k, f, far] of legs) s += leg(h, k, f, 196, far) + (far ? thigh(h, k, true) : '');
  const sf = bodyPt(c, tilt, -4, -11), sn = bodyPt(c, tilt, -10, -8);
  s += wing(sf, -106, 86, {spread: .85, far: true}) + upperArm(sf, -106, 86, true);
  s += neckFromBody(c, tilt, [92, 78], 205, 34, {billDown: 8});
  s += body(c, tilt);
  for (const [h, k, , far] of legs) if (!far) s += thigh(h, k);
  s += wing(sn, -92, 94, {spread: 1}) + upperArm(sn, -92, 94);
  return s;
}
// 3枚目：首をのばし、翼を打ちおろして宙に浮く。脚は後ろへのばし、指をそろえる
function frame3() {
  const c = [120, 70], tilt = -4;
  const legs = [[[138, 76], [168, 82], [194, 88], true], [[134, 80], [164, 88], [192, 96], false]];
  let s = ripple(130, 172, 60, .45) + ripple(130, 172, 36, .6);
  s += drops([[120, 120, 2], [134, 138, 2.2], [146, 154, 1.8]]);
  for (const [h, k, f, far] of legs) s += leg(h, k, f, 12, far) + (far ? thigh(h, k, true) : '');
  const sf = bodyPt(c, tilt, -6, -10), sn = bodyPt(c, tilt, -12, -6);
  s += wing(sf, -196, 86, {spread: .85, far: true}) + upperArm(sf, -196, 86, true);
  s += neckFromBody(c, tilt, [92, 64], 188, 36);
  s += body(c, tilt);
  for (const [h, k, , far] of legs) if (!far) s += thigh(h, k);
  s += wing(sn, 146, 96, {spread: 1}) + upperArm(sn, 146, 96);
  return s;
}

const out = process.argv[2];
const svg = (name, b) => `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 -40 240 240"><title>${name}</title>${b}</svg>\n`;
const files = {'stork-1': frame1(), 'stork-2': frame2(), 'stork-3': frame3()};
for (const [n, b] of Object.entries(files)) fs.writeFileSync(path.join(out, `${n}.svg`), svg(n, b));
console.log('3 files');
