// 手児奈の立ち絵・求婚者のポーズ絵（版4：版2の絵柄で人体と芝居を見直した版）。
// 240x380, viewBox 0 -20 240 380, 回転中心 120,190。輪郭線なしの平面イラスト（版2と同じ絵柄）。
// 骨格（肩・肘・手首、股関節・膝・足首）を決め、腕と脚は長さを固定した2関節で計算する（関節は1か所でしか曲がらない）。
// 衣装は考証メモ resources/tekona-workshop/research-notes.md の 2.3・3.1 にもとづく。
const fs = require('fs');
const path = require('path');

const r1 = v => +v.toFixed(1);
const P = ([x, y]) => `${r1(x)} ${r1(y)}`;
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const len = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
const ang = (a, b) => Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI;

// 2関節の逆運動学：根元 a から先端 t へ、長さ l1・l2。bend=±1 で曲がる向き。届かないときは伸ばしきる
function ik(a, t, l1, l2, bend) {
  let d = len(a, t);
  const max = (l1 + l2) * 0.995;
  if (d > max) { t = lerp(a, t, max / d); d = max; }
  const k = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, l1 * l1 - k * k));
  const ux = (t[0] - a[0]) / d, uy = (t[1] - a[1]) / d;
  const base = [a[0] + ux * k, a[1] + uy * k];
  return {mid: [base[0] - uy * h * bend, base[1] + ux * h * bend], end: t};
}
const seg = (a, b, w, c) => `<path d="M${P(a)} L${P(b)}" stroke="${c}" stroke-width="${w}" stroke-linecap="round"/>`;
// 先に向かって細くなる筒（上腕・前腕・もも・すね）
function limb(a, b, wa, wb, c) {
  const d = len(a, b), nx = -(b[1] - a[1]) / d, ny = (b[0] - a[0]) / d;
  return `<path d="M${P([a[0] + nx * wa / 2, a[1] + ny * wa / 2])} L${P([b[0] + nx * wb / 2, b[1] + ny * wb / 2])} L${P([b[0] - nx * wb / 2, b[1] - ny * wb / 2])} L${P([a[0] - nx * wa / 2, a[1] - ny * wa / 2])} Z" fill="${c}"/>` +
    `<circle cx="${r1(a[0])}" cy="${r1(a[1])}" r="${r1(wa / 2)}" fill="${c}"/><circle cx="${r1(b[0])}" cy="${r1(b[1])}" r="${r1(wb / 2)}" fill="${c}"/>`;
}

// 手。dir は手首から指先への角度。kind: relaxed | open | fist | grip
function hand(w, dir, skin, {kind = 'relaxed', size = 1, side = 1} = {}) {
  const s = size;
  let g = `<g transform="translate(${P(w)}) rotate(${r1(dir)}) scale(${s} ${s * side})">`;
  if (kind === 'open') {
    g += `<path d="M-2 -6 L10 -7 Q18 -6 20 -3 L20 3 Q18 6 10 7 L-2 6 Z" fill="${skin}"/>`;
    g += `<path d="M2 -6 Q6 -13 11 -12 Q12 -9 8 -5 Z" fill="${skin}"/>`;
  } else if (kind === 'fist') {
    g += `<path d="M-2 -6 Q10 -9 13 -2 Q14 6 6 8 L-2 6 Z" fill="${skin}"/>`;
  } else if (kind === 'point') {
    // にぎりこぶしから人差し指を1本立てる（指先は手首から先の向き）。
    // 人差し指と、その付け根にかぶせた親指は手のひら側（+y）のふち、にぎった中指・薬指・小指の関節は反対（-y）のふちに見せる
    g += `<path d="M-2 -7 L9 -7 Q12 -4 12 1 Q12 6 8 7 L-2 7 Z" fill="${skin}"/>`;
    g += `<path d="M4 -7 q2 -3 4 0 M8 -6.6 q2 -3 4 .6" stroke="${skin}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`;
    g += `<path d="M8 4.6 L22 4.6" stroke="${skin}" stroke-width="4.4" stroke-linecap="round"/>`;
    g += `<path d="M1 4 Q6 1 10 1" stroke="${skin}" stroke-width="3.6" fill="none" stroke-linecap="round"/><path d="M2 2.2 Q6 -.4 9.6 -.6" stroke="#000000" stroke-width=".8" fill="none" opacity=".18"/>`;
    g += `<path d="M9 2.6 h3" stroke="#000000" stroke-width=".8" opacity=".18"/>`;
  } else if (kind === 'grip') {
    g += `<path d="M-2 -6 Q9 -8 12 -3 Q13 5 6 7 L-2 6 Z" fill="${skin}"/><path d="M4 -6 Q9 -10 12 -7" stroke="${skin}" stroke-width="4" stroke-linecap="round" fill="none"/>`;
  } else {
    g += `<path d="M-2 -6 L8 -6 Q16 -4 17 1 Q16 6 8 6 L-2 6 Z" fill="${skin}"/><path d="M3 -5 Q8 -10 11 -6" stroke="${skin}" stroke-width="4" stroke-linecap="round" fill="none"/>`;
  }
  return g + `</g>`;
}
// 足。f=-1 で画面の左向き。lift で、かかとを上げる（後ろ足）
function foot(a, f, skin, {lift = 0, shoe = null, size = 1} = {}) {
  const c = shoe || skin, s = size;
  const toe = [a[0] + f * 20 * s, a[1] + 10 - lift * 0.2], heel = [a[0] - f * 5 * s, a[1] + 9 - lift];
  return `<path d="M${P([a[0] - f * 5 * s, a[1] - 2])} Q${P([a[0] + f * 10 * s, a[1] - 1])} ${P([toe[0] - f * 2, toe[1] - 5])} Q${P([toe[0] + f * 2, toe[1] - 1])} ${P(toe)} L${P(heel)} Q${P([heel[0] - f * 2, heel[1] - 4])} ${P([a[0] - f * 5 * s, a[1] - 2])} Z" fill="${c}"/>`;
}

