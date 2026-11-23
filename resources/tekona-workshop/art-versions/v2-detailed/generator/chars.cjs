// 手児奈の立ち絵・求婚者のポーズ絵（240x380, viewBox 0 -20 240 380, 回転中心 120,190）を生成する。
// 考証メモ resources/tekona-workshop/research-notes.md の 2.3・3.1 にもとづく。
const fs = require('fs');
const path = require('path');

const SKIN = '#f6d7bd', SKIN_SH = '#e8bf9f', CHEEK = '#f29c9c', EYE = '#3a2a20', MOUTH = '#a0453a';

const poly = (pts, color, w) =>
  `<polyline points="${pts.map(p => p.join(',')).join(' ')}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
const hand = ([x, y], r = 9.5) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${SKIN}"/>`;
const arm = (pts, sleeve, w = 21, cuff) => {
  let s = poly(pts, sleeve, w);
  if (cuff) {
    const a = pts[pts.length - 2], b = pts[pts.length - 1];
    const t = 0.78, cx = a[0] + (b[0] - a[0]) * t, cy = a[1] + (b[1] - a[1]) * t;
    s += poly([[cx, cy], b], cuff, w);
  }
  return s + hand(pts[pts.length - 1]);
};

// 顔。face: -1=画面の左向き、+1=右向き。mood: happy | smile | serious | proud | sad | gentle | resolve | closed
function face({cx = 120, cy = 70, face = 0, mood = 'happy', hairColor = '#2b2118', mustache = false, tilt = 0}) {
  const d = face * 6;
  const ex1 = cx - 11 + d, ex2 = cx + 11 + d, ey = cy + 1, my = cy + 17;
  let s = '';
  // 耳（向きと反対側に見える）
  if (face !== 0) s += `<ellipse cx="${cx - face * 31}" cy="${cy + 4}" rx="6" ry="9" fill="${SKIN}"/><ellipse cx="${cx - face * 31}" cy="${cy + 4}" rx="2.5" ry="5" fill="${SKIN_SH}"/>`;
  s += `<ellipse cx="${cx}" cy="${cy}" rx="32" ry="36" fill="${SKIN}"/>`;
  // 鼻（向いている側にわずかに）
  s += `<path d="M${cx + d * 1.3} ${cy + 6} q${face * 3 || 2} 4 0 6" fill="none" stroke="${SKIN_SH}" stroke-width="2.4" stroke-linecap="round"/>`;
  const brow = (x, dy, slope) => `<path d="M${x - 6} ${ey - 12 + dy - slope} L${x + 6} ${ey - 12 + dy + slope}" stroke="${hairColor}" stroke-width="2.6" stroke-linecap="round"/>`;
  const dot = x => `<circle cx="${x}" cy="${ey}" r="4.3" fill="${EYE}"/><circle cx="${x + 1.5}" cy="${ey - 1.6}" r="1.4" fill="#fff"/>`;
  const arcUp = x => `<path d="M${x - 5} ${ey + 1} q5 -6 10 0" fill="none" stroke="${EYE}" stroke-width="2.8" stroke-linecap="round"/>`;
  const arcDown = x => `<path d="M${x - 5} ${ey - 1} q5 5 10 0" fill="none" stroke="${EYE}" stroke-width="2.8" stroke-linecap="round"/>`;
  switch (mood) {
    case 'happy':
      s += dot(ex1) + dot(ex2) + brow(ex1, 0, 0) + brow(ex2, 0, 0);
      s += `<path d="M${cx - 9 + d} ${my - 2} q9 10 18 0 z" fill="${MOUTH}"/>`;
      break;
    case 'smile':
      s += dot(ex1) + dot(ex2) + brow(ex1, 1, 0) + brow(ex2, 1, 0);
      s += `<path d="M${cx - 8 + d} ${my - 1} q8 7 16 0" fill="none" stroke="${MOUTH}" stroke-width="2.8" stroke-linecap="round"/>`;
      break;
    case 'serious':
      s += dot(ex1) + dot(ex2) + brow(ex1, -1, face * 1.5) + brow(ex2, -1, -face * 1.5);
      s += `<path d="M${cx - 5 + d} ${my} h10" stroke="${MOUTH}" stroke-width="2.8" stroke-linecap="round"/>`;
      break;
    case 'proud':
      s += arcUp(ex1) + arcUp(ex2) + brow(ex1, -3, 0) + brow(ex2, -3, 0);
      s += `<path d="M${cx - 10 + d} ${my - 3} q10 11 20 0 z" fill="${MOUTH}"/>`;
      break;
    case 'gentle':
      s += arcUp(ex1) + arcUp(ex2) + brow(ex1, 0, -1.5) + brow(ex2, 0, 1.5);
      s += `<path d="M${cx - 5 + d} ${my} q5 3 10 0" fill="none" stroke="${MOUTH}" stroke-width="2.6" stroke-linecap="round"/>`;
      break;
    case 'resolve':
      s += dot(ex1) + dot(ex2) + brow(ex1, -2, 1) + brow(ex2, -2, -1);
      s += `<path d="M${cx - 7 + d} ${my - 1} q7 5 14 0" fill="none" stroke="${MOUTH}" stroke-width="2.8" stroke-linecap="round"/>`;
      break;
    case 'sad':
      s += arcDown(ex1) + arcDown(ex2) + brow(ex1, -1, -2.5) + brow(ex2, -1, 2.5);
      s += `<path d="M${cx - 7 + d} ${my + 3} q7 -6 14 0" fill="none" stroke="${MOUTH}" stroke-width="2.8" stroke-linecap="round"/>`;
      break;
  }
  if (mustache) s += `<path d="M${cx - 9 + d} ${my - 8} q4.5 -3 9 -0.5 q4.5 -2.5 9 0.5" fill="none" stroke="${hairColor}" stroke-width="2.6" stroke-linecap="round"/>`;
  const blush = mood === 'sad' ? 0.3 : 0.55;
  s += `<ellipse cx="${cx - 19 + d}" cy="${cy + 12}" rx="6.5" ry="3.6" fill="${CHEEK}" opacity="${blush}"/><ellipse cx="${cx + 19 + d}" cy="${cy + 12}" rx="6.5" ry="3.6" fill="${CHEEK}" opacity="${blush}"/>`;
  return tilt ? `<g transform="rotate(${tilt} ${cx} ${cy + 30})">${s}</g>` : s;
}

