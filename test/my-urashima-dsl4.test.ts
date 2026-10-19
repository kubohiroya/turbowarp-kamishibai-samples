import {test} from 'vitest';

import {buildMyUrashimaDsl4} from '../scripts/build-my-urashima-dsl4.ts';

test('DSL 4.0 my-urashima preserves its workshop base and builds canonical editable blocks', async () => {
  await buildMyUrashimaDsl4();
});