// ---------------- 顔（右向きの3/4で描き、左向きは左右反転） ----------------
// kind: male | female。mood: stand | eager | serious | proud | pained | smile | gentle | resolve
const MALE_FACES = {
  // 里の若者：丸みのある広い顔、丸い目、太くまっすぐな眉、だんご鼻、大きな口
  sato: {chin: 28, contour: 'M-20 -6 Q-21 12 -12 21 Q-4 28 5 28 Q13 27 17 20 Q21 12 21 0 Q22 -18 10 -25 Q0 -29 -10 -26 Q-20 -20 -20 -6 Z', ear: 5,
    eyeW: 5, eyeH: 2.6, iris: 2.6, lid: 1.6, browY: -11, browArch: 0, browW: 3.6, mouthW: 1.25, mouthY: 17,
    nose: '<path d="M5 -3 Q6 3 9 7 Q10 10 6 11 Q3 11 3 9" fill="none" stroke="SD" stroke-width="1.8" stroke-linecap="round"/><ellipse cx="6" cy="9" rx="4.6" ry="2.6" fill="SD" opacity=".45"/>'},
  // 国府の役人：面長で細いあご、切れ長の細い目、細く上がった眉、細く長い鼻、小さく薄い口
  kokufu: {chin: 33, contour: 'M-17 -8 Q-18 12 -10 24 Q-3 32 4 33 Q10 32 14 25 L17 14 Q19 4 19 -4 Q20 -20 10 -26 Q0 -30 -9 -27 Q-17 -22 -17 -8 Z', ear: 4,
    eyeW: 6.4, eyeH: 1.5, iris: 2, lid: 2, browY: -10, browArch: 1.5, browW: 2.2, mouthW: .8, mouthY: 20,
    nose: '<path d="M4 -6 Q5 4 8 11 Q6 12.5 3.6 12 Q5 11 5.4 10 Q4 2 4 -6 Z" fill="SD" opacity=".85"/><path d="M3 12.5 q2 1 4.6 -.2" stroke="SD" stroke-width="1.3" fill="none" stroke-linecap="round"/>'},
  // 都の貴族：ふくよかなほおと二重あご、重いまぶたと涙袋、弧を描く眉、鼻筋の通った大きな鼻、厚い唇
  miyako: {chin: 30, jowl: true, contour: 'M-19 -6 Q-21 12 -13 22 Q-6 29 4 30 Q12 30 17 24 Q22 16 21 6 Q22 -16 11 -24 Q1 -29 -10 -26 Q-19 -20 -19 -6 Z', ear: 5,
    eyeW: 5.6, eyeH: 2.2, iris: 2.4, lid: 1.8, heavyLid: true, bags: true, browY: -12, browArch: 2.6, browW: 2.6, mouthW: 1, mouthY: 18, lip: true,
    nose: '<path d="M4 -4 Q8 1 9 6 Q11 9 8 11 Q5 12 3 10" fill="none" stroke="SD" stroke-width="1.8" stroke-linecap="round"/><path d="M4 -4 Q7 1 8 7 Q5 6 4.4 2 Z" fill="SD" opacity=".5"/>'},
};
function face(o) {
  const {kind, mood, skin, skinDark, brow = '#2b2118', eye = '#2a1d16', beard = false, mustache = false, stubble = false} = o;
  let s = '';
  if (kind === 'male') {
    // 人物ごとの顔立ち：輪郭・目・眉・鼻・口を変える
    const F = MALE_FACES[o.type];
    const cy = F.chin;
    s += `<path d="${F.contour}" fill="${skin}"/>`;
    s += `<path d="M-12 ${cy - 9} Q-4 ${cy - 2} 4 ${cy} Q11 ${cy} 15 ${cy - 5} Q6 ${cy - 3} -2 ${cy - 7} Q-8 ${cy - 9} -12 ${cy - 14} Z" fill="${skinDark}" opacity=".5"/>`;
    if (F.jowl) s += `<path d="M-10 ${cy - 6} Q-2 ${cy + 1} 8 ${cy}" stroke="${skinDark}" stroke-width="1.4" fill="none" opacity=".8"/>`;
    s += `<ellipse cx="-14" cy="3" rx="${F.ear}" ry="7.5" fill="${skin}"/><path d="M-15 0 q-2 4 0 7" stroke="${skinDark}" stroke-width="1.6" fill="none"/>`;
    // 鼻：両目のあいだ（3/4なので奥の目に寄る）
    s += F.nose.replace(/SD/g, skinDark);
    if (stubble) s += `<path d="M-8 ${cy - 8} Q4 ${cy + 2} 16 ${cy - 6} L17 ${cy - 11} Q6 ${cy - 4} -6 ${cy - 12} Z" fill="#3a2a20" opacity=".16"/>`;
    // 目
    const eyeAt = (x, near) => {
      const w = F.eyeW * (near ? 1 : .78), h = F.eyeH * (mood === 'focus' ? .82 : 1);
      if (mood === 'pained') return `<path d="M${x - w} -1 q${w} 3 ${w * 2} 0" stroke="${eye}" stroke-width="2.4" fill="none" stroke-linecap="round"/><path d="M${x - w} -4 l${w * 2} 2" stroke="${eye}" stroke-width="1.2" opacity=".6"/>`;
      if (mood === 'proud') return `<path d="M${x - w} 0 q${w} -4 ${w * 2} 0" stroke="${eye}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`;
      // downcast：目を伏せる。まぶたを下ろして白目を細く残し、下に寄せた瞳を暗く沈ませる（手元を見つめてうつむく顔）
      if (o.downcast) {
        let d = `<path d="M${x - w} 0 Q${x} ${-h * 2} ${x + w} -1 Q${x} ${h * 1.1} ${x - w} 0 Z" fill="#e6ddd0"/>` +
          `<ellipse cx="${r1(x + (near ? .6 : .3))}" cy="${r1(h * .45)}" rx="${F.iris}" ry="${r1(F.iris * .9)}" fill="#0e0907"/>`;
        d += `<path d="M${x - w - 1} .6 Q${x} ${r1(-h * .2)} ${x + w + 1} -.4 L${x + w + 1} ${r1(-h * 2.4)} L${x - w - 1} ${r1(-h * 2.4)} Z" fill="${skin}"/>`;
        d += `<path d="M${x - w - .5} .6 Q${x} ${r1(-h * .2)} ${x + w + .5} -.4" stroke="${eye}" stroke-width="${r1(F.lid + .6)}" fill="none" stroke-linecap="round"/>`;
        d += `<path d="M${x - w * .8} ${r1(-h * 1.1)} Q${x} ${r1(-h * 1.7)} ${x + w * .8} ${r1(-h * 1.3)}" stroke="${skinDark}" stroke-width="1.2" fill="none" opacity=".8"/>`;
        return d;
      }
      let e = `<path d="M${x - w} 0 Q${x} ${-h * 2} ${x + w} -1 Q${x} ${h} ${x - w} 0 Z" fill="#fbf6ee"/>` +
        `<ellipse cx="${r1(x + (near ? 1.2 : .7))}" cy="${r1(-h * .25)}" rx="${F.iris}" ry="${r1(Math.min(F.iris * 1.1, h * 1.3))}" fill="${eye}"/>`;
      if (F.heavyLid) e += `<path d="M${x - w - .5} -.3 Q${x} ${-h * 1.9} ${x + w + .5} -1.4 L${x + w} ${-h * .6} Q${x} ${-h * 1.1} ${x - w} -.6 Z" fill="${skinDark}"/>`;
      e += `<path d="M${x - w - .5} -.4 Q${x} ${-h * 2.1} ${x + w + .5} -1.6" stroke="${eye}" stroke-width="${F.lid}" fill="none" stroke-linecap="round"/>`;
      if (F.bags) e += `<path d="M${x - w * .7} ${h + 1.6} q${w * .7} 1.6 ${w * 1.4} 0" stroke="${skinDark}" stroke-width="1.1" fill="none"/>`;
      return e;
    };
    s += eyeAt(-6, true) + eyeAt(13, false);
    // 眉
    const t = {stand: 0, eager: -2, serious: 0, proud: -3, pained: 0}[mood] || 0;
    const tilt = {serious: 3, focus: 1.5, pained: -4}[mood] || 0;
    const browN = `M-13 ${F.browY + t + (tilt < 0 ? 0 : 0)} Q-6 ${F.browY + t - F.browArch} 0 ${F.browY + t + tilt}`;
    const browF = `M8 ${F.browY + t + tilt} Q13 ${F.browY + t - F.browArch} 18 ${F.browY + t}`;
    s += [browN, browF].map(d => `<path d="${d}" stroke="${brow}" stroke-width="${F.browW}" fill="none" stroke-linecap="round"/>`).join('');
    if (mood === 'pained') s += `<path d="M2 ${F.browY - 4} q2 -2 4 0" stroke="${skinDark}" stroke-width="1.2" fill="none"/>`;
    // 口
    const mx = 6, hw = 5 * F.mouthW, my = F.mouthY;
    const mouth = {
      stand: `<path d="M${mx - hw} ${my} Q${mx} ${my + 1.4} ${mx + hw} ${my - 1}" stroke="#8a4a3a" stroke-width="2" fill="none" stroke-linecap="round"/>`,
      eager: `<path d="M${mx - hw - 1} ${my - 2} Q${mx} ${my - 2} ${mx + hw} ${my - 3} Q${mx + hw - 2} ${my + 5} ${mx - 1} ${my + 5} Q${mx - hw - 1} ${my + 4} ${mx - hw - 1} ${my - 2} Z" fill="#7a2e28"/><path d="M${mx - hw} ${my - 1.5} L${mx + hw - 1} ${my - 2.4} L${mx + hw - 1.4} ${my - .4} L${mx - hw + .4} ${my} Z" fill="#fff"/>`,
      serious: `<path d="M${mx - hw} ${my} L${mx + hw} ${my - 1}" stroke="#8a4a3a" stroke-width="2.2" stroke-linecap="round"/>`,
      // focus：一心に見つめる。目をわずかに細め、口を静かに結ぶ（怖くならないよう眉は寄せすぎない）
      focus: `<path d="M${mx - hw * .75} ${my} L${mx + hw * .75} ${my - .4}" stroke="#8a4a3a" stroke-width="2" stroke-linecap="round"/>`,
      proud: `<path d="M${mx - hw - 2} ${my - 3} Q${mx} ${my - 2} ${mx + hw + 1} ${my - 4} Q${mx + hw - 1} ${my + 6} ${mx - 1} ${my + 6} Q${mx - hw - 2} ${my + 4} ${mx - hw - 2} ${my - 3} Z" fill="#7a2e28"/><path d="M${mx - hw - 1} ${my - 2.6} L${mx + hw} ${my - 3.6} L${mx + hw - .6} ${my - 1} L${mx - hw - .6} ${my - .4} Z" fill="#fff"/>`,
      pained: `<path d="M${mx - hw} ${my + 2} Q${mx - hw / 2} ${my - 2} ${mx} ${my + 1} Q${mx + hw / 2} ${my - 2} ${mx + hw} ${my + 2} Q${mx} ${my + 4} ${mx - hw} ${my + 2} Z" fill="#7a2e28"/>`,
    }[mood];
    s += mouth || '';
    if (F.lip && (mood === 'stand' || mood === 'serious')) s += `<path d="M${mx - hw * .6} ${my + 2.6} Q${mx} ${my + 4} ${mx + hw * .6} ${my + 2}" stroke="${skinDark}" stroke-width="1.6" fill="none" stroke-linecap="round"/>`;
    if (mustache) s += `<path d="M${mx - 8} ${my - 4} Q${mx - 3} ${my - 8} ${mx} ${my - 6} Q${mx + 4} ${my - 8} ${mx + 8} ${my - 5} Q${mx + 4} ${my - 4} ${mx} ${my - 4} Q${mx - 4} ${my - 3} ${mx - 8} ${my - 4} Z" fill="${brow}"/>`;
    if (beard) s += `<path d="M${mx - 3} ${cy - 3} Q${mx + 1} ${cy + 7} ${mx + 5} ${cy - 2} Q${mx + 2} ${cy} ${mx} ${cy - .5} Z" fill="${brow}"/>`;
    if (o.lines) s += `<path d="M0 9 Q-3 13 -2 ${my + 1}" stroke="${skinDark}" stroke-width="1.2" fill="none" opacity=".8"/>`;
  } else {
    // 女性：やわらかい輪郭、満月のような丸い顔
    s += `<path d="M-17 -6 Q-17 12 -6 21 Q2 26 9 24 Q16 19 18 8 Q20 -2 19 -8 Q16 -24 0 -25 Q-17 -23 -17 -6 Z" fill="${skin}"/>`;
    // 目：3/4で右を向く顔では、画面の左が手前の目、輪郭に近い右が奥の目。奥の目は横に縮めて小さく描く
    const eyeAt = (x, near) => {
      const sx = near ? 1 : .74, sy = near ? 1 : .9;
      let e = `<g transform="translate(${x} 0) scale(${sx} ${sy})">`;
      if (mood === 'gentle' || mood === 'laugh') e += `<path d="M-5.4 1 q5.4 -5 10.8 0" stroke="${eye}" stroke-width="${r1(2.4 / sx)}" fill="none" stroke-linecap="round"/>`;
      else e += `<path d="M-5.4 0 Q0 -6 5.4 -1 Q0 4 -5.4 0 Z" fill="#fbf6ee"/><ellipse cx="1" cy="-.5" rx="3.2" ry="3.8" fill="${eye}"/><circle cx="0" cy="-2" r="1.2" fill="#fff"/>` +
        `<path d="M-6 .2 Q0 -6.2 5.8 -1.2" stroke="${eye}" stroke-width="${r1(1.7 / sx)}" fill="none" stroke-linecap="round"/>`;
      return e + `</g>`;
    };
    s += eyeAt(-3, true) + eyeAt(12.5, false);
    const b = mood === 'resolve' ? ['M-9 -12 L1 -11', 'M8.5 -11 L15.5 -12'] : mood === 'gentle' ? ['M-9 -10 Q-4 -13 1 -11', 'M8.5 -11 Q12 -12.5 15.5 -10'] : ['M-9 -11 Q-4 -13.5 1 -11', 'M8.5 -11 Q12 -12.5 15.5 -11'];
    s += b.map(d => `<path d="${d}" stroke="${brow}" stroke-width="1.6" fill="none" stroke-linecap="round"/>`).join('');
    // 口：両目のあいだの下、やや手前寄り
    s += {smile: `<path d="M1 14 Q5 17 9 13" stroke="#a0453a" stroke-width="1.8" fill="none" stroke-linecap="round"/>`,
      gentle: `<path d="M2 14 Q5 16 8 14" stroke="#a0453a" stroke-width="1.6" fill="none" stroke-linecap="round"/>`,
      resolve: `<path d="M2 14.5 L8 14" stroke="#a0453a" stroke-width="1.8" stroke-linecap="round"/>`,
      // laugh：目を細めて口をあけて笑う／talk：話している途中の小さくあいた口
      laugh: `<path d="M0 12.6 Q5 12 10 12 Q9 19 5 19 Q1 18.6 0 12.6 Z" fill="#8a3a32"/><path d="M.6 12.8 L9.6 12.2 L9.2 14 L1 14.4 Z" fill="#fff"/>`,
      talk: `<ellipse cx="5" cy="15" rx="3" ry="2.2" fill="#8a3a32"/>`}[mood];
    s += `<ellipse cx="-4" cy="9" rx="4.4" ry="2.5" fill="#f29c9c" opacity="${o.old ? '.25' : '.5'}"/><ellipse cx="14" cy="9" rx="3.2" ry="2.3" fill="#f29c9c" opacity="${o.old ? '.25' : '.5'}"/>`;
    // 年寄り：目じり・ほうれい線・額のしわ
    if (o.old) s += `<path d="M-11 -1 l-3 -2 M-11 1.4 l-3.2 .6 M16 -1 l2.4 -1.6 M1 9 Q-1 13 0 17 M12 9 Q14 13 12.6 17 M-8 -17 Q0 -19 8 -17 M-6 -14 Q1 -15.6 7 -14" stroke="${skinDark}" stroke-width="1.2" fill="none" stroke-linecap="round"/>`;
  }
  return s;
}
// 顔と髪を、位置 c・向き f・傾き tilt で置く
const placeHead = (c, f, tilt, inner) =>
  `<g transform="translate(${P(c)}) rotate(${r1(tilt)}) scale(${f} 1)">${inner}</g>`;

