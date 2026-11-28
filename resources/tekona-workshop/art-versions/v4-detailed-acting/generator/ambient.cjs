// Derive native Scratch layers; SVG animation is not preserved by the Scratch renderer.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {execFileSync} = require('node:child_process');

function layers(svg) {
  const stack = [], result = [];
  for (const match of svg.matchAll(/<g\b[^>]*>|<\/g>/g)) {
    if (match[0].startsWith('</')) {
      const start = stack.pop();
      if (!start) throw Error('Unbalanced SVG group');
      if (start.tag.includes('data-ambient=')) {
        const type = /data-ambient="([^"]+)"/.exec(start.tag)[1];
        const pivot = ['x', 'y'].map(axis => Number(new RegExp(`data-pivot-${axis}="([^"]+)"`).exec(start.tag)?.[1] ?? (axis === 'x' ? 240 : 180)));
        result.push({type, pivot, start: start.index, end: match.index + match[0].length,
          svg: svg.slice(start.index, match.index + match[0].length)});
      }
    } else stack.push({tag: match[0], index: match.index});
  }
  if (stack.length) throw Error('Unclosed SVG group');
  return result.sort((a, b) => a.start - b.start);
}

function generate(out) {
  fs.mkdirSync(out, {recursive: true});
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'tekona-ambient-'));
  const index = {};
  try {
    for (const name of ['backdrops', 'sea', 'extra', 'tenkei'])
      execFileSync(process.execPath, [path.join(__dirname, `${name}.cjs`), temp]);
    for (const file of fs.readdirSync(temp).sort()) {
      if (!file.endsWith('.svg')) continue;
      const name = file.slice(0, -4), svg = fs.readFileSync(path.join(temp, file), 'utf8');
      const parts = layers(svg);
      if (/^storm-/.test(name)) fs.copyFileSync(path.join(temp, file), path.join(out, file));
      if (!parts.length) continue;
      const defs = /<defs>[\s\S]*?<\/defs>/.exec(svg)?.[0] ?? '';
      const wrap = body => `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="360" viewBox="0 0 480 360">${defs}${body}</svg>\n`;
      let still = svg;
      for (const part of [...parts].reverse()) still = still.slice(0, part.start) + still.slice(part.end);
      fs.writeFileSync(path.join(out, `${name}-still.svg`), still);
      const birds = parts.filter(p => p.type === 'birds'), reeds = parts.filter(p => p.type === 'reeds');
      if (birds.length) fs.writeFileSync(path.join(out, `${name}-birds.svg`), wrap(birds.map(p => p.svg).join('')));
      if (reeds.length) for (let frame = 0; frame < 16; frame++) {
        // Shear each clump around its own waterline; every root stays fixed.
        const body = reeds.map((part, i) => {
          const angle = 3 * Math.sin(frame * Math.PI / 8 + i * .7), base = part.pivot[1];
          return `<g transform="translate(0 ${base}) skewX(${angle.toFixed(3)}) translate(0 ${-base})">${part.svg}</g>`;
        }).join('');
        fs.writeFileSync(path.join(out, `${name}-reeds-${String(frame + 1).padStart(2, '0')}.svg`), wrap(body));
      }
      index[name] = {birds: birds.length, reeds: reeds.map(p => p.pivot)};
    }
    fs.writeFileSync(path.join(out, 'index.json'), JSON.stringify(index, null, 2) + '\n');
  } finally { fs.rmSync(temp, {recursive: true, force: true}); }
  return index;
}
module.exports = {layers, generate};
if (require.main === module) console.log(JSON.stringify(generate(process.argv[2])));
