// SPDX-License-Identifier: MPL-2.0
// 手児奈ワークショップ：掲示板の提出文から、参加者の場面を加えた台本YAMLを組み立てる。
// ブラウザ（compose.html）とNode（検証スクリプト）の両方から使う。依存はない。

const templateStart = '  # suitor-NN:';
const templateEnd = '  #   （手児奈の心がゆれなかったときは';
const fields = {
  席番号: 'nn',
  '作者の名前（紙芝居に出してよい名前）': 'author',
  作者の名前: 'author',
  求婚者の名前: 'name',
  決めポーズの説明: 'hint',
  ことわられたポーズの説明: 'rejectedHint',
  求婚の言葉: 'proposal',
  手児奈のことわりの言葉: 'refusal',
  ことわられたときのひとこと: 'after',
  '手児奈の心はゆれた？（ゆれた／ゆれなかった）': 'moved',
  '手児奈の心はゆれた？': 'moved',
  モデルのリンク: 'model',
};
const placeholders = {
  求婚者の名前: 'name',
  作者の名前: 'author',
  決めポーズの説明: 'hint',
  ことわられたポーズの説明: 'rejectedHint',
  求婚の言葉: 'proposal',
  手児奈のことわりの言葉: 'refusal',
  ことわられたときのひとこと: 'after',
};
/** The costume names of every suitor sprite and the class names of every suitor's pose model. */
export const costumeNames = ['stand', 'kime', 'rejected'];
const modelPattern = /^https:\/\/teachablemachine\.withgoogle\.com\/models\/[A-Za-z0-9_-]+\/$/u;

/** Read one board submission written with the template in the participant handout. */
export function parseSubmission(text) {
  const result = {};
  for (const line of String(text).split(/\r?\n/u)) {
    const match = /^\s*([^：:]+?)\s*[：:]\s*(.*?)\s*$/u.exec(line);
    if (!match) continue;
    const key = fields[match[1]];
    if (key && match[2] && !(key in result)) result[key] = match[2];
  }
  if (result.nn) result.nn = String(result.nn).replace(/[０-９]/gu, (d) => String(d.charCodeAt(0) - 0xff10)).padStart(2, '0');
  if (result.model && !result.model.endsWith('/')) result.model += '/';
  result.moved = result.moved ? !/なかった|いいえ|no|false/iu.test(result.moved) : true;
  return result;
}