// ---------------- 骨格と姿勢 ----------------
// 求婚者（成人男性）：頭の高さ56（7頭身弱）、肩幅広め
const MALE = {ua: 58, fa: 52, th: 80, sh: 76, shoulder: 31, hip: 14, neck: 13, headR: 28};
const FEMALE = {ua: 50, fa: 45, th: 76, sh: 72, shoulder: 23, hip: 13, neck: 10, headR: 25};

// 姿勢：pelvis（骨盤の中心）、chest（両肩の中点）、肩の傾き、頭の位置ずれと傾き、両足首、両手首と肘の曲がる向き
function skeleton(b, p) {
  const sl = [p.chest[0] - b.shoulder * Math.cos(p.shoulderTilt || 0), p.chest[1] - b.shoulder * Math.sin(p.shoulderTilt || 0)];
  const sr = [p.chest[0] + b.shoulder * Math.cos(p.shoulderTilt || 0), p.chest[1] + b.shoulder * Math.sin(p.shoulderTilt || 0)];
  const hl = [p.pelvis[0] - b.hip, p.pelvis[1] + (p.hipTilt || 0)], hr = [p.pelvis[0] + b.hip, p.pelvis[1] - (p.hipTilt || 0)];
  const armL = ik(sl, p.wristL, b.ua, b.fa, p.elbowL), armR = ik(sr, p.wristR, b.ua, b.fa, p.elbowR);
  const legL = ik(hl, p.ankleL, b.th, b.sh, p.kneeL), legR = ik(hr, p.ankleR, b.th, b.sh, p.kneeR);
  const neckTop = add(p.chest, [p.headDx || 0, -b.neck - 6]);
  const head = add(neckTop, [(p.headDx || 0) * 0.6, -b.headR + 2]);
  return {sl, sr, hl, hr, armL, armR, legL, legR, neckTop, head, ...p};
}

