// コウノトリが水辺から飛び立つ4枚の絵（版4の絵柄：輪郭線なしの平面イラスト）。
// 320x240, viewBox -80 -40 320 240。4枚とも水面を y=170 にそろえる。回転中心は画像の左上から (198, 210)（水面）。
// 鳥は2〜4枚目のあいだに前（画面の左）へ進み、飛び立った場所の波紋は鳥から見て後ろ（右）へ遠ざかる：
// 1・2枚目は足もと、3枚目はけり出した足先より後ろ、4枚目は画像の右へ見切れる。
// 動き：あごを引き、翼をたたんで片足で高く立ち、遠く前を見る → かがんで翼をひらく → 斜め前へ身を乗り出し、脚で後ろへけり出して、重心をいったん下げながら飛び出す
//       → 翼で風をとらえ、前へ進みながら上がる（真上には跳ばない）。
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
  // 左向きは左右反転で描く（180度回すと上下も逆さになり、目が頭の下側へ行ってしまうため）
  const dir = Math.cos(a) < 0 ? -1 : 1;
  s += `<g transform="translate(${r1(head[0])} ${r1(head[1])}) rotate(${r1(billDown * dir)}) scale(${dir} 1)">`;
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
// 尾羽：後ろへ行くほど細くなる三角。白い毛の筆に墨を不均一につけたように、
// 毛の流れにそって濃さ・長さ・太さの違う墨の筋を入れる（先へ行くほど墨が多い）
function tail() {
  const outline = 'M20 -8 Q44 -5 61 2 Q62 3.4 60 4.4 Q44 9 20 10 Z';
  let s = `<defs><clipPath id="tail"><path d="${outline}"/></clipPath></defs><path d="${outline}" fill="${C.white}"/><g clip-path="url(#tail)">`;
  // [付け根側の y, 筋の始まり x, 太さ, 濃さ]：筋は先（61, 3）まで。始まりと濃さをばらつかせ、白い地を残す
  const hairs = [[-7, 46, 1.6, .7], [-5, 52, .9, .4], [-3.4, 42, 1.8, .8], [-1.6, 54, .8, .35], [.2, 48, 1.3, .6],
    [2, 51, 1, .45], [3.8, 44, 1.7, .75], [5.6, 55, .8, .35], [7.4, 47, 1.4, .6], [9, 52, 1, .4]];
  const tipX = 61, tipY = 3;
  for (const [y, x0, w, op] of hairs) {
    const yy = x => y + (tipY - y) * ((x - 20) / (tipX - 20)) ** 1.3;
    const xm = (x0 + tipX) / 2;
    s += `<path d="M${x0} ${r1(yy(x0))} Q${r1(xm)} ${r1(yy(xm) + (w > 1.5 ? .4 : -.3))} ${tipX} ${tipY}" stroke="${C.black}" stroke-width="${w}" stroke-linecap="round" fill="none" opacity="${op}"/>`;
  }
  // 先のほうに墨がたまる
  s += `<path d="M${tipX + 1} ${tipY} Q56 0 54 1 Q55 3 54 5.6 Q57 5 ${tipX + 1} ${tipY + .6} Z" fill="${C.black}" opacity=".85"/>`;
  s += `</g>`;
  return s;
}
// 胴体：中心 c、傾き tilt（度）。尾の先から黒い風切羽が少し見える。
// 尾は先を下へ向ける（胴体が前に傾いても、画面の上で下向きになるよう角度を足す）
const body = (c, tilt) =>
  `<g transform="translate(${c[0]} ${c[1]}) rotate(${tilt})">` +
  `<g transform="rotate(${r1(20 - tilt * .5)} 24 1)">${tail()}</g>` +
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

// たたんだ翼：背中にそって白い雨覆と、尾の上へのびる黒い風切羽（胴体の上に重ねる）
const foldedWing = (c, tilt) =>
  `<g transform="translate(${c[0]} ${c[1]}) rotate(${tilt})">` +
  `<path d="M-4 -11 Q22 -14 50 1 Q46 5 40 5 Q22 4 6 3 Q-4 -2 -4 -11 Z" fill="${C.black}"/>` +
  `<path d="M12 -8 L46 0 M14 -3 L44 3" stroke="${C.black2}" stroke-width="1.2" opacity=".9"/>` +
  `<path d="M-20 -7 Q-4 -17 20 -11 Q14 -1 0 3 Q-14 3 -20 -7 Z" fill="${C.white}"/>` +
  `<path d="M-14 -3 Q2 -8 16 -8 M-8 1 Q4 -2 12 -4" stroke="${C.shade}" stroke-width="1.4" fill="none"/>` +
  `</g>`;
