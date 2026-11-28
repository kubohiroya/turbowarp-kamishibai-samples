// A fictional family farewell; historical context is documented in research-notes.md.
const fs = require('node:fs');
const path = require('node:path');
const {skeleton, MALE, FEMALE, satoFigure, limb, hand, ang, placeHead} = require('./chars.cjs');
const {person, place, C} = require('./village.cjs');
const {grass, rnd0} = require('./backdrops.cjs');

function scene(frame = 0) {
  const phase = frame * Math.PI / 8;
  let s = `<defs><linearGradient id="farewell-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#272e43"/><stop offset=".38" stop-color="#4c465f"/><stop offset=".58" stop-color="#7e5e69"/><stop offset="1" stop-color="#8c716a"/></linearGradient></defs><rect width="480" height="360" fill="url(#farewell-sky)"/>`;
  // Low, uneven banks of cloud roll with the gusts while the dusk light fades below.
  for (const [y,color,opacity,offset] of [[2,'#30364a',1,0],[37,'#444458',.95,21],[78,'#615668',.75,7],[108,'#75606d',.55,39]]) {
    const dx=-12*Math.sin(phase+offset/18), dy=2*Math.sin(phase+offset/12);
    s += `<g transform="translate(${dx.toFixed(2)} ${dy.toFixed(2)})" opacity="${opacity}"><path d="M-40 ${y-36} H520 V${y+10} Q478 ${y+27} 434 ${y+13} Q389 ${y+31} 348 ${y+15} Q303 ${y+34} 253 ${y+14} Q218 ${y+27} 169 ${y+12} Q121 ${y+32} 73 ${y+15} Q18 ${y+26} -40 ${y+12} Z" fill="${color}"/></g>`;
  }
  s += `<path d="M0 150 Q120 120 260 154 Q370 130 480 148 V240 H0 Z" fill="#4e5355"/><path d="M0 179 Q130 164 270 180 Q360 169 480 185 V360 H0 Z" fill="#7d726a"/><path d="M290 360 Q342 253 480 205 V237 Q376 287 350 360 Z" fill="#918275"/>`;

  s += `<path d="M50 264 L62 182 L296 182 L316 270 Z" fill="#ab9270"/><path d="M43 264 Q68 165 150 111 Q176 94 198 113 Q280 165 325 266 Q278 257 245 266 Q135 256 43 264 Z" fill="#ae9566"/><path d="M43 264 Q68 165 150 111 L176 102 Q109 178 86 265 Z" fill="#8e7952"/><path d="M149 112 Q176 105 198 113" stroke="#746441" stroke-width="7" fill="none" stroke-linecap="round"/>`;
  const rnd = rnd0(311);
  for (let i=0;i<74;i++) {
    const x=60+rnd()*248, y=150+rnd()*110;
    if (y < 117+Math.abs(x-177)*.7) continue;
    s += `<path d="M${x.toFixed(1)} ${y.toFixed(1)} l${((x-177)*.06).toFixed(1)} ${(10+rnd()*14).toFixed(1)}" stroke="${i%3?'#c4ad7a':'#8c7850'}" stroke-width="1.6" stroke-linecap="round" opacity=".8"/>`;
  }
  s += `<path d="M87 267 l4 -8 5 7 7 -9 5 8 8 -7 5 8 M247 267 l6 -7 7 8 8 -9 7 9 6 -6 8 7" stroke="#8e7952" stroke-width="3" fill="none"/><path d="M144 270 V213 Q172 199 198 213 V270 Z" fill="#443e31"/><path d="M140 270 V211 M201 211 V270" stroke="#79684b" stroke-width="5"/><path d="M64 274 Q180 282 310 274" stroke="#9f8a64" stroke-width="3" fill="none"/>`;
  for(const [x0,x1,base,seed,h] of [[0,65,284,31,12],[346,480,276,47,15]]) s += `<g transform="translate(0 ${base}) skewX(${(12+5*Math.sin(phase+seed)).toFixed(2)}) translate(0 ${-base})">${grass(x0,x1,base,'#6c765a',seed,h)}</g>`;
  s += `<ellipse cx="242" cy="338" rx="139" ry="11" fill="#ac9a78" opacity=".45"/>`;

  const father = skeleton(MALE,{pelvis:[114,182],chest:[104,120],ankleL:[96,334],ankleR:[136,334],kneeL:-1,kneeR:-1,wristL:[76,247],wristR:[90,244],elbowL:1,elbowR:-1,headDx:-12,headTilt:-28,downcast:true});
  const grief=placeHead(father.head,-1,father.headTilt,`<path d="M-13 -10 Q-7 -10 -1 -15 M8 -15 Q13 -10 18 -9" stroke="#797974" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M2 -15 q2 -4 4 -1 M-6 4 Q-8 10 -6 18" stroke="#bcd2d9" stroke-width="1.4" fill="none" stroke-linecap="round"/>`);
  s += place(satoFigure(father,'pained',grief,{faceType:'kokufu',hairStyle:'lowBun',stubble:false,mustache:true,beard:true,skin:'#cfa17d',skinDark:'#a77a59',hair:'#b6b2a8',cloth:'#c0b19a',clothDark:'#a6967c',hakama:'#8d806a',hakamaDark:'#736854',cord:'#635640'}),124,336,.61,-1);

  const colors={faceType:'sakimori',hairStyle:'ponytail',stubble:false,skin:'#dda87a',skinDark:'#b98252',cloth:'#aeaa98',clothDark:'#8d8976',hakama:'#8c8a78',hakamaDark:'#6f6d5c',cord:'#5e5340',hair:'#221a12'};
  const young = skeleton(MALE,{pelvis:[122,180],chest:[123,102],ankleL:[108,334],ankleR:[146,334],kneeL:-1,kneeR:-1,wristL:[48,168],wristR:[172,216],elbowL:-1,elbowR:-1,headDx:-4,headTilt:-12,downcast:true,handL:'relaxed',handR:'grip'});
  const travel=`<path d="M168 135 l21 3 -8 87 -19 -3 Z" fill="#755e40"/><path d="M175 141 L182 71 M181 141 L192 78 M185 142 L199 69" stroke="#99825a" stroke-width="2.4"/><path d="M182 71 l-6 9 6 -3 5 4 M192 78 l-6 9 6 -3 5 4 M199 69 l-6 9 6 -3 5 4" stroke="#e5dfcc" stroke-width="2" fill="none"/><path d="M177 92 Q215 206 165 320" stroke="#806641" stroke-width="4" fill="none"/><path d="M177 92 L165 320" stroke="#bba77d" stroke-width="1.2"/>`;
  s += place(satoFigure({...young,back:travel},'serious','',colors),274,338,.64);

  const mother = skeleton(FEMALE,{pelvis:[100,222],chest:[145,150],shoulderTilt:.05,ankleL:[78,334],ankleR:[115,334],kneeL:-1,kneeR:-1,wristL:[210,180],wristR:[215,162],elbowL:1,elbowR:-1,headDx:6,headTilt:18});
  const roundedBack=`<path d="M81 221 Q75 184 105 153 Q123 135 143 146 L133 173 113 218 Z" fill="${C.old.cloth}"/>`;
  s += place(roundedBack+person(mother,{colors:C.old,hair:'oldbun',brow:'#a8a39b',old:true,mood:'cry',skirt:'long',handL:'grip',handR:'grip'}),200,338,.59);
  // Redraw only the son's near arm over the mother so his palm rests on her shoulder.
  const arm=limb(young.sl,young.armL.mid,17,15,colors.cloth)+limb(young.armL.mid,young.armL.end,15,12,colors.cloth)+hand(young.armL.end,ang(young.armL.mid,young.armL.end),colors.skin,{kind:'relaxed',size:1.05,side:1});
  s += place(arm,274,338,.64);
  s += `<path d="M363 310 q16 -8 32 0 l-2 21 q-14 7 -29 0 Z" fill="#b8a17b"/><path d="M368 309 q5 -19 23 0" stroke="#7c694d" stroke-width="2.5" fill="none"/><path d="M370 320 h19" stroke="#907959" stroke-width="1.4"/>`;
  s += `<rect width="480" height="360" fill="#303249" opacity=".20"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="360" viewBox="0 0 480 360"><title>sakimori-departure</title>${s}</svg>\n`;
}
module.exports={scene};
if(require.main===module) {
  const out=process.argv[2], animation=path.join(out,'ambient');
  fs.mkdirSync(animation,{recursive:true});
  fs.writeFileSync(path.join(out,'sakimori-departure.svg'),scene());
  for(let frame=0;frame<16;frame++) fs.writeFileSync(path.join(animation,`departure-${String(frame+1).padStart(2,'0')}.svg`),scene(frame));
}