// ---------------- 里の若者 ----------------
const SATO = {skin: '#e3ae80', skinDark: '#c58a5c', cloth: '#c9b184', clothDark: '#a8915f', hakama: '#ad9467', hakamaDark: '#8e7650', cord: '#6e5638', hair: '#231a14'};
function satoFigure(k, mood, extra = '') {
  const c = SATO, f = -1;
  let s = '';
  // 後ろの腕
  const knee = (leg, a) => lerp(leg.mid, leg.end, a);
  // 脚：はかま（ひざ下で足結）とすね・はだし
  for (const [leg, lift] of [[k.legR, k.liftR || 0], [k.legL, k.liftL || 0]]) {
    s += limb(knee(leg, .18), leg.end, 12, 10, c.skin);
    s += foot(leg.end, f, c.skin, {lift, size: 1.05});
  }
  s += `<path d="M${P(add(k.hl, [-10, -4]))} L${P(add(k.hr, [10, -4]))} L${P(add(k.hr, [8, 22]))} L${P(add(k.hl, [-8, 22]))} Z" fill="${c.hakama}"/>`;
  for (const leg of [k.legR, k.legL]) {
    const a = leg === k.legL ? k.hl : k.hr;
    s += limb(a, knee(leg, .16), 30, 25, leg === k.legR ? c.hakamaDark : c.hakama);
    { const a = knee(leg, .1), b = knee(leg, .2), d = len(a, b), nx = -(b[1] - a[1]) / d * 9, ny = (b[0] - a[0]) / d * 9, m = lerp(a, b, .7);
      s += `<path d="M${P([m[0] + nx, m[1] + ny])} L${P([m[0] - nx, m[1] - ny])}" stroke="${c.cord}" stroke-width="3.4" stroke-linecap="round"/>`; }
  }
  // 上衣（太もも丈）。胴は肩から骨盤へ
  const hemL = add(k.hl, [-14, 34]), hemR = add(k.hr, [14, 34]);
  s += `<path d="M${P(add(k.sl, [-6, -7]))} Q${P(add(lerp(k.sl, k.sr, .5), [0, -9]))} ${P(add(k.sr, [6, -7]))} L${P(add(k.hr, [10, 0]))} L${P(hemR)} L${P(hemL)} L${P(add(k.hl, [-10, 0]))} Z" fill="${c.cloth}"/>`;
  s += `<path d="M${P(lerp(k.sr, k.hr, .1))} L${P(add(k.sr, [4, -2]))} L${P(add(k.hr, [10, 0]))} L${P(hemR)} L${P(lerp(hemL, hemR, .72))} Z" fill="${c.clothDark}" opacity=".5"/>`;
  const neckBase = lerp(k.sl, k.sr, .5);
  const waist = lerp(neckBase, k.pelvis, .72);
  s += `<path d="M${P(add(neckBase, [7, 0]))} L${P(add(waist, [-14, 0]))} M${P(add(neckBase, [-7, 0]))} L${P(add(neckBase, [2, 18]))}" stroke="${c.clothDark}" stroke-width="4" fill="none" stroke-linecap="round"/>`;
  s += `<path d="M${P(add(waist, [-28, 0]))} Q${P(add(waist, [0, 5]))} ${P(add(waist, [28, 0]))}" stroke="${c.cord}" stroke-width="5" fill="none"/>`;
  s += `<path d="M${P(add(waist, [-10, 3]))} q-3 12 0 18 M${P(add(waist, [-7, 3]))} q4 10 8 14" stroke="${c.cord}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`;
  // 首（太く短く）
  s += `<path d="M${P(add(neckBase, [-9, 4]))} L${P(add(k.neckTop, [-9, 0]))} L${P(add(k.neckTop, [9, 0]))} L${P(add(neckBase, [9, 4]))} Z" fill="${c.skin}"/>`;
  s += `<path d="M${P(add(k.neckTop, [-9, 0]))} L${P(add(k.neckTop, [9, 0]))} L${P(add(k.neckTop, [9, 7]))} Z" fill="${c.skinDark}" opacity=".6"/>`;
  // 頭：短い髪と、頭の上でまとめた髻
  const hair = `<path d="M-20 -2 Q-22 -26 -2 -29 Q18 -30 21 -12 Q12 -22 2 -21 L3 -16 L-4 -20 Q-10 -16 -12 -6 L-14 4 Q-20 6 -20 -2 Z" fill="${c.hair}"/>` +
    `<ellipse cx="-2" cy="-33" rx="9" ry="8" fill="${c.hair}"/><rect x="-10" y="-30" width="16" height="4.4" rx="2" fill="#d8c49a"/>`;
  s += placeHead(k.head, f, k.headTilt || 0, face({kind: 'male', type: 'sato', mood, skin: c.skin, skinDark: c.skinDark, brow: c.hair, stubble: true, downcast: k.downcast}) + hair);
  // 腕（筒袖）と手
  // armW：腕の太さの倍率。bareForearm：袖をまくった前腕（ひじ寄りに盛り上がる筋肉）。力仕事の男に使う
  const aw = k.armW || 1;
  const arm = (a, sh, side) => (k.bareForearm
    ? limb(sh, a.mid, 17 * aw, 15 * aw, c.cloth) + limb(a.mid, lerp(a.mid, a.end, .35), 13 * aw, 15 * aw, c.skin) + limb(lerp(a.mid, a.end, .35), a.end, 15 * aw, 10 * aw, c.skin) +
      `<path d="M${P(lerp(a.mid, a.end, .2))} L${P(lerp(a.mid, a.end, .7))}" stroke="${c.skinDark}" stroke-width="1.6" opacity=".6"/>` + `<path d="M${P(lerp(sh, a.mid, .78))} l${r1((a.mid[0] - sh[0]) * .02)} 0" stroke="${c.clothDark}" stroke-width="${r1(17 * aw)}" stroke-linecap="butt" opacity=".5"/>`
    : limb(sh, a.mid, 17 * aw, 15 * aw, c.cloth) + limb(a.mid, a.end, 15 * aw, 12 * aw, c.cloth)) +
    hand(a.end, ang(a.mid, a.end), c.skin, {kind: (side > 0 ? k.handL : k.handR) || k.handKind || 'relaxed', size: 1.05 * Math.sqrt(aw), side});
  s += arm(k.armR, k.sr, -1) + arm(k.armL, k.sl, 1);
  return s + extra;
}