// 1枚目：飛ぶ前の構え。あごを少し引き、翼を体に引き寄せ、重心を高くして片足で立つ。
// もう一方の足は軽く上げ、遠く前方を見る
function frame0() {
  const c = [114, 98], tilt = -4;
  let s = ripple(118, 171, 30, .55) + ripple(118, 171, 16, .8);
  // 力を込めて立つ足（奥）：まっすぐのばして体を支える
  const stand = [bodyPt(c, tilt, 4, 11), [124, 140], [118, 168]];
  s += leg(stand[0], stand[1], stand[2], 184, true) + thigh(stand[0], stand[1], true);
  // 軽く上げた足（手前）：かかとの関節を後ろへ曲げ、足先を前へ引き上げて指を軽く垂らす
  const lift = [bodyPt(c, tilt, -6, 12), [128, 128], [104, 138]];
  // 首はまっすぐ立て、あごを少し引いて、くちばしをやや下へ。目は前を見る
  s += neckFromBody(c, tilt, [92, 92], -98, 46, {billDown: 16, bend: 3});
  s += body(c, tilt);
  s += leg(lift[0], lift[1], lift[2], 118) + thigh(lift[0], lift[1]);
  s += foldedWing(c, tilt);
  return s;
}
// 翼を肩から上方向へ1.4倍に伸ばす（2枚目：ひらきかけの翼を大きく見せる）
const up14 = (shoulder, svg) => `<g transform="translate(${shoulder[0]} ${shoulder[1]}) scale(1 1.4) translate(${-shoulder[0]} ${-shoulder[1]})">${svg}</g>`;
// 2枚目：身をかがめ、翼を半分ひらいて飛び立つ構え
function frame1() {
  const c = [120, 112], tilt = -12;
  const legs = [[[124, 120], [138, 144], [122, 168], true], [[112, 120], [124, 146], [104, 168], false]];
  // 波紋の中心は両足のあいだ（足もと）
  let s = ripple(113, 171, 44, .7) + ripple(113, 171, 26, .9);
  for (const [h, k, f, far] of legs) s += leg(h, k, f, 184, far) + (far ? thigh(h, k, true) : '');
  const sf = bodyPt(c, tilt, -4, -11), sn = bodyPt(c, tilt, -10, -8);
  s += up14(sf, wing(sf, -140, 74, {spread: .8, far: true}) + upperArm(sf, -140, 74, true));
  s += neckFromBody(c, tilt, [94, 104], 200, 30, {billDown: 28, bend: -4});
  s += body(c, tilt);
  for (const [h, k, , far] of legs) if (!far) s += thigh(h, k);
  s += up14(sn, wing(sn, -124, 80, {spread: .9}) + upperArm(sn, -124, 80));
  return s;
}
// 3枚目：斜め前へ身を乗り出し、脚で水を後ろへけり出す。胴体は前に傾き、重心は1枚目より低い
function frame2() {
  const c = [94, 120], tilt = -20;
  const legs = [[bodyPt(c, tilt, 12, 7), [128, 142], [152, 160], true], [bodyPt(c, tilt, 6, 10), [122, 148], [146, 168], false]];
  // 鳥が前へ出たぶん、波紋の中心はけり出した足先（x=152）より後ろ（右）へずれる
  let s = ripple(176, 171, 50, .55) + ripple(176, 171, 30, .75);
  s += splash(150, 170, 22) + drops([[160, 150, 2.4], [170, 158, 2], [140, 148, 2], [176, 166, 1.8], [154, 140, 1.6]]);
  for (const [h, k, f, far] of legs) s += leg(h, k, f, 34, far) + (far ? thigh(h, k, true) : '');
  const sf = bodyPt(c, tilt, -4, -11), sn = bodyPt(c, tilt, -10, -8);
  s += wing(sf, -118, 86, {spread: .85, far: true}) + upperArm(sf, -118, 86, true);
  s += neckFromBody(c, tilt, [70, 114], 186, 34, {billDown: 4});
  s += body(c, tilt);
  for (const [h, k, , far] of legs) if (!far) s += thigh(h, k);
  s += wing(sn, -102, 94, {spread: 1}) + upperArm(sn, -102, 94);
  return s;
}
// 4枚目：翼を打ちおろして風をとらえ、前へ進みながら上がる。首をのばし、脚は後ろへのばす。波紋は後ろに残る
function frame3() {
  const c = [62, 84], tilt = -6;
  const legs = [[bodyPt(c, tilt, 16, 5), [106, 92], [132, 100], true], [bodyPt(c, tilt, 12, 9), [104, 100], [130, 108], false]];
  // 波紋はさらに後ろ（右）へ遠ざかり、画像の右へ見切れる
  let s = ripple(272, 171, 70, .4) + ripple(272, 171, 44, .55);
  s += drops([[132, 124, 2], [140, 140, 2.2], [146, 156, 1.8], [124, 146, 1.6]]);
  for (const [h, k, f, far] of legs) s += leg(h, k, f, 12, far) + (far ? thigh(h, k, true) : '');
  // 翼は肩から下へ打ちおろす。前へのばした首と頭にかからないよう、肩を首の付け根より後ろに置く
  const sf = bodyPt(c, tilt, 0, -10), sn = bodyPt(c, tilt, -2, -6);
  s += wing(sf, 150, 82, {spread: .85, far: true}) + upperArm(sf, 150, 82, true);
  // 首は水平にのばし、頭を重心（胴体の中心 y=84）と同じ高さに置く
  s += neckFromBody(c, tilt, [36, 84], 180, 32);
  s += body(c, tilt);
  for (const [h, k, , far] of legs) if (!far) s += thigh(h, k);
  s += wing(sn, 124, 96, {spread: 1}) + upperArm(sn, 124, 96);
  return s;
}