// がっかりの記号（縦線と汗）
const gloom = (cx, cy) =>
  `<g stroke="#5b6fa8" stroke-width="2.2" opacity=".75" stroke-linecap="round"><path d="M${cx - 14} ${cy - 30} v14 M${cx - 6} ${cy - 33} v18 M${cx + 2} ${cy - 33} v18 M${cx + 10} ${cy - 30} v14"/></g>` +
  `<path d="M${cx + 30} ${cy - 18} q6 9 0 13 q-6 -4 0 -13 z" fill="#8fc7ea"/>`;
const sweat = (x, y) => `<path d="M${x} ${y} q6 9 0 13 q-6 -4 0 -13 z" fill="#8fc7ea"/>`;

// ---------- 里の若者：麻の上衣と袴、足結、髪は頭の上でまとめる、はだし ----------
const SATO = {cloth: '#c9b184', clothDark: '#a8915f', hakama: '#ad9467', cord: '#6e5638', hair: '#2b2118'};
function satoHair(cx, cy, face) {
  return `<path d="M${cx - 31} ${cy - 6} q3 -32 31 -34 q28 2 31 34 q-14 -12 -31 -13 q-17 1 -31 13 z" fill="${SATO.hair}"/>` +
    `<ellipse cx="${cx + face * 2}" cy="${cy - 44}" rx="11" ry="10" fill="${SATO.hair}"/>` +
    `<rect x="${cx - 10 + face * 2}" y="${cy - 38}" width="20" height="5" rx="2.5" fill="#d9c49a"/>`;
}
function satoBody({shoulderDrop = 0}) {
  const sy = 122 + shoulderDrop;
  let s = '';
  // 袴（ひざ下で足結）
  s += `<path d="M84 228 L82 300 L116 300 L120 246 L124 300 L158 300 L156 228 Z" fill="${SATO.hakama}"/>`;
  s += `<path d="M120 246 v52" stroke="${SATO.clothDark}" stroke-width="2"/>`;
  s += `<path d="M83 294 h34 M123 294 h34" stroke="${SATO.cord}" stroke-width="5" stroke-linecap="round"/>`;
  s += `<path d="M90 294 q-4 8 -8 10 M150 294 q4 8 8 10" stroke="${SATO.cord}" stroke-width="3" fill="none" stroke-linecap="round"/>`;
  // すね・はだし（左向き）
  s += `<rect x="90" y="298" width="18" height="44" fill="${SKIN}"/><rect x="132" y="298" width="18" height="44" fill="${SKIN}"/>`;
  s += `<ellipse cx="94" cy="346" rx="15" ry="6" fill="${SKIN}"/><ellipse cx="136" cy="346" rx="15" ry="6" fill="${SKIN}"/>`;
  // 上衣（太もも丈）
  s += `<path d="M90 ${sy} L150 ${sy} L164 248 L76 248 Z" fill="${SATO.cloth}"/>`;
  s += `<path d="M120 ${sy} L100 210 M120 ${sy} L142 214" stroke="${SATO.clothDark}" stroke-width="5" fill="none"/>`;
  s += `<path d="M120 ${sy} L142 214 L142 248" stroke="${SATO.clothDark}" stroke-width="2" fill="none"/>`;
  // ひもの帯と結び目
  s += `<path d="M80 212 Q120 218 160 212" stroke="${SATO.cord}" stroke-width="6" fill="none"/>`;
  s += `<path d="M104 215 q-4 14 -2 22 M106 215 q4 12 8 18" stroke="${SATO.cord}" stroke-width="3" fill="none" stroke-linecap="round"/>`;
  return s;
}
function sato(pose) {
  const face = -1;
  if (pose === 'stand') {
    return satoBody({}) + `<rect x="112" y="100" width="16" height="24" fill="${SKIN}"/>` +
      face_({cx: 120, cy: 70, face, mood: 'happy', hairColor: SATO.hair}) + satoHair(120, 70, face) +
      arm([[92, 128], [82, 186], [84, 240]], SATO.cloth, 21) + arm([[148, 128], [158, 186], [156, 240]], SATO.cloth, 21);
  }
  if (pose === 'kime') {
    // 両うでで頭の上に大きなハート
    return satoBody({}) + `<rect x="112" y="100" width="16" height="24" fill="${SKIN}"/>` +
      face_({cx: 120, cy: 70, face, mood: 'happy', hairColor: SATO.hair}) + satoHair(120, 70, face) +
      arm([[92, 128], [62, 72], [76, 10], [111, 4]], SATO.cloth, 20) + arm([[148, 128], [178, 72], [164, 10], [129, 4]], SATO.cloth, 20) +
      `<path d="M30 110 q-7 -9 0 -13 q4 -2 6 2 q2 -4 6 -2 q7 4 0 13 l-6 6 z" fill="#e8667a"/>` +
      `<path d="M206 70 q-5 -7 0 -10 q3 -2 5 1 q2 -3 5 -1 q5 3 0 10 l-5 5 z" fill="#e8667a" opacity=".85"/>`;
  }
  // rejected：肩を落とし、両手を下に垂らしてうつむく
  return satoBody({shoulderDrop: 4}) + `<rect x="112" y="104" width="16" height="22" fill="${SKIN}"/>` +
    `<g transform="translate(-2 8)">` + face_({cx: 120, cy: 70, face, mood: 'sad', hairColor: SATO.hair, tilt: -8}) +
    `<g transform="rotate(-8 120 100)">${satoHair(120, 70, face)}</g></g>` +
    gloom(112, 70) +
    arm([[94, 134], [94, 192], [100, 252]], SATO.cloth, 21) + arm([[146, 134], [146, 192], [140, 252]], SATO.cloth, 21);
}
const face_ = face;