// ---------------- 官人（国府の役人・都の貴族） ----------------
function officialFigure(k, o, mood) {
  const f = -1;
  let s = '';
  // 大刀（腰の後ろ側）
  if (o.sword) {
    const a = add(k.pelvis, [16, -14]), b = add(k.pelvis, [56, 70]);
    s += seg(a, b, 6, '#3a2a1e') + seg(add(a, [-5, -10]), a, 6, '#d8b24a') + `<circle cx="${r1(lerp(a, b, .3)[0])}" cy="${r1(lerp(a, b, .3)[1])}" r="3.4" fill="#d8b24a"/><circle cx="${r1(lerp(a, b, .7)[0])}" cy="${r1(lerp(a, b, .7)[1])}" r="3.4" fill="#d8b24a"/>`;
  }
  // すね（白い袴）と黒い履
  for (const [leg, lift] of [[k.legR, k.liftR || 0], [k.legL, k.liftL || 0]]) {
    s += limb(lerp(leg.mid, leg.end, .1), leg.end, 17, 15, '#efe8d8');
    s += foot(leg.end, f, '#22201f', {lift, size: 1.1});
  }
  // 袍：肩から、両ひざの下（すね）までの長い衣。歩幅に合わせて裾が開く
  const hemL = lerp(k.legL.mid, k.legL.end, .42), hemR = lerp(k.legR.mid, k.legR.end, .42);
  const hemY = Math.max(hemL[1], hemR[1]);
  const hl = [Math.min(hemL[0], k.hl[0] - 6) - 14, hemY + 2], hr = [Math.max(hemR[0], k.hr[0] + 6) + 14, hemY];
  const neckBase = lerp(k.sl, k.sr, .5);
  s += `<path d="M${P(add(k.sl, [-8, -8]))} Q${P(add(neckBase, [0, -11]))} ${P(add(k.sr, [8, -8]))} L${P(add(k.hr, [12, 0]))} L${P(hr)} Q${P(lerp(hl, hr, .5))} ${P(hl)} L${P(add(k.hl, [-12, 0]))} Z" fill="${o.robe}"/>`;
  s += `<path d="M${P(lerp(k.sr, k.hr, .08))} L${P(add(k.sr, [6, -2]))} L${P(add(k.hr, [12, 0]))} L${P(hr)} L${P(lerp(hl, hr, .7))} Z" fill="${o.robeDark}" opacity=".45"/>`;
  s += `<path d="M${P(add(k.pelvis, [0, 8]))} L${P(lerp(hl, hr, .5))}" stroke="${o.robeDark}" stroke-width="1.6" opacity=".6"/>`;
  s += `<path d="M${P(add(hl, [4, -10]))} Q${P(add(lerp(hl, hr, .5), [0, -6]))} ${P(add(hr, [-4, -10]))}" stroke="${o.robeDark}" stroke-width="2.4" fill="none" opacity=".7"/>`;
  // 帯と帯金具
  const waist = lerp(neckBase, k.pelvis, .7);
  const wl = add(waist, [-27, 0]), wr = add(waist, [27, 0]);
  s += seg(wl, wr, 9, '#22201f');
  for (let i = 0; i < 6; i++) { const q = lerp(wl, wr, (i + .5) / 6); s += `<rect x="${r1(q[0] - 3)}" y="${r1(q[1] - 2.5)}" width="6" height="5" rx="1" fill="${o.fitting}"/>`; }
  // 盤領（まるいえり）と首
  s += `<path d="M${P(add(neckBase, [-9, 4]))} L${P(add(k.neckTop, [-9, 0]))} L${P(add(k.neckTop, [9, 0]))} L${P(add(neckBase, [9, 4]))} Z" fill="${o.skin}"/>`;
  s += `<path d="M${P(add(k.neckTop, [-9, 0]))} L${P(add(k.neckTop, [9, 0]))} L${P(add(k.neckTop, [9, 7]))} Z" fill="${o.skinDark}" opacity=".6"/>`;
  s += `<path d="M${P(add(neckBase, [-14, -2]))} Q${P(add(neckBase, [0, 14]))} ${P(add(neckBase, [14, -2]))}" stroke="${o.robeDark}" stroke-width="6" fill="none" stroke-linecap="round"/>`;
  // 頭：黒い頭巾と後ろへ垂れる纓
  const zukin = `<path d="M-16 -18 Q-34 -6 -36 22 L-30 23 Q-28 2 -14 -12 Z" fill="#1d1a1a"/><path d="M-12 -20 Q-28 -2 -26 26 L-20 26 Q-21 4 -8 -14 Z" fill="#1d1a1a"/>` +
    `<path d="M-21 2 Q-23 -27 0 -30 Q20 -30 22 -10 Q18 -12 14 -14 Q6 -19 -4 -18 Q-12 -15 -14 4 Z" fill="#1d1a1a"/>` +
    `<path d="M-12 -24 Q-12 -44 2 -44 Q14 -42 10 -26 Z" fill="#1d1a1a"/><path d="M-6 -38 q6 -4 10 0" stroke="#4a4646" stroke-width="2" fill="none"/>` +
    `<path d="M-14 4 L-12 -6 L-10 6 Z" fill="#2a1e18"/>`;
  s += placeHead(k.head, f, k.headTilt || 0, face({kind: 'male', type: o.type, mood, skin: o.skin, skinDark: o.skinDark, brow: '#1d1612', mustache: o.mustache, beard: o.beard, lines: o.lines}) + zukin);
  // 腕（広めの袖）と手、笏
  const arm = (a, sh, side, kind) => limb(sh, a.mid, 20, 19, o.robe) + limb(a.mid, a.end, 19, 17, o.robe) +
    hand(a.end, ang(a.mid, a.end), o.skin, {kind, size: 1.05, side});
  // underFirst：持ち物を両腕より先に描く（体の手前で抱えた束を、両腕で支える形）
  if (k.under && k.underFirst) s += k.under;
  s += arm(k.armR, k.sr, -1, k.handR || 'relaxed');
  if (k.shaku) s += shaku(k.shaku.at, k.shaku.angle);
  // 体と手前の腕のあいだに抱える持ち物（小脇に抱えた巻物など）
  if (k.under && !k.underFirst) s += k.under;
  // hideArmL：奥の腕を体のかげに隠して描かない（馬上で片手だけ手綱を持つ場合など）
  if (!k.hideArmL) s += arm(k.armL, k.sl, 1, k.handL || 'relaxed');
  if (k.shakuFront) s += shaku(k.shakuFront.at, k.shakuFront.angle);
  return s;
}
const shaku = (at, angle) => `<g transform="translate(${P(at)}) rotate(${r1(angle)})"><path d="M-5 -34 Q0 -37 5 -34 L5.6 14 L-5.6 14 Z" fill="#eadcbc"/><path d="M2 -34 L3 14" stroke="#cdb990" stroke-width="2"/></g>`;
const gloom = c => `<g stroke="#5b6fa8" stroke-width="2" opacity=".75" stroke-linecap="round">${[-12, -4, 4, 12].map(d => `<path d="M${r1(c[0] + d)} ${r1(c[1] - 12 - Math.abs(d) * .2)} v${r1(16 - Math.abs(d) * .4)}"/>`).join('')}</g>`;
const sweat = (x, y) => `<path d="M${x} ${y} q6 9 0 13 q-6 -4 0 -13 z" fill="#8fc7ea"/>`;
const motion = (pts) => pts.map(([x, y, w]) => `<path d="M${x} ${y} h${w}" stroke="#ffffff" stroke-width="2.4" stroke-linecap="round" opacity=".8"/>`).join('');

