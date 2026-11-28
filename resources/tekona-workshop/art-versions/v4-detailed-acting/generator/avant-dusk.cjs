// An open evening inlet keeps the white stork visible throughout its takeoff.
const fs = require('node:fs');
const path = require('node:path');
const {pineRow} = require('./backdrops.cjs');
function scene() {
  let body = `<defs><linearGradient id="avant-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#444b72"/><stop offset=".38" stop-color="#8e7396"/><stop offset=".65" stop-color="#d29395"/><stop offset="1" stop-color="#efbd99"/></linearGradient><linearGradient id="avant-water" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b295a9"/><stop offset=".5" stop-color="#827c9a"/><stop offset="1" stop-color="#5b6585"/></linearGradient><radialGradient id="avant-glow"><stop offset="0" stop-color="#f8d4ae" stop-opacity=".7"/><stop offset="1" stop-color="#efbba0" stop-opacity="0"/></radialGradient></defs><rect width="480" height="360" fill="url(#avant-sky)"/><ellipse cx="111" cy="202" rx="182" ry="101" fill="url(#avant-glow)"/>`;
  body += `<path d="M-30 48 Q50 34 118 44 T270 46 Q340 33 510 41 L510 54 Q350 46 267 60 Q191 53 118 56 Q49 48 -30 60 Z" fill="#625d7d" opacity=".6"/><path d="M-10 104 Q66 92 144 101 Q206 90 278 101 Q359 88 490 100 L490 107 Q358 100 278 111 Q201 101 144 113 Q63 104 -10 117 Z" fill="#a38196" opacity=".55"/><path d="M10 153 Q90 145 156 151 M255 146 Q328 139 404 145" stroke="#dfaaa5" stroke-width="4" stroke-linecap="round" fill="none" opacity=".7"/>`;
  body += `<path d="M0 220 Q67 211 142 224 Q201 213 258 224 Q333 215 402 225 Q440 218 480 222 V241 H0 Z" fill="#65657c"/><path d="M0 233 Q106 228 210 236 Q338 228 480 234 V360 H0 Z" fill="url(#avant-water)"/>`;
  body += `<path d="M0 225 Q48 216 102 224 L146 238 H0 Z" fill="#4c5269"/>`+pineRow([12,35,60,86,110],226,.4,['#4c5269','#555b72'],73);
  for(const [x,y,w] of [[42,249,83],[87,261,66],[60,280,96],[151,294,62],[77,316,92],[208,249,46],[267,271,60],[404,257,59],[416,324,54]]) body+=`<path d="M${x} ${y} h${w}" stroke="#d4bcc0" stroke-width="1.3" stroke-linecap="round" opacity=".47"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="360" viewBox="0 0 480 360"><title>avant-dusk</title>${body}</svg>\n`;
}
module.exports={scene};
if(require.main===module) fs.writeFileSync(path.join(process.argv[2],'avant-dusk.svg'),scene());