// ---------- 官人：袍（盤領）、黒い頭巾、帯と帯金具、笏、白い袴、黒い履 ----------
function officialBody({robe, robeDark, fitting, shoulderDrop = 0, sword = false}) {
  const sy = 122 + shoulderDrop;
  let s = '';
  // 白い袴と黒い履（左向き）
  s += `<path d="M90 300 L88 338 L152 338 L150 300 Z" fill="#efe8d8"/>`;
  s += `<path d="M78 340 q2 -8 18 -8 h10 v14 h-26 z M122 340 q2 -8 18 -8 h10 v14 h-26 z" fill="#22201f"/>`;
  // 大刀（腰の後ろ側）
  if (sword) s += `<path d="M150 222 L200 302" stroke="#3a2a1e" stroke-width="7" stroke-linecap="round"/><path d="M150 222 l-8 -12" stroke="#d8b24a" stroke-width="6" stroke-linecap="round"/><circle cx="168" cy="251" r="4" fill="#d8b24a"/><circle cx="186" cy="280" r="4" fill="#d8b24a"/>`;
  // 袍
  s += `<path d="M90 ${sy} L150 ${sy} L170 312 L70 312 Z" fill="${robe}"/>`;
  s += `<path d="M120 ${sy + 18} V312" stroke="${robeDark}" stroke-width="2" opacity=".6"/>`;
  // 盤領（まるいえり）
  s += `<path d="M102 ${sy + 2} Q120 ${sy + 24} 138 ${sy + 2}" stroke="${robeDark}" stroke-width="7" fill="none" stroke-linecap="round"/>`;
  s += `<path d="M132 ${sy + 12} l10 -6" stroke="${robeDark}" stroke-width="4" stroke-linecap="round"/>`;
  // 帯と帯金具
  s += `<rect x="78" y="206" width="84" height="12" rx="2" fill="#22201f"/>`;
  for (const x of [86, 100, 114, 128, 142, 154]) s += `<rect x="${x - 4}" y="208.5" width="8" height="7" rx="1" fill="${fitting}"/>`;
  return s;
}
function zukin(cx, cy, face, color = '#1d1a1a') {
  // 頭巾：頭をおおう黒い布。頂の髻のふくらみと、後ろに垂れる2本の纓
  const back = -face;
  return `<path d="M${cx + back * 24} ${cy - 14} q${back * 12} 18 ${back * 10} 40 l${back * 8} 2 q${back * 2} -24 ${back * -8} -44 z" fill="${color}"/>` +
    `<path d="M${cx + back * 28} ${cy - 10} q${back * 16} 16 ${back * 18} 34 l${back * 7} -3 q${back * -2} -18 ${back * -14} -34 z" fill="${color}"/>` +
    `<path d="M${cx - 33} ${cy - 2} q-2 -36 33 -38 q35 2 33 38 q-12 -8 -33 -9 q-21 1 -33 9 z" fill="${color}"/>` +
    `<ellipse cx="${cx + back * 4}" cy="${cy - 40}" rx="14" ry="12" fill="${color}"/>` +
    `<path d="M${cx - 30} ${cy - 10} q30 -10 60 0" stroke="#3a3636" stroke-width="2" fill="none"/>`;
}
const shaku = (x, y, angle = 0) =>
  `<g transform="rotate(${angle} ${x} ${y})"><rect x="${x - 5.5}" y="${y - 44}" width="11" height="50" rx="4" fill="#eadcbc"/><rect x="${x - 5.5}" y="${y - 44}" width="11" height="50" rx="4" fill="none" stroke="#c8b48c" stroke-width="1.5"/></g>`;