// ---------------- 姿勢の定義（求婚者は画面の左＝手児奈のほうを向く） ----------------
const malePoses = {
  // 立ち：両足に体重。片足を少し前に
  stand: {pelvis: [122, 180], chest: [121, 82], ankleL: [108, 334], ankleR: [136, 334], kneeL: 1, kneeR: 1,
    wristL: [90, 190], wristR: [153, 190], elbowL: 1, elbowR: -1, headDx: -1, headTilt: 0},
  // 求婚：前（画面の左）へ一歩ふみ出し、前のひざを曲げ、後ろ足のかかとを上げ、上体を前へ
  kime: {pelvis: [124, 186], chest: [114, 92], shoulderTilt: .04, ankleL: [70, 334], ankleR: [164, 330], kneeL: 1, kneeR: 1, liftR: 12,
    headDx: -4, headTilt: -4},
  // 断られて：ひざから力がぬけ、内またに折れて後ろへよろめく。肩を落とし、両手はだらりと、うつむく
  rejected: {pelvis: [136, 214], hipTilt: 4, chest: [126, 124], shoulderTilt: .1, ankleL: [102, 334], ankleR: [158, 334], kneeL: 1, kneeR: 1,
    wristL: [100, 232], wristR: [154, 240], elbowL: 1, elbowR: -1, headDx: -6, headTilt: 26, liftL: 4},
};

const SATO_KIME = {...malePoses.kime, chest: [118, 94], headTilt: -2, wristL: [104, -2], wristR: [124, -2], elbowL: -1, elbowR: 1, handKind: 'open'};
function sato(pose) {
  if (pose === 'stand') return satoFigure(skeleton(MALE, malePoses.stand), 'stand');
  if (pose === 'kime') {
    // 両うでで頭の上に大きなハート
    const k = skeleton(MALE, SATO_KIME);
    return satoFigure(k, 'eager', `<path d="M36 110 q-8 -10 0 -15 q4 -2 7 2 q3 -4 7 -2 q8 5 0 15 l-7 7 z" fill="#e8667a"/><path d="M200 70 q-6 -8 0 -12 q3 -2 6 1 q3 -3 6 -1 q6 4 0 12 l-6 6 z" fill="#e8667a" opacity=".85"/>` + motion([[180, 300, 22], [176, 312, 14]]));
  }
  const k = skeleton(MALE, malePoses.rejected);
  return satoFigure(k, 'pained', gloom(add(k.head, [0, -30])) + sweat(r1(k.head[0] + 26), r1(k.head[1] - 14)));
}