// ---------- 5・6枚目：翼を大きく広げて風に乗り、画面の奥へゆっくり旋回していく ----------
// 翼を広げた姿を立体（X：前後、前が -X ／ Y：翼の広がる向き ／ Z：上）で組み、
// 傾き（bank：進む向きを軸に回す）、向き（yaw：上から見て回す。奥へ向かう）、見上げる角度で回して平面に写す。
function soar({at, k, yaw, bank, look = -14}) {
  const rad = d => d * Math.PI / 180;
  const [cy, sy, cb, sb, cl, sl] = [Math.cos(rad(yaw)), Math.sin(rad(yaw)), Math.cos(rad(bank)), Math.sin(rad(bank)), Math.cos(rad(look)), Math.sin(rad(look))];
  // 立体の点 → [画面x, 画面y, 手前への深さ]
  const pr = ([X, Y, Z]) => {
    let y1 = Y * cb - Z * sb, z1 = Y * sb + Z * cb;               // 傾き
    let x2 = X * cy - y1 * sy, y2 = X * sy + y1 * cy;              // 向き（Y が手前）
    let d = y2 * cl - z1 * sl, z3 = y2 * sl + z1 * cl;             // 見上げる
    return [at[0] + x2 * k, at[1] - z3 * k, d];
  };
  const P = q => { const v = pr(q); return `${r1(v[0])} ${r1(v[1])}`; };
  const poly = (pts, fill, op) => `<path d="M${pts.map(P).join(' L')} Z" fill="${fill}"${op ? ` opacity="${op}"` : ''}/>`;
  const hull = pts => {
    const q = pts.map(pr).map(v => [v[0], v[1]]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lo = [], up = [];
    for (const v of q) { while (lo.length > 1 && cr(lo[lo.length - 2], lo[lo.length - 1], v) <= 0) lo.pop(); lo.push(v); }
    for (const v of q.slice().reverse()) { while (up.length > 1 && cr(up[up.length - 2], up[up.length - 1], v) <= 0) up.pop(); up.push(v); }
    return lo.slice(0, -1).concat(up.slice(0, -1));
  };
  const blob = (pts, fill) => `<path d="M${hull(pts).map(v => `${r1(v[0])} ${r1(v[1])}`).join(' L')} Z" fill="${fill}"/>`;
  const ell = (cx, rx, rr, z0 = 0) => { const o = []; for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; o.push([cx, Math.cos(a) * rr, z0 + Math.sin(a) * rr]); } return o; };
  // 翼（side=+1 が手前側の翼）：白い雨覆、黒い風切羽、先は指のように分かれる初列風切
  const wingSide = side => {
    const Y = y => side * y;
    let w = poly([[-10, Y(6), 2], [-14, Y(40), 6], [-9, Y(78), 9], [-4, Y(86), 9], [16, Y(82), 7], [19, Y(40), 4], [13, Y(6), 2]], C.black);
    for (let i = 0; i < 6; i++) {
      const bx = -6 + i * 4, tx = -12 + i * 6.5, span = 112 - i * 4.5;
      w += poly([[bx - 2, Y(80), 9], [tx - 1.4, Y(span - 2), 10 + i * .4], [tx + .6, Y(span), 10 + i * .4], [bx + 3, Y(80), 9]], C.black);
    }
    w += poly([[-10, Y(6), 2.2], [-14, Y(40), 6.2], [-9, Y(76), 9.2], [1, Y(74), 8.2], [3, Y(40), 4.2], [1, Y(6), 2.2]], side > 0 ? C.white : C.shade);
    return {svg: w, depth: pr([0, Y(50), 6])[2]};
  };
  const wings = [wingSide(1), wingSide(-1)].sort((a, b) => a.depth - b.depth);
  let s = wings[0].svg;
  // 脚：後ろへのばす
  for (const y of [-3, 3]) s += `<path d="M${P([20, y, -4])} L${P([62, y, -5])}" stroke="${C.red}" stroke-width="${r1(3 * k)}" stroke-linecap="round"/>` + `<path d="M${P([62, y, -5])} L${P([70, y - 2, -6])} M${P([62, y, -5])} L${P([71, y + 1, -5])}" stroke="${C.red}" stroke-width="${r1(1.6 * k)}" stroke-linecap="round"/>`;
  // 尾羽：三角で、先へ向かって墨の筋
  s += poly([[22, -8, 0], [48, 0, 0], [22, 8, 0]], C.white);
  s += poly([[36, -4, 0], [49, 0, 0], [36, 4, 0]], C.black, .8) + poly([[30, -6, 0], [49, 0, 0], [34, -2, 0]], C.black, .5) + poly([[30, 6, 0], [49, 0, 0], [34, 2, 0]], C.black, .45);
  // 胴体と首・頭・くちばし（首はまっすぐ前へ）
  const bodyPts = [...ell(-24, 0, 5), ...ell(-12, 0, 9), ...ell(0, 0, 10), ...ell(14, 0, 9), ...ell(26, 0, 5)];
  s += blob(bodyPts, C.white);
  s += blob([...ell(-50, 0, 4.4, 3), ...ell(-24, 0, 6, 1)], C.white);
  s += blob(ell(-54, 0, 7, 4), C.white);
  s += poly([[-57, -1.6, 5.6], [-92, 0, 2], [-57, 1.6, 2.4]], C.bill);
  const eyeSide = pr([-56, 4, 6])[2] > pr([-56, -4, 6])[2] ? 4 : -4;
  const ev = pr([-56, eyeSide * .9, 6.4]);
  s += `<ellipse cx="${r1(ev[0])}" cy="${r1(ev[1])}" rx="${r1(2.6 * k)}" ry="${r1(2.2 * k)}" fill="${C.red}"/><circle cx="${r1(ev[0])}" cy="${r1(ev[1])}" r="${r1(1 * k)}" fill="#1a1a1a"/>`;
  s += wings[1].svg;
  return s;
}
// 5枚目：羽ばたきのあと、風をとらえた翼を大きく広げ、少し傾いて奥へ向きを変えはじめる
const frame4 = () => soar({at: [14, 40], k: .82, yaw: 48, bank: -16, look: -26});
// 6枚目：さらに傾いて画面の奥へ旋回し、小さく遠ざかる
const frame5 = () => soar({at: [-14, 8], k: .5, yaw: 76, bank: -26, look: -22});

const out = process.argv[2];
const svg = (name, b) => `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="240" viewBox="-80 -40 320 240"><title>${name}</title>${b}</svg>\n`;
const files = {'stork-1': frame0(), 'stork-2': frame1(), 'stork-3': frame2(), 'stork-4': frame3(), 'stork-5': frame4(), 'stork-6': frame5()};
for (const [n, b] of Object.entries(files)) fs.writeFileSync(path.join(out, `${n}.svg`), svg(n, b));
console.log(Object.keys(files).length + ' files');