function official(pose, o) {
  const face = -1;
  const body = sd => officialBody({...o, shoulderDrop: sd});
  const neck = (y = 100) => `<rect x="112" y="${y}" width="16" height="24" fill="${SKIN}"/>`;
  const head = mood => face_({cx: 120, cy: 70, face, mood, hairColor: '#1d1a1a', mustache: o.mustache}) + zukin(120, 70, face);
  if (pose === 'stand') {
    // 笏を両手で胸の前に持つ
    return body(0) + neck() + head(o.standMood) +
      arm([[92, 128], [86, 178], [112, 196]], o.robe, 22) + arm([[148, 128], [154, 178], [128, 196]], o.robe, 22) +
      shaku(120, 192) + `<circle cx="112" cy="196" r="9.5" fill="${SKIN}"/>` + `<circle cx="128" cy="196" r="9.5" fill="${SKIN}"/>` +
      (o.standSweat ? sweat(160, 46) : '');
  }
  if (pose === 'kime') {
    if (o.kime === 'offer') {
      // 片手を胸に当て、もう片方の手を横（手児奈のほう）へさしだす
      return body(0) + neck() + head(o.kimeMood) +
        arm([[148, 128], [158, 176], [128, 162]], o.robe, 22) + shaku(134, 166, 18) + hand([128, 162]) +
        arm([[92, 128], [56, 146], [20, 132]], o.robe, 22) + `<ellipse cx="14" cy="130" rx="11" ry="7" fill="${SKIN}"/>`;
    }
    // 両うでを横へ大きく広げる
    return body(0) + neck() + head(o.kimeMood) +
      arm([[92, 128], [54, 118], [20, 98]], o.robe, 22) + arm([[148, 128], [186, 118], [220, 98]], o.robe, 22) +
      shaku(220, 98, -12) + hand([220, 98]) +
      `<path d="M28 50 l4 -10 l4 10 l10 4 l-10 4 l-4 10 l-4 -10 l-10 -4 z" fill="#f5d86a"/><path d="M196 34 l3 -7 l3 7 l7 3 l-7 3 l-3 7 l-3 -7 l-7 -3 z" fill="#f5d86a"/>`;
  }
  // rejected：肩を落とし、笏を下げて、うつむく
  return body(4) + neck(104) +
    `<g transform="translate(-2 8)"><g transform="rotate(-8 120 100)">${face_({cx: 120, cy: 70, face, mood: 'sad', hairColor: '#1d1a1a', mustache: o.mustache}) + zukin(120, 70, face)}</g></g>` +
    gloom(112, 66) +
    arm([[94, 134], [94, 192], [100, 252]], o.robe, 22) + arm([[146, 134], [146, 192], [140, 252]], o.robe, 22) +
    `<g transform="rotate(168 140 252)">${shaku(140, 252)}</g>` + hand([140, 252]);
}

