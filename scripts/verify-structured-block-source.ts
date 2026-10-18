import assert from 'node:assert/strict';

import {parse} from 'yaml';

import type {Dsl4Story} from './dsl4.ts';
import type {ScratchBlock, ScratchProject} from './scratch.ts';

const authoringPrefix = 'kubohiroyakamishibaiauthoring4_';
const runtimePrefix = 'kubohiroyakamishibai4_kubohiroyakamishibairuntime4__';

/** Reject a YAML string masquerading as a block script, including disconnected actions. */
export function verifyStructuredBlockSource(project: ScratchProject, sourceText: string): void {
  const stage = project.targets.find((target) => target.isStage);
  assert(stage, 'The block source project must keep its Stage.');
  assert(project.extensions?.includes('kubohiroyakamishibaiauthoring4'));
  assert(project.extensionURLs?.kubohiroyakamishibaiauthoring4?.startsWith('data:'));
  const blocks = stage.blocks;
  for (const target of project.targets) {
    for (const block of Object.values(target.blocks)) {
      assert(
        !/(?:whenDsl4Source|dsl4SourceFromYamlJson)$/.test(block.opcode),
        'A block script must not contain the retired YAML string declaration.',
      );
    }
  }
  const hats = Object.entries(blocks).filter(
    ([, block]) => block.opcode === `${authoringPrefix}kamishibai` && block.topLevel === true,
  );
  assert.equal(hats.length, 1, 'The story must have one labeled script hat.');
  const [hatId, hat] = hats[0]!;
  assert.deepEqual(hat.inputs?.VERSION, [1, [10, '4.0']]);
  const story = parse(sourceText, {uniqueKeys: true}) as Dsl4Story;
  const sceneIds: string[] = [];
  const visited = new Set([hatId]);

  function connected(id: string, parent: string): ScratchBlock {
    assert(!visited.has(id), `The block script contains a cycle at ${id}.`);
    visited.add(id);
    const block = blocks[id];
    assert(block, `The block script is missing ${id}.`);
    assert.equal(block.parent, parent, `Block ${id} must stay connected to its parent.`);
    return block;
  }

  let parent = hatId;
  let id = hat.next;
  while (id) {
    const block = connected(id, parent);
    if (block.opcode === `${authoringPrefix}scene`) {
      const sceneId = block.inputs?.SCENE?.[1]?.[1] as string;
      sceneIds.push(sceneId);
      const sourceScene = story.scenes?.[sceneId];
      assert(sourceScene, `Unexpected scene ${sceneId}.`);
      const actions = (
        Array.isArray(sourceScene)
          ? sourceScene
          : (sourceScene as {actions: Record<string, unknown>[]}).actions
      ) as Record<string, unknown>[];
      const commands: string[] = [];
      let actionParent = id;
      let actionId = block.inputs?.SUBSTACK?.[1] as string | undefined;
      while (actionId) {
        const action = connected(actionId, actionParent);
        let commandBlock = action;
        if (action.opcode === `${authoringPrefix}actionOptions`) {
          const childId = action.inputs?.SUBSTACK?.[1] as string;
          commandBlock = connected(childId, actionId);
          assert.equal(commandBlock.next, null, 'Action options must wrap one command.');
        }
        assert(
          commandBlock.opcode.startsWith(runtimePrefix),
          `Scene ${sceneId} must use editable runtime command blocks.`,
        );
        commands.push(commandBlock.opcode.slice(runtimePrefix.length));
        actionParent = actionId;
        actionId = action.next ?? undefined;
      }
      assert.deepEqual(
        commands,
        actions.map((action) => Object.keys(action)[0]!.split('.').at(-1)),
        `Scene ${sceneId} must contain every command in script order.`,
      );
    } else {
      assert.equal(block.opcode, `${authoringPrefix}property`);
    }
    parent = id;
    id = block.next;
  }
  assert.deepEqual(
    sceneIds,
    Object.keys(story.scenes ?? {}),
    'Every scene must be connected in order.',
  );
}