const KOKUFU = {type: 'kokufu', robe: '#2f6644', robeDark: '#1f4a30', fitting: '#9a8a62', skin: '#efc7a2', skinDark: '#d6a27a'};
const MIYAKO = {type: 'miyako', robe: '#e8836a', robeDark: '#c0583f', fitting: '#e0bb4f', skin: '#f6dcc0', skinDark: '#dcb28e', sword: true, mustache: true, beard: true, lines: true};
function kokufu(pose) {
  if (pose === 'stand') {
    // 笏を両手で胸の前に持つ。少し緊張して背筋をのばす
    const p = {...malePoses.stand, wristL: [112, 182], wristR: [130, 184], elbowL: 1, elbowR: -1, handL: 'grip', handR: 'grip', shakuFront: {at: [121, 180], angle: 0}};
    const k = skeleton(MALE, p);
    return officialFigure(k, KOKUFU, 'serious') + sweat(r1(k.head[0] + 24), r1(k.head[1] - 18));
  }
  if (pose === 'kime') {
    // 一歩ふみ出し、片手を胸に、もう片方の手を手児奈のほうへさしだす
    const p = {...malePoses.kime, wristR: [116, 120], elbowR: -1, handR: 'grip', shaku: {at: [118, 118], angle: 14}, wristL: [24, 104], elbowL: -1, handL: 'open'};
    return officialFigure(skeleton(MALE, p), KOKUFU, 'serious') + motion([[186, 300, 22], [180, 312, 14]]);
  }
  const p = {...malePoses.rejected, handR: 'grip', shaku: {at: [154, 262], angle: 168}};
  const k = skeleton(MALE, p);
  return officialFigure(k, KOKUFU, 'pained') + gloom(add(k.head, [0, -36])) + sweat(r1(k.head[0] + 26), r1(k.head[1] - 14));
}
function miyako(pose) {
  if (pose === 'stand') {
    // 胸を張り、笏を片手に持って腰に手をあてる
    const p = {...malePoses.stand, ankleL: [100, 334], ankleR: [142, 334], wristL: [96, 168], elbowL: 1, handL: 'fist', wristR: [140, 130], elbowR: -1, handR: 'grip', shaku: {at: [140, 128], angle: 10}};
    return officialFigure(skeleton(MALE, p), MIYAKO, 'stand');
  }
  if (pose === 'kime') {
    // 一歩ふみ出し、両うでを横へ大きく広げる
    const p = {...malePoses.kime, chest: [120, 92], ankleL: [74, 334], ankleR: [162, 330], wristL: [20, 50], elbowL: -1, handL: 'open', wristR: [214, 48], elbowR: 1, handR: 'grip', shaku: {at: [214, 46], angle: 24}, headTilt: -8};
    return officialFigure(skeleton(MALE, p), MIYAKO, 'proud') +
      `<path d="M30 140 l4 -10 l4 10 l10 4 l-10 4 l-4 10 l-4 -10 l-10 -4 z" fill="#f5d86a"/><path d="M200 120 l3 -7 l3 7 l7 3 l-7 3 l-3 7 l-3 -7 l-7 -3 z" fill="#f5d86a"/>`;
  }
  const p = {...malePoses.rejected, handR: 'grip', shaku: {at: [154, 262], angle: 168}};
  const k = skeleton(MALE, p);
  return officialFigure(k, MIYAKO, 'pained') + gloom(add(k.head, [0, -36])) + sweat(r1(k.head[0] + 26), r1(k.head[1] - 14));
}