// ---------- 手児奈：麻の衣に青い衿、麻の裳、倭文の帯、髪は飾らず長く、はだし ----------
const TK = {cloth: '#ece4cf', clothDark: '#d4c7a6', mo: '#e0d5b8', moDark: '#c9bb97', eri: '#2f5b9a', hair: '#1d1a2b'};
function tekonaHairBack(cx, cy, sway = 0) {
  // 長くまっすぐな髪。とかしていない毛先を少し不揃いに
  return `<path d="M${cx - 34} ${cy - 6} Q${cx - 40} ${cy + 80} ${cx - 34 + sway} ${cy + 150} l6 -6 l5 8 l6 -6 l6 6 L${cx + 22 + sway} ${cy + 152} l6 -8 l6 6 Q${cx + 40} ${cy + 80} ${cx + 34} ${cy - 6} Z" fill="${TK.hair}"/>` +
    `<path d="M${cx - 36 + sway} ${cy + 138} q-6 8 -4 16 M${cx + 36 + sway} ${cy + 136} q6 8 3 15" stroke="${TK.hair}" stroke-width="2.5" fill="none" stroke-linecap="round"/>`;
}
function tekonaHairFront(cx, cy, face) {
  const d = face * 3;
  // 中央で分けた前髪と、肩の前へ垂れる長い横の髪（飾りはつけない）
  return `<path d="M${cx - 33 + d} ${cy + 8} q-3 -46 ${33 - d} -45 q${36 + d} -1 ${33 - d} 45 q-8 -24 -30 -34 q-3 -2 -6 0 q-22 10 -30 34 z" fill="${TK.hair}"/>` +
    `<path d="M${cx - 31} ${cy - 4} q-12 60 -8 114 l6 -5 l4 7 q4 -56 6 -112 z" fill="${TK.hair}"/>` +
    `<path d="M${cx + 31} ${cy - 4} q12 60 8 114 l-6 -5 l-4 7 q-4 -56 -6 -112 z" fill="${TK.hair}"/>`;
}
function shitsuObi(y) {
  // 倭文（しつ）の帯：縞を織り出した細い帯
  let s = `<rect x="80" y="${y}" width="80" height="11" fill="#7a4a3a"/>`;
  const cols = ['#2f5b9a', '#e9dcbf', '#a44a3a', '#e9dcbf'];
  for (let i = 0; i < 16; i++) s += `<rect x="${80 + i * 5}" y="${y}" width="2.6" height="11" fill="${cols[i % 4]}"/>`;
  return s + `<path d="M98 ${y + 10} q-3 16 2 30 M103 ${y + 10} q2 14 8 26" stroke="#7a4a3a" stroke-width="3" fill="none" stroke-linecap="round"/>`;
}
function tekonaBody() {
  let s = '';
  // 裳（ひだのある長いスカート状の衣）
  s += `<path d="M84 206 L156 206 L178 338 L62 338 Z" fill="${TK.mo}"/>`;
  for (const [x1, x2] of [[96, 84], [108, 104], [120, 120], [132, 136], [144, 156]]) s += `<path d="M${x1} 222 L${x2} 336" stroke="${TK.moDark}" stroke-width="2"/>`;
  // はだし（右向き）
  s += `<ellipse cx="104" cy="344" rx="14" ry="6" fill="${SKIN}"/><ellipse cx="142" cy="344" rx="14" ry="6" fill="${SKIN}"/>`;
  // 麻の上衣（腰丈）と青い衿
  s += `<path d="M90 120 L150 120 L162 226 L78 226 Z" fill="${TK.cloth}"/>`;
  s += `<path d="M108 120 L120 150 L140 212 L150 212 L128 140 L132 120 Z" fill="${TK.clothDark}" opacity=".45"/>`;
  s += `<path d="M106 120 L120 148 L142 212" stroke="${TK.eri}" stroke-width="8" fill="none" stroke-linejoin="round"/>`;
  s += `<path d="M134 120 L120 148" stroke="${TK.eri}" stroke-width="8" fill="none"/>`;
  s += shitsuObi(206);
  return s;
}
function tekona(pose) {
  const face = 1;
  const base = tekonaHairBack(120, 70, pose === 'resolve' ? -6 : 0) + tekonaBody() + `<rect x="112" y="100" width="16" height="24" fill="${SKIN}"/>`;
  const head = mood => face_({cx: 120, cy: 70, face, mood, hairColor: TK.hair}) + tekonaHairFront(120, 70, face);
  if (pose === 'stand') {
    // 土師器の甕を両手でかかえる
    return base + head('smile') +
      arm([[92, 126], [84, 176], [102, 202]], TK.cloth, 21) + arm([[148, 126], [156, 176], [138, 202]], TK.cloth, 21) +
      `<path d="M104 196 q-18 22 -8 46 q24 18 48 0 q10 -24 -8 -46 z" fill="#b5703c"/>` +
      `<path d="M100 216 q20 6 40 0" stroke="#9a5a2c" stroke-width="2" fill="none"/>` +
      `<ellipse cx="120" cy="196" rx="17" ry="5.5" fill="#7a4a24"/><ellipse cx="120" cy="195" rx="12" ry="3.5" fill="#4d6f8f"/>` +
      hand([102, 202]) + hand([138, 202]);
  }
  if (pose === 'refuse') {
    // やさしく、はっきり：片手のひらを相手（上手）へ向ける
    return base + head('gentle') +
      arm([[92, 126], [86, 180], [100, 206]], TK.cloth, 21) +
      arm([[148, 126], [182, 150], [204, 118]], TK.cloth, 21) +
      `<ellipse cx="206" cy="112" rx="9" ry="13" fill="${SKIN}"/>` + hand([100, 206]);
  }
  // resolve：両手を胸に当て、まっすぐ前を見る
  return base + head('resolve') +
    arm([[92, 126], [88, 170], [114, 158]], TK.cloth, 21) + arm([[148, 126], [152, 170], [128, 160]], TK.cloth, 21) +
    hand([114, 158]) + hand([128, 160]) +
    `<path d="M40 60 q6 -10 12 0 q-6 10 -12 0 z M190 40 q5 -8 10 0 q-5 8 -10 0 z" fill="#f7c9d4"/>`;
}

const svg = (name, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="380" viewBox="0 -20 240 380"><title>${name}</title>${body}</svg>\n`;

const out = process.argv[2];
const files = {
  'tekona-stand': tekona('stand'),
  'tekona-refuse': tekona('refuse'),
  'tekona-resolve': tekona('resolve'),
  'sato-stand': sato('stand'),
  'sato-kime': sato('kime'),
  'sato-rejected': sato('rejected'),
};
const KOKUFU = {robe: '#2f6644', robeDark: '#1f4a30', fitting: '#9a8a62', standMood: 'serious', standSweat: true, kimeMood: 'serious', kime: 'offer'};
const MIYAKO = {robe: '#e8836a', robeDark: '#c0583f', fitting: '#e0bb4f', sword: true, mustache: true, standMood: 'smile', kimeMood: 'proud', kime: 'wide'};
for (const p of ['stand', 'kime', 'rejected']) {
  files[`kokufu-${p}`] = official(p, KOKUFU);
  files[`miyako-${p}`] = official(p, MIYAKO);
}
for (const [n, b] of Object.entries(files)) fs.writeFileSync(path.join(out, `${n}.svg`), svg(n, b));
console.log(Object.keys(files).length, 'files');