/** Check a parsed submission; returns a list of Japanese problems for the assistant. */
export function checkSubmission(submission) {
  const problems = [];
  if (!/^\d{2}$/u.test(submission.nn ?? '')) problems.push('席番号が2けたの数字ではありません');
  for (const [label, key] of Object.entries(placeholders))
    if (!submission[key]) problems.push(`「${label}」がありません`);
  for (const key of Object.values(placeholders)) {
    const value = submission[key] ?? '';
    if (/["\\]|[\u0000-\u001f]/u.test(value)) problems.push(`「${value.slice(0, 10)}…」に使えない記号があります`);
    if (value.length > 40) problems.push(`「${value.slice(0, 10)}…」が40字をこえています`);
  }
  if (!modelPattern.test(submission.model ?? ''))
    problems.push('モデルのリンクが https://teachablemachine.withgoogle.com/models/…/ の形ではありません');
  return problems;
}

function quoted(value) {
  return JSON.stringify(String(value));
}

function templateOf(source) {
  const start = source.indexOf(templateStart);
  const end = source.indexOf(templateEnd);
  if (start < 0 || end <= start) throw new Error('台本に参加者の場面の雛形（★参加者）がありません。');
  return source
    .slice(start, end)
    .trimEnd()
    .split('\n')
    .map((line) => line.replace(/^ {2}# ?/u, '  ').replace(/^ {2}#$/u, ''))
    .join('\n');
}

/** The YAML for one participant: asset declarations and the scene, from the source template. */
export function participantYaml(source, submission, {pose = 'kime'} = {}) {
  const nn = submission.nn;
  let scene = templateOf(source)
    .replaceAll('suitor-NN', `suitor-${nn}`)
    .replaceAll('PoseNN', `Pose${nn}`)
    .replaceAll('SuitorNN', `Suitor${nn}`)
    .replaceAll('sNN-', `s${nn}-`)
    .replace('pose: kime', `pose: ${pose}`);
  // Fill every placeholder of a text, then quote the whole text once, so participant words
  // never change the YAML structure.
  scene = scene
    .split('\n')
    .map((line) =>
      line.replace(/\{text: (.*〔.*?), (style|seconds): /u, (_, text, next) => {
        const filled = text.replace(/〔([^〕]+)〕/gu, (whole, label) =>
          placeholders[label] ? submission[placeholders[label]] : whole);
        return `{text: ${quoted(filled)}, ${next}: `;
      }))
    .join('\n');
  if (!submission.moved) scene = scene.split('\n').filter((line) => !line.includes('Tekona.think')).join('\n');
  if (/〔|NN/u.test(scene)) throw new Error(`席番号${nn}の場面に置き換えていない部分があります。`);
  // Every suitor has its own sprite with the costumes stand, kime and rejected.
  const assets = [
    ...costumeNames.map((costume) => `  s${nn}-${costume}: {kind: costume, target: Suitor${nn}, name: ${costume}}`),
    `  Pose${nn}:`,
    '    kind: recognitionModel',
    '    delivery: remote',
    '    loading: lazy',
    '    source:',
    `      url: ${submission.model}`,
  ].join('\n');
  return {assets, actor: `  Suitor${nn}: s${nn}-stand`, scene};
}

function insert(source, parts) {
  if (source.split('\n  quarrel:\n').length !== 2) throw new Error('台本に quarrel の場面が1つだけある必要があります。');
  if (source.split('\nactors:\n').length !== 2) throw new Error('台本に actors が1つだけある必要があります。');
  return source
    .replace('\nactors:\n', `\n${parts.map(({assets}) => assets).join('\n')}\nactors:\n${parts.map(({actor}) => actor).join('\n')}\n`)
    .replace('\n  quarrel:\n', `\n${parts.map(({scene}) => scene).join('\n\n')}\n\n  quarrel:\n`);
}

/**
 * Block-script workshop: pre-register `count` participant slots in seat order. Each slot scene
 * keeps its whole body inside `if: {condition: false}` and refers to placeholder assets
 * (`sNN-stand`／`sNN-pose` costumes and model `PoseNN`), so an assistant only replaces values.
 */
export function composeSlots(source, count, {modelUrl, modelUrls = {}, pose = 'kime'} = {}) {
  if (!Number.isInteger(count) || count < 1 || count > 99) throw new Error('枠の数は1〜99です。');
  if (!modelPattern.test(modelUrl ?? '')) throw new Error('見本モデルのリンクが正しくありません。');
  for (const [nn, url] of Object.entries(modelUrls)) {
    if (!/^\d{2}$/u.test(nn) || Number(nn) < 1 || Number(nn) > count) throw new Error(`席番号${nn}の枠はありません。`);
    if (!modelPattern.test(url)) throw new Error(`席番号${nn}のモデルのリンクが正しくありません。`);
  }
  const slots = Array.from({length: count}, (_, index) => {
    const nn = String(index + 1).padStart(2, '0');
    // A seat may have its own pre-uploaded model; rc.79 cannot change a remote URL in the editor.
    const placeholder = {nn, model: modelUrls[nn] ?? modelUrl, moved: true};
    for (const [label, key] of Object.entries(placeholders)) placeholder[key] = `（${label}）`;
    const {assets, actor, scene} = participantYaml(source, placeholder, {pose});
    const lines = scene.split('\n');
    const actions = lines.indexOf('    actions:');
    if (actions < 0) throw new Error('雛形の場面に actions がありません。');
    const body = lines.slice(actions + 1).map((line) => (line ? `      ${line}` : line));
    return {
      assets,
      actor,
      scene: [
        ...lines.slice(0, actions + 1),
        '      - if:',
        '          condition: false',
        '          then:',
        ...body,
      ].join('\n'),
    };
  });
  return insert(source, slots);
}

/** Insert every participant, in seat order, into the half-finished source. */
export function composeParticipants(source, submissions, options = {}) {
  const sorted = [...submissions].sort((left, right) => left.nn.localeCompare(right.nn));
  const seats = new Set();
  for (const submission of sorted) {
    if (seats.has(submission.nn)) throw new Error(`席番号${submission.nn}が重複しています。`);
    seats.add(submission.nn);
  }
  const parts = sorted.map((submission) => participantYaml(source, submission, options));
  return parts.length ? insert(source, parts) : source;
}
