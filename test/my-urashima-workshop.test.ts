import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {test} from 'vitest';
import {parse} from 'yaml';
import {createMyUrashimaPoseVariant, workshopPoseCounts} from '../scripts/my-urashima-workshop.ts';

const source = await readFile('stories/my-urashima/my-urashima.k4.yml', 'utf8');
for (const count of workshopPoseCounts) {
  test(`${count}-pose choice enables exactly the matching costumes and one repeated pose sequence`, () => {
    const original = parse(source);
    const variant = parse(createMyUrashimaPoseVariant(source, count));
    const names = Array.from({length: count}, (_, i) => `p${i + 1}`);
    assert.deepEqual(Object.keys(variant.assets).filter((id) => /^p[1-4]$/.test(id)), names);
    const key = 'welcome to dragon castle';
    const actions = variant.scenes[key].actions;
    const poses = actions.filter((action: Record<string, unknown>) => 'Princess.pose' in action);
    assert.equal(poses.length, 1);
    assert.deepEqual(poses[0]['Princess.pose'].steps, [...names, ...names].map((pose) => ({pose, skin: pose, sound: 'Drum Funky'})));
    variant.scenes[key].actions = actions.filter((action: Record<string, unknown>) => !('Princess.pose' in action));
    for (const name of names) delete variant.assets[name];
    assert.deepEqual(variant, original, 'Only the selected costume definitions and pose command may change.');
  });
}
test('rejects a missing workshop choice instead of generating a mismatched count', () => {
  assert.throws(() => createMyUrashimaPoseVariant(source.replace('#  p2: costume:Princess', ''), 2));
});
test('rejects an unsupported pose count', () => {
  assert.throws(() => createMyUrashimaPoseVariant(source, 1 as 2));
});