// ---------------- 手児奈 ----------------
const TK = {skin: '#f6d7bd', skinDark: '#e3b898', cloth: '#ece4cf', clothDark: '#d4c7a6', mo: '#e0d5b8', moDark: '#c9bb97', eri: '#2f5b9a', hair: '#1d1a2b'};
function tekonaFigure(k, mood, {jar = false, sway = 0, palm = false} = {}) {
  const c = TK, f = 1;
  let s = '';
  const neckBase = lerp(k.sl, k.sr, .5);
  // 長い髪（後ろ）。とかしていない毛先
  const hb = add(k.head, [-2, -6]);
  s += `<path d="M${P(add(hb, [-22, -6]))} Q${P(add(hb, [-30, 70]))} ${P(add(hb, [-22 + sway, 132]))} l6 -5 l5 7 l6 -6 l6 6 l6 -6 l6 6 l6 -5 l5 6 Q${P(add(hb, [30, 70]))} ${P(add(hb, [22, -6]))} Z" fill="${c.hair}"/>`;
  // はだしの足と、ひだのある裳
  s += foot(k.legR.end, f, c.skin, {lift: k.liftR || 0, size: .9}) + foot(k.legL.end, f, c.skin, {lift: k.liftL || 0, size: .9});
  const waist = lerp(neckBase, k.pelvis, .66);
  const hemL = [Math.min(k.legL.end[0], k.legR.end[0]) - 20, Math.max(k.legL.end[1], k.legR.end[1]) - 2];
  const hemR = [Math.max(k.legL.end[0], k.legR.end[0]) + 18, hemL[1] + 2];
  s += `<path d="M${P(add(waist, [-21, 0]))} L${P(add(waist, [21, 0]))} Q${P(add(k.hr, [14, 60]))} ${P(hemR)} Q${P(lerp(hemL, hemR, .5))} ${P(hemL)} Q${P(add(k.hl, [-14, 60]))} ${P(add(waist, [-21, 0]))} Z" fill="${c.mo}"/>`;
  for (let i = 1; i < 6; i++) s += `<path d="M${P(lerp(add(waist, [-21, 14]), add(waist, [21, 14]), i / 6))} L${P(lerp(hemL, hemR, i / 6))}" stroke="${c.moDark}" stroke-width="1.6"/>`;
  s += `<path d="M${P(add(waist, [8, 0]))} L${P(add(waist, [21, 0]))} Q${P(add(k.hr, [14, 60]))} ${P(hemR)} L${P(lerp(hemL, hemR, .74))} Z" fill="${c.moDark}" opacity=".45"/>`;
  // 麻の上衣（腰丈）と青い衿
  const topL = add(k.hl, [-16, 10]), topR = add(k.hr, [16, 10]);
  s += `<path d="M${P(add(k.sl, [-5, -5]))} Q${P(add(neckBase, [0, -7]))} ${P(add(k.sr, [5, -5]))} L${P(topR)} Q${P(lerp(topL, topR, .5))} ${P(topL)} Z" fill="${c.cloth}"/>`;
  s += `<path d="M${P(add(neckBase, [8, 6]))} L${P(add(k.sr, [3, -1]))} L${P(topR)} L${P(lerp(topL, topR, .7))} Z" fill="${c.clothDark}" opacity=".45"/>`;
  // 衿（右前）：外側の衿は画面の右上から左下へ
  s += `<path d="M${P(add(neckBase, [-7, -1]))} L${P(add(neckBase, [1, 18]))}" stroke="#22457a" stroke-width="6" stroke-linecap="round"/>`;
  s += `<path d="M${P(add(neckBase, [7, -1]))} L${P(add(topL, [12, -4]))}" stroke="${c.eri}" stroke-width="7" stroke-linecap="round"/>`;
  // 倭文の帯
  const wl = add(waist, [-22, 2]), wr = add(waist, [22, 2]);
  s += seg(wl, wr, 8, '#7a4a3a');
  for (let i = 0; i < 11; i++) { const q = lerp(wl, wr, (i + .5) / 11); s += `<rect x="${r1(q[0] - 1)}" y="${r1(q[1] - 4)}" width="2" height="8" fill="${['#2f5b9a', '#efe2c4', '#a8483a', '#efe2c4'][i % 4]}"/>`; }
  s += `<path d="M${P(add(wl, [8, 4]))} q-3 14 0 24 M${P(add(wl, [11, 4]))} q3 12 8 18" stroke="#7a4a3a" stroke-width="2.4" fill="none" stroke-linecap="round"/>`;
  // 首（短め）
  s += `<path d="M${P(add(neckBase, [-6, 3]))} L${P(add(k.neckTop, [-6, 0]))} L${P(add(k.neckTop, [6, 0]))} L${P(add(neckBase, [6, 3]))} Z" fill="${c.skin}"/>`;
  s += `<path d="M${P(add(k.neckTop, [-6, 0]))} L${P(add(k.neckTop, [6, 0]))} L${P(add(k.neckTop, [6, 5]))} Z" fill="${c.skinDark}" opacity=".6"/>`;
  // 頭：中央で分けた前髪と、肩へ垂れる横の髪。飾りはつけない
  const hair = `<path d="M-19 4 Q-23 -26 0 -28 Q22 -28 21 -6 Q16 -16 8 -18 Q6 -10 3 -18 Q-4 -18 -10 -10 Q-14 -2 -15 10 Z" fill="${c.hair}"/>` +
    `<path d="M-19 -2 Q-26 30 -20 52 L-12 48 Q-14 24 -12 0 Z" fill="${c.hair}"/>`;
  s += placeHead(k.head, f, k.headTilt || 0, face({kind: 'female', mood, skin: c.skin, skinDark: c.skinDark, brow: c.hair, eye: '#2a1d2a'}) + hair);
  // 腕と手
  const arm = (a, sh, side, kind) => limb(sh, a.mid, 13, 12, c.cloth) + limb(a.mid, a.end, 12, 10, c.cloth) + hand(a.end, ang(a.mid, a.end), c.skin, {kind, size: .85, side});
  if (jar) {
    s += arm(k.armR, k.sr, -1, 'grip');
    const j = add(lerp(k.armL.end, k.armR.end, .5), [0, 14]);
    s += `<path d="M${P(add(j, [-14, -18]))} q-14 18 -6 36 q20 14 40 0 q8 -18 -6 -36 z" fill="#b5703c"/><path d="M${P(add(j, [-18, -2]))} q18 5 36 0" stroke="#9a5a2c" stroke-width="2" fill="none"/>`;
    s += `<ellipse cx="${r1(j[0])}" cy="${r1(j[1] - 18)}" rx="15" ry="4.5" fill="#7a4a24"/><ellipse cx="${r1(j[0])}" cy="${r1(j[1] - 18.5)}" rx="10" ry="2.8" fill="#4d6f8f"/>`;
    s += arm(k.armL, k.sl, 1, 'grip');
  } else {
    s += arm(k.armL, k.sl, 1, 'relaxed') + arm(k.armR, k.sr, -1, palm ? 'open' : 'relaxed');
  }
  return s;
}
const femalePoses = {
  // 水がめをかかえ、片足に体重をのせて立つ（手児奈は画面の右＝求婚者のほうを向く）
  stand: {pelvis: [118, 180], hipTilt: 3, chest: [120, 86], shoulderTilt: -.03, ankleL: [108, 334], ankleR: [134, 330], kneeL: -1, kneeR: -1, liftR: 3,
    wristL: [108, 160], wristR: [136, 160], elbowL: 1, elbowR: -1, headDx: 1, headTilt: 3},
  // やさしく、はっきり：上体を少し引き、手のひらを相手へ向ける
  refuse: {pelvis: [120, 180], chest: [116, 86], shoulderTilt: .02, ankleL: [104, 334], ankleR: [138, 332], kneeL: -1, kneeR: -1,
    wristL: [96, 188], wristR: [180, 98], elbowL: 1, elbowR: 1, headDx: -2, headTilt: -6},
  // 自分の生き方を決める：両足をそろえ、両手を胸に、まっすぐ立つ
  resolve: {pelvis: [120, 180], chest: [120, 84], ankleL: [110, 334], ankleR: [132, 334], kneeL: -1, kneeR: -1,
    wristL: [116, 122], wristR: [126, 124], elbowL: 1, elbowR: -1, headDx: 1, headTilt: -2},
};
function tekona(pose) {
  const k = skeleton(FEMALE, femalePoses[pose]);
  if (pose === 'stand') return tekonaFigure(k, 'smile', {jar: true});
  if (pose === 'refuse') return tekonaFigure(k, 'gentle', {palm: true});
  return tekonaFigure(k, 'resolve', {sway: -6}) +
    `<path d="M40 60 q6 -10 12 0 q-6 10 -12 0 z M190 40 q5 -8 10 0 q-5 8 -10 0 z" fill="#f7c9d4"/>`;
}

// ---------------- 参加者の枠の仮の人物（「？」） ----------------
function newcomer(pose) {
  let s = sato(pose);
  const map = {[SATO.cloth]: '#a7adb3', [SATO.clothDark]: '#8a9096', [SATO.hakama]: '#8a9096', [SATO.hakamaDark]: '#767c82', [SATO.cord]: '#5f656b',
    [SATO.hair]: '#7d8389', [SATO.skin]: '#cfd3d7', [SATO.skinDark]: '#b9bec3', '#d8c49a': '#b8bdc2', '#e8667a': '#c9ced3', '#3a2a20': '#7d8389', '#8a4a3a': '#9aa0a6', '#7a2e28': '#9aa0a6'};
  for (const [a, b] of Object.entries(map)) s = s.replaceAll(a, b);
  const h = skeleton(MALE, pose === 'kime' ? SATO_KIME : malePoses[pose]).head;
  s += `<g transform="translate(${P(h)}) rotate(${pose === 'rejected' ? 28 : 0})"><ellipse cx="2" cy="2" rx="20" ry="25" fill="#cfd3d7"/><text x="2" y="16" font-size="36" font-family="sans-serif" font-weight="bold" fill="#fff" text-anchor="middle">?</text></g>`;
  return s;
}

const svg = (name, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="380" viewBox="0 -20 240 380"><title>${name}</title>${body}</svg>\n`;
// ほかの生成スクリプト（kokubunji.cjs など）から人物の部品を使えるようにする
module.exports = {face, placeHead, limb, hand, foot, ik, lerp, add, seg, ang, len, P, r1, MALE, FEMALE, SATO, skeleton, satoFigure, officialFigure, shaku, KOKUFU, MIYAKO};
if (require.main === module) {
  const out = process.argv[2];
  const files = {};
  for (const p of ['stand', 'refuse', 'resolve']) files[`tekona-${p}`] = tekona(p);
  for (const p of ['stand', 'kime', 'rejected']) {
    files[`sato-${p}`] = sato(p);
    files[`kokufu-${p}`] = kokufu(p);
    files[`miyako-${p}`] = miyako(p);
    files[`newcomer-${p}`] = newcomer(p);
  }
  for (const [n, b] of Object.entries(files)) fs.writeFileSync(path.join(out, `${n}.svg`), svg(n, b));
  console.log(Object.keys(files).length, 'files');
}
