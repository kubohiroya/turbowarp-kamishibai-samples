// 背景「丘の上の国分寺の建設」（480x360、版4の絵柄：輪郭線なしの平面イラスト）。
// 考証メモ 1.5：天平13年（741）の国分寺建立の詔の後、国府台の近くに下総国分寺が建てられた。
// 遠景：丘の上で、礎石の基壇に丹塗りの柱を立てた大きな金堂の屋根をつくる労務者たち（足場、瓦を運ぶ・ふく、綱で材を引き上げる）。
// 手前：片ひざを立てて座り、ノミと木槌で木の仏像を彫る仏師。彫りかけの仏像（上半身は彫り出し、下は荒彫りの木のまま）と木くず。
const fs = require('fs');
const path = require('path');
const {face, placeHead, limb, hand, foot, ik, lerp, add, ang, P, r1, MALE} = require('./chars.cjs');

let defs = [], gid = 0;
const grad = (stops, x2 = 0, y2 = 1) => {
  const id = `g${++gid}`;
  defs.push(`<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}">${stops.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join('')}</linearGradient>`);
  return `url(#${id})`;
};
const rnd0 = seed => { let r = seed; return () => ((r = (r * 9301 + 49297) % 233280) / 233280); };
// 遠景は空気の色へ寄せて淡くする
const haze = (svg, t, to = [0xdc, 0xe9, 0xee]) => svg.replace(/#([0-9a-f]{6})/gi, (_, h) =>
  '#' + [0, 2, 4].map(i => { const v = parseInt(h.slice(i, i + 2), 16); return Math.round(v + (to[i / 2] - v) * t).toString(16).padStart(2, '0'); }).join(''));

// ---- 遠景の小さな労務者（10〜16px）。pose: carry（肩に荷）/ pull（綱を引く）/ lift（両手で上へ渡す）/ hammer（たたく）/ walk
function worker(x, y, s, pose, {flip = 1, cloth = '#c9b184', skin = '#d9a074', load = null} = {}) {
  let g = `<g transform="translate(${x} ${y}) scale(${s * flip} ${s})">`;
  const arm = (a, b, c) => `<path d="M${a} L${b} L${c}" stroke="${skin}" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
  const legs = pose === 'pull' ? 'M0 -12 L-5 0 M0 -12 L5 -1' : pose === 'walk' ? 'M0 -12 L-4 0 M0 -12 L4 0' : 'M0 -12 L-2 0 M0 -12 L3 0';
  g += `<path d="${legs}" stroke="${skin}" stroke-width="2.4" stroke-linecap="round"/>`;
  const lean = pose === 'pull' ? 5 : 0;
  g += `<path d="M-3.4 -12 L${3.4 - lean} -12 L${2.6 - lean} ${-22} L${-2.6 - lean} -22 Z" fill="${cloth}"/>`;
  g += `<circle cx="${-lean}" cy="-25.5" r="3.2" fill="${skin}"/><path d="M${-3 - lean} -27 q3 -4 6 0" fill="#2b2118"/>`;
  if (pose === 'carry') g += arm(`${-2} -21`, '-4 -16', '-1 -14') + arm('2 -21', '4 -25', '2 -28');
  if (pose === 'pull') g += arm(`${-2 - lean} -21`, '-12 -19', '-16 -18') + arm(`${2 - lean} -21`, '-10 -17', '-15 -16');
  if (pose === 'lift') g += arm('-2 -21', '-4 -27', '-3 -32') + arm('2 -21', '4 -27', '3 -32');
  if (pose === 'hammer') g += arm('2 -21', '6 -26', '9 -30') + `<path d="M9 -30 l3 -4" stroke="#6a4a28" stroke-width="1.6"/><rect x="10" y="-37" width="5" height="3" fill="#6a4a28"/>` + arm('-2 -21', '2 -17', '6 -16');
  if (pose === 'walk') g += arm('-2 -21', '-3 -15', '-1 -12') + arm('2 -21', '4 -15', '3 -12');
  if (load === 'tiles') g += `<rect x="-2" y="${pose === 'lift' ? -38 : -33}" width="9" height="5" rx="1" fill="#7d8486"/><path d="M-1 ${pose === 'lift' ? -36 : -31} h7" stroke="#5f666a" stroke-width=".8"/>`;
  if (load === 'log') g += `<rect x="-16" y="-31" width="32" height="4" rx="2" fill="#a0703c"/>`;
  return g + `</g>`;
}

// ---- 遠景：丘の上の金堂（建設中）
function temple() {
  let s = '';
  const L = 196, R = 440, base = 176;
  // 基壇（礎石の上に建つ）と石段
  s += `<path d="M${L - 8} ${base} H${R + 8} V${base + 10} H${L - 8} Z" fill="#c9bfa8"/><path d="M${L - 8} ${base} H${R + 8}" stroke="#e6ddc8" stroke-width="2"/>`;
  s += `<path d="M330 ${base + 10} h24 l4 6 h-32 z" fill="#b9ae96"/>`;
  // 丹塗りの柱と、柱をつなぐ貫・頭貫
  for (let x = L + 10; x <= R - 10; x += 28) s += `<rect x="${x - 3.5}" y="${base - 42}" width="7" height="42" fill="#b8553a"/><rect x="${x - 3.5}" y="${base - 42}" width="2.4" height="42" fill="#d07858" opacity=".7"/><rect x="${x - 6}" y="${base - 3}" width="12" height="4" fill="#a59b84"/>`;
  s += `<rect x="${L + 2}" y="${base - 46}" width="${R - L - 4}" height="6" fill="#9a4630"/><rect x="${L + 2}" y="${base - 26}" width="${R - L - 4}" height="3" fill="#9a4630" opacity=".8"/>`;
  // 組物（ます組）の白い小壁
  s += `<rect x="${L + 2}" y="${base - 54}" width="${R - L - 4}" height="8" fill="#ece4cf"/>`;
  for (let x = L + 10; x <= R - 10; x += 28) s += `<path d="M${x - 7} ${base - 54} h14 v-4 h-14 z M${x - 4} ${base - 58} h8 v-3 h-8 z" fill="#8a3e2a"/>`;
  // 屋根：大きな寄棟の骨組み。左半分は瓦をふき終え、右半分は垂木がむき出しで瓦をふいている途中
  const eaveY = base - 62, ridgeY = base - 112, rl = L + 52, rr = R - 52;
  s += `<path d="M${L - 26} ${eaveY} Q${(L + R) / 2} ${eaveY + 6} ${R + 26} ${eaveY} L${rr} ${ridgeY} L${rl} ${ridgeY} Z" fill="#8a6a44"/>`;
  // 垂木（右側）
  for (let i = 0; i <= 18; i++) { const t = i / 18, bx = lerp([(L + R) / 2, eaveY + 4], [R + 26, eaveY], t), tx = lerp([(L + R) / 2, ridgeY], [rr, ridgeY], t);
    s += `<path d="M${r1(bx[0])} ${r1(bx[1])} L${r1(tx[0] + (bx[0] - tx[0]) * .02)} ${r1(tx[1])}" stroke="#6a4c2c" stroke-width="1.6"/>`; }
  // 野地板を張った部分と、瓦をふいた部分（左側）
  s += `<path d="M${L - 26} ${eaveY} Q${(L + R) / 2 - 60} ${eaveY + 5} ${(L + R) / 2 + 20} ${eaveY + 4} L${(L + R) / 2 + 6} ${ridgeY} L${rl} ${ridgeY} Z" fill="#5f6569"/>`;
  for (let i = 1; i < 10; i++) { const y = ridgeY + (eaveY - ridgeY) * i / 10; s += `<path d="M${r1(rl - (rl - L + 26) * i / 10)} ${r1(y)} H${r1((L + R) / 2 + 6 + 14 * i / 10)}" stroke="#7d8488" stroke-width="1.4"/>`; }
  for (let x = L - 14; x < (L + R) / 2 + 16; x += 7) s += `<path d="M${x} ${eaveY + 1} L${r1(x + (rl - x) * .9 + 4)} ${ridgeY + 2}" stroke="#4d5357" stroke-width=".8" opacity=".7"/>`;
  s += `<path d="M${(L + R) / 2 + 20} ${eaveY + 4} L${(L + R) / 2 + 6} ${ridgeY} L${(L + R) / 2 + 40} ${ridgeY} L${(L + R) / 2 + 60} ${eaveY + 3} Z" fill="#c9a46a"/>`;
  s += `<rect x="${rl - 4}" y="${ridgeY - 5}" width="${rr - rl + 8}" height="6" fill="#6a4c2c"/><path d="M${rl - 6} ${ridgeY - 5} q-4 -8 2 -10 M${rr + 6} ${ridgeY - 5} q4 -8 -2 -10" stroke="#6a4c2c" stroke-width="3" fill="none"/>`;
  // 足場：丸太を縄で縛って組む
  const poles = [R - 4, R + 22, R - 40, L - 18];
  for (const x of poles) s += `<path d="M${x} ${base + 6} L${x} ${ridgeY - 12}" stroke="#9a7444" stroke-width="2.4"/>`;
  for (const y of [base - 20, eaveY + 2, ridgeY + 20, ridgeY - 4]) s += `<path d="M${R - 46} ${y} H${R + 26}" stroke="#9a7444" stroke-width="2"/>`;
  s += `<path d="M${L - 22} ${base - 20} H${L + 6} M${L - 22} ${eaveY + 2} H${L - 2}" stroke="#9a7444" stroke-width="2"/>`;
  for (const [x, y] of [[R - 40, base - 20], [R - 4, eaveY + 2], [R + 22, ridgeY + 20], [R - 4, ridgeY - 4]]) s += `<circle cx="${x}" cy="${y}" r="2" fill="#d8c49a"/>`;
  s += `<path d="M${R - 40} ${base - 20} L${R + 22} ${eaveY + 2} M${R - 4} ${eaveY + 2} L${R + 22} ${ridgeY - 4}" stroke="#9a7444" stroke-width="1.4"/>`;
  // 綱で垂木を引き上げる：棟の上の滑車がわりの横木から、地面の男たちへ
  s += `<path d="M${(L + R) / 2 + 70} ${ridgeY - 8} L${(L + R) / 2 + 70} ${base - 30} M${(L + R) / 2 + 70} ${ridgeY - 8} L${(L + R) / 2 + 120} ${base + 2}" stroke="#d8c49a" stroke-width="1.2"/>`;
  s += `<rect x="${(L + R) / 2 + 56}" y="${base - 34}" width="28" height="4" fill="#a0703c" transform="rotate(-12 ${(L + R) / 2 + 70} ${base - 32})"/>`;
  // 労務者たち
  s += worker((L + R) / 2 + 34, ridgeY + 12, .7, 'lift', {load: 'tiles'}) + worker((L + R) / 2 + 58, eaveY - 4, .7, 'hammer');
  s += worker((L + R) / 2 + 86, eaveY - 16, .65, 'carry', {load: 'tiles'}) + worker(R + 6, eaveY + 2, .7, 'lift', {load: 'tiles', flip: -1});
  s += worker(R - 22, base - 20, .7, 'carry', {load: 'tiles'}) + worker(L - 10, eaveY + 2, .65, 'hammer', {flip: -1});
  s += worker((L + R) / 2 + 128, base + 6, .78, 'pull', {flip: -1}) + worker((L + R) / 2 + 142, base + 8, .78, 'pull', {flip: -1});
  return s;
}

// ---- 手前：仏師（片ひざを立てて座り、ノミと木槌で仏像を彫る）
function sculptor() {
  const c = {skin: '#dfa77a', skinDark: '#c4875a', cloth: '#d6c9a8', clothDark: '#b3a37c', hakama: '#8f8466', hakamaDark: '#776c52', cord: '#6e5638', hair: '#231a14'};
  const b = MALE, f = 1;
  // 骨格（右向き）。腰を落として左ひざを地面につき、右ひざを立てる
  // 上体を仏像のほうへ乗り出し、顔を仏像に近づける
  const pelvis = [124, 262], chest = [152, 184];
  const sl = [chest[0] - 22, chest[1] + 2], sr = [chest[0] + 26, chest[1] - 2];
  const hl = [pelvis[0] - 6, pelvis[1]], hr = [pelvis[0] + 10, pelvis[1] - 2];
  const legFar = ik(hl, [88, 332], b.th, b.sh, -1);   // 地面についたひざ
  const legNear = ik(hr, [178, 332], b.th, b.sh, -1);  // 立てたひざ：ひざを上に、すねは下の足先へ
  // 右を向いているので、手前に見えるのは左腕（ノミを仏像に当てる）、奥は右腕（木槌を頭の後ろへ振り上げる）
  const armFar = ik(sl, [112, 86], b.ua, b.fa, -1);   // 木槌を振り上げる
  const armNear = ik(sr, [206, 184], b.ua, b.fa, 1);  // ノミを仏像に当てる
  let s = '';
  // 敷いたむしろ
  s += `<path d="M30 334 L230 334 L240 346 L22 346 Z" fill="#c9b07a"/>`;
  for (let x = 34; x < 236; x += 8) s += `<path d="M${x} 335 L${x - 2} 345" stroke="#a88f58" stroke-width="1"/>`;
  // 奥の腕（木槌）：頭の後ろへ振り上げる。体と頭の後ろに描く
  s += limb(sl, armFar.mid, 15, 13, c.clothDark) + limb(armFar.mid, armFar.end, 13, 10, c.clothDark);
  const ma = ang(armFar.mid, armFar.end);
  s += `<g transform="translate(${P(armFar.end)}) rotate(${r1(ma + 70)})"><rect x="-2" y="-2" width="30" height="4.4" rx="2" fill="#9a6a3a"/><rect x="24" y="-9" width="14" height="18" rx="3" fill="#7a4c26"/><rect x="24" y="-9" width="4" height="18" fill="#a0703c"/></g>`;
  s += hand(armFar.end, ma, c.skinDark, {kind: 'grip', size: 1});
  s += `<path d="M80 60 q-14 8 -16 26 M70 50 q-16 10 -18 30" stroke="#ffffff" stroke-width="2" fill="none" stroke-linecap="round" opacity=".8"/>`;
  // 脚：奥（地面についたひざ）、手前（立てたひざ）。はかまに足結
  s += limb(legFar.mid, legFar.end, 16, 12, c.hakamaDark) + foot(legFar.end, -1, c.skinDark, {lift: 8});
  s += limb(hl, legFar.mid, 28, 22, c.hakamaDark);
  s += `<path d="M${P(add(hl, [-14, -6]))} L${P(add(hr, [14, -6]))} L${P(add(hr, [10, 18]))} L${P(add(hl, [-10, 18]))} Z" fill="${c.hakama}"/>`;
  s += limb(hr, legNear.mid, 28, 22, c.hakama) + limb(legNear.mid, lerp(legNear.mid, legNear.end, .3), 22, 18, c.hakama);
  s += `<path d="M${P(add(lerp(legNear.mid, legNear.end, .28), [-9, 0]))} L${P(add(lerp(legNear.mid, legNear.end, .28), [9, 0]))}" stroke="${c.cord}" stroke-width="3.4" stroke-linecap="round"/>`;
  s += limb(lerp(legNear.mid, legNear.end, .3), legNear.end, 12, 10, c.skin) + foot(legNear.end, 1, c.skin, {size: 1.05});
  // 胴（上衣）とひもの帯
  const neckBase = lerp(sl, sr, .5);
  s += `<path d="M${P(add(sl, [-6, -6]))} Q${P(add(neckBase, [0, -9]))} ${P(add(sr, [6, -7]))} L${P(add(hr, [14, 4]))} L${P(add(hl, [-16, 6]))} Z" fill="${c.cloth}"/>`;
  s += `<path d="M${P(add(neckBase, [-6, 0]))} L${P(add(sr, [6, -7]))} L${P(add(hr, [14, 4]))} L${P(lerp(hl, hr, .4))} Z" fill="${c.clothDark}" opacity=".35"/>`;
  s += `<path d="M${P(add(neckBase, [8, 0]))} L${P(lerp(neckBase, pelvis, .75))}" stroke="${c.clothDark}" stroke-width="4" stroke-linecap="round"/>`;
  const waist = lerp(neckBase, pelvis, .74);
  s += `<path d="M${P(add(waist, [-26, 2]))} Q${P(add(waist, [0, 6]))} ${P(add(waist, [26, -2]))}" stroke="${c.cord}" stroke-width="5" fill="none"/>`;
  // 首と頭：仏像の顔を見つめる
  const neckTop = add(neckBase, [12, -16]);
  s += `<path d="M${P(add(neckBase, [-8, 4]))} L${P(add(neckTop, [-8, 0]))} L${P(add(neckTop, [8, 0]))} L${P(add(neckBase, [10, 4]))} Z" fill="${c.skin}"/>`;
  const hair = `<path d="M-20 -2 Q-22 -26 -2 -29 Q18 -30 21 -12 Q12 -22 2 -21 L3 -16 L-4 -20 Q-10 -16 -12 -6 L-14 4 Q-20 6 -20 -2 Z" fill="${c.hair}"/>` +
    `<ellipse cx="-2" cy="-33" rx="9" ry="8" fill="${c.hair}"/><rect x="-10" y="-30" width="16" height="4.4" rx="2" fill="#d8c49a"/>`;
  s += placeHead(add(neckTop, [8, -22]), f, 16, face({kind: 'male', type: 'kokufu', mood: 'focus', skin: c.skin, skinDark: c.skinDark, brow: c.hair, stubble: true}) + hair);
  // 手前の腕（ノミ）：刃先を仏像の胸に当てる
  s += limb(sr, armNear.mid, 17, 15, c.cloth) + limb(armNear.mid, armNear.end, 15, 12, c.cloth);
  s += `<g transform="translate(${P(armNear.end)}) rotate(-6)"><rect x="2" y="-3" width="16" height="6" rx="2" fill="#8a5a30"/><rect x="18" y="-1.6" width="16" height="3.2" fill="#7d8486"/><path d="M34 -1.6 l3 1.6 l-3 1.6 z" fill="#c4cacc"/></g>`;
  s += hand(armNear.end, ang(armNear.mid, armNear.end), c.skin, {kind: 'grip', size: 1.05});
  return `<g transform="translate(-8 14) scale(.92)">${s}</g>`;
}

// ---- 手前：彫りかけの仏像（立像）。上半身は彫り出し、下半身は荒彫りの角材のまま
function statue() {
  const w = '#cfa56c', wd = '#a97c48', wl = '#e2c290';
  const x = 236, top = 128, foot = 340;
  let s = '';
  // 台にしている丸太
  s += `<rect x="${x - 34}" y="${foot - 6}" width="80" height="14" rx="6" fill="#8a5a30"/><ellipse cx="${x - 34}" cy="${foot + 1}" rx="5" ry="7" fill="#b07a44"/>`;
  // 荒彫りの角材（下半身）とノミの跡
  s += `<path d="M${x - 24} ${foot - 6} L${x - 22} ${top + 104} L${x + 30} ${top + 100} L${x + 32} ${foot - 6} Z" fill="${w}"/>`;
  s += `<path d="M${x + 14} ${top + 102} L${x + 30} ${top + 100} L${x + 32} ${foot - 6} L${x + 16} ${foot - 6} Z" fill="${wd}" opacity=".6"/>`;
  for (const [a, b2] of [[top + 116, 10], [top + 140, 14], [top + 166, 8], [top + 188, 12]]) s += `<path d="M${x - 18} ${a} l${b2} 4 M${x - 4} ${a + 10} l${b2} -3 M${x + 6} ${a - 6} l8 5" stroke="${wd}" stroke-width="1.4"/>`;
  // 上半身：衣のひだ、組んだ手、肩
  s += `<path d="M${x - 24} ${top + 104} Q${x - 28} ${top + 60} ${x - 18} ${top + 40} Q${x + 4} ${top + 30} ${x + 24} ${top + 40} Q${x + 34} ${top + 62} ${x + 30} ${top + 100} Z" fill="${w}"/>`;
  s += `<path d="M${x + 10} ${top + 40} Q${x + 34} ${top + 62} ${x + 30} ${top + 100} L${x + 16} ${top + 102} Q${x + 20} ${top + 64} ${x + 10} ${top + 40} Z" fill="${wd}" opacity=".5"/>`;
  for (let i = 0; i < 4; i++) s += `<path d="M${x - 16 + i * 2} ${top + 56 + i * 12} Q${x + 2} ${top + 66 + i * 12} ${x + 22 - i} ${top + 54 + i * 12}" stroke="${wd}" stroke-width="1.6" fill="none"/>`;
  s += `<path d="M${x - 6} ${top + 64} q6 -6 12 0 q-2 8 -6 8 q-4 0 -6 -8 z" fill="${wl}"/>`;
  // 頭：肉髻（頭頂の盛り上がり）と螺髪、長い耳たぶ、伏し目、白毫
  s += `<rect x="${x - 4}" y="${top + 28}" width="10" height="10" fill="${w}"/>`;
  s += `<ellipse cx="${x + 1}" cy="${top + 18}" rx="13" ry="15" fill="${w}"/><path d="M${x + 8} ${top + 8} Q${x + 14} ${top + 18} ${x + 10} ${top + 30} Q${x + 14} ${top + 18} ${x + 8} ${top + 8} Z" fill="${wd}" opacity=".5"/>`;
  s += `<path d="M${x - 12} ${top + 12} Q${x + 1} ${top - 8} ${x + 14} ${top + 12} Q${x + 1} ${top + 4} ${x - 12} ${top + 12} Z" fill="${wd}"/><ellipse cx="${x + 1}" cy="${top - 2}" rx="7" ry="6" fill="${wd}"/>`;
  for (let i = 0; i < 5; i++) s += `<circle cx="${x - 6 + i * 3.4}" cy="${top + 6 + Math.abs(i - 2) * .8}" r="1.1" fill="#8a6234"/>`;
  s += `<path d="M${x - 12} ${top + 14} q-3 8 0 18 M${x + 14} ${top + 14} q3 8 0 18" stroke="${wd}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`;
  s += `<path d="M${x - 6} ${top + 19} q3 1.6 6 0 M${x + 3} ${top + 19} q3 1.6 6 0" stroke="#7a5228" stroke-width="1.4" fill="none" stroke-linecap="round"/>`;
  s += `<circle cx="${x + 1}" cy="${top + 13}" r="1.1" fill="#7a5228"/><path d="M${x - 2} ${top + 27} q3 1.4 6 0" stroke="#7a5228" stroke-width="1.2" fill="none"/>`;
  // 木くず
  const rnd = rnd0(77);
  for (let i = 0; i < 18; i++) { const cx = x - 60 + rnd() * 140, cy = foot + 2 + rnd() * 6; s += `<path d="M${r1(cx)} ${r1(cy)} q3 -3 6 0 q-3 1 -6 0 z" fill="${rnd() > .5 ? wl : w}"/>`; }
  for (const [cx, cy] of [[x - 20, top + 70], [x - 26, top + 84], [x - 16, top + 92]]) s += `<path d="M${cx} ${cy} q3 -3 6 0 q-3 1 -6 0 z" fill="${wl}"/>`;
  return s;
}

function kokubunji() {
  let s = `<rect width="480" height="360" fill="${grad([[0, '#b4dcf2'], [.6, '#d8eef8'], [1, '#f1f9fc']])}"/>`;
  s += `<path d="M60 48 q10 -10 24 -4 q12 -8 22 2 q10 0 8 8 h-56 q-6 -4 2 -6 z M300 30 q8 -8 18 -2 q10 -6 18 2 q8 0 6 6 h-46 q-4 -4 4 -6z" fill="#ffffff" opacity=".85"/>`;
  // 左手奥：大きな川の下流（国府台の西を流れる、いまの江戸川にあたる川）。向こう岸に低い丘と木が見える
  let far = `<path d="M0 178 Q30 170 64 174 Q100 168 150 174 Q220 166 300 172 Q380 166 480 174 V200 H0 Z" fill="#9fc493"/>`;
  far += `<path d="M0 186 Q40 180 80 184 Q110 182 150 186 Q300 180 480 186 V200 H0 Z" fill="#8db884"/>`;
  { const r = rnd0(31); for (let x = 4; x < 136; x += 7 + r() * 8) { const rr = 3 + r() * 3.4; far += `<circle cx="${r1(x)}" cy="${r1(190 - rr * .4 - r() * 4)}" r="${r1(rr)}" fill="${r() > .5 ? '#6f9f68' : '#7eaa72'}"/>`; } }
  far += `<path d="M0 198 Q40 195 80 197 Q110 196 140 198 V202 H0 Z" fill="#d8cfa6"/>`;
  far += `<rect x="0" y="202" width="90" height="52" fill="${grad([[0, '#a9cfe0'], [1, '#8cbcd4']])}"/>`;
  far += `<path d="M6 210 l26 3 M20 222 l30 4 M4 234 l28 4 M40 244 l24 3" stroke="#ffffff" stroke-width="1.4" stroke-linecap="round" opacity=".5"/>`;
  far += `<path d="M0 250 Q30 246 50 252 Q58 255 62 258 V264 H0 Z" fill="#e3d2a4"/>`;
  // 国府台の丘：上が平らな小高い丘。金堂のまわりに平地を広くとり、丘の左端（画面の左端近く）が切り立った崖になって、海側の低い浜へ落ちる
  far += `<path d="M66 184 Q120 180 260 182 H480 V262 H36 Q46 226 66 184 Z" fill="${grad([[0, '#8fbf72'], [1, '#76a660']])}"/>`;
  far += `<path d="M66 184 Q76 188 82 196 Q70 230 80 262 H36 Q46 226 66 184 Z" fill="#b58c5c"/>`;
  far += `<path d="M70 196 Q74 199 78 202 M58 210 Q68 213 76 220 M50 228 Q62 231 74 238 M42 246 Q56 249 76 254" stroke="#946c40" stroke-width="2" fill="none"/>`;
  far += `<path d="M66 184 Q74 186 82 194" stroke="#6f9f58" stroke-width="3" fill="none"/>`;
  far += `<path d="M82 196 Q70 230 80 262" stroke="#6f9f58" stroke-width="2" fill="none" opacity=".6"/>`;
  // 平地の上の道と、積んだ瓦
  far += `<path d="M96 196 Q140 192 180 190" stroke="#d9c597" stroke-width="5" fill="none" stroke-linecap="round"/>`;
  for (let i = 0; i < 3; i++) far += `<rect x="${460}" y="${184 - i * 4}" width="16" height="4" fill="#7d8486"/>`;
  far += temple();
  // 平地を丸太をかついで運ぶ労務者
  far += worker(110, 200, .78, 'carry', {load: 'log', flip: -1}) + worker(126, 202, .78, 'walk', {load: 'log', flip: -1});
  s += haze(far, .22);
  // 手前の地面（丘の中腹の作業場）
  s += `<path d="M0 262 Q160 252 300 258 Q400 262 480 256 V360 H0 Z" fill="${grad([[0, '#e2cf9c'], [1, '#cfb27c']])}"/>`;
  s += `<path d="M150 300 q40 -6 80 0 M40 340 q40 -6 80 0" stroke="#c4a670" stroke-width="2" fill="none" opacity=".6"/>`;
  // 手前の左：材木と道具
  s += `<rect x="14" y="300" width="110" height="10" rx="5" fill="#a0703c"/><rect x="20" y="290" width="96" height="10" rx="5" fill="#b07c46"/><ellipse cx="124" cy="305" rx="4" ry="5" fill="#c99260"/>`;
  s += `<g transform="translate(40 334) rotate(-14)"><rect x="0" y="-2" width="30" height="4" rx="2" fill="#9a6a3a"/><path d="M28 -6 l10 2 l-10 6 z" fill="#7d8486"/></g>`;
  // 仏師と仏像：画面の中央よりやや右へ
  s += `<g transform="translate(112 0)">${statue() + sculptor()}</g>`;
  return s;
}

const out = process.argv[2];
defs = []; gid = 0;
const body = kokubunji();
fs.writeFileSync(path.join(out, 'kokubunji.svg'), `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="360" viewBox="0 0 480 360"><title>kokubunji</title><defs>${defs.join('')}</defs>${body}</svg>\n`);
console.log('1 file');
