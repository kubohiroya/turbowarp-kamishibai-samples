import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';

import {strFromU8} from 'fflate';
import {parse} from 'yaml';

import sampleConfig from '../stories/urashima/sample.config.json' with {type: 'json'};

import {readBlockProjectExtensions} from './block-project-extensions.ts';
import {assertEmbeddedYamlBlockSource} from './migrate-embedded-yaml.ts';
import type {Dsl4Story} from './dsl4.ts';
import type {ScratchBlock, ScratchProject} from './scratch.ts';

const buildConfig = sampleConfig.dsl4;
const authoringPrefix = 'kubohiroyakamishibaiauthoring4_';
const definitionOpcodes = [
  'asset',
  'control',
  'actor',
  'textStyle',
  'variable',
  'cover',
  'loading',
  'recognition',
];
const configDefinitionOpcodes = definitionOpcodes.filter((opcode) => opcode !== 'actor');
const configSourceKeys = [
  'controls',
  'assets',
  'cover',
  'textStyles',
  'variables',
  'loading',
  'recognition',
];
const runtimePrefix = 'kubohiroyakamishibai4_kubohiroyakamishibairuntime4__';
const actionArguments = new Map([
  [`${runtimePrefix}pose`, 'STEPS'],
  [`${runtimePrefix}say`, 'SPEC'],
  [`${runtimePrefix}think`, 'SPEC'],
  [`${authoringPrefix}scene`, 'PROPERTIES'],
]);

/** Reject a YAML string masquerading as a block script, including disconnected actions. */
export function verifyStructuredBlockSource(
  project: ScratchProject,
  sourceText: string,
  archive?: Record<string, Uint8Array>,
): void {
  const stage = project.targets.find((target) => target.isStage);
  assert(stage, 'The block source project must keep its Stage.');
  assert(project.extensions?.includes('kubohiroyakamishibaiauthoring4'));
  const authoring = readBlockProjectExtensions(project, archive).get('kubohiroyakamishibaiauthoring4');
  assert(authoring, 'The block source project must carry its authoring extension.');
  const extensionInfo: {
    blocks?: {
      opcode: string;
      blockType?: string;
      branchCount?: number;
      hideFromPalette?: boolean;
    }[];
    menus?: Record<string, {acceptReporters?: boolean; items: {text: string; value: string}[]}>;
  }[] = [];
  const editors: {opcodes: string[]; argument: string; schema: object}[] = [];
  runInNewContext(
    strFromU8(authoring.bytes),
    {
      Scratch: {
        extensions: {
          register(extension: {getInfo?: () => (typeof extensionInfo)[number]}) {
            if (extension.getInfo) extensionInfo.push(extension.getInfo());
          },
        },
        gui: {
          blockEditors: {
            apiVersion: 1,
            registerSchema(editor: (typeof editors)[number]) {
              editors.push(editor);
              return () => {};
            },
          },
        },
      },
    },
    {timeout: 2000},
  );
  const narrativeEnabled = extensionInfo.some((entry) =>
    entry.blocks?.some(
      (block) => block.opcode === 'narrativeForEach' && block.hideFromPalette === false,
    ),
  );
  const expectedArguments = new Map(actionArguments);
  if (narrativeEnabled) {
    expectedArguments.set(authoringPrefix + 'narrativeForEach', 'ITEMS');
    expectedArguments.set(authoringPrefix + 'narrativeLogicList', 'VALUES');
  }
  assert.deepEqual(
    editors.flatMap((editor) => Array.from(editor.opcodes)).sort(),
    [
      ...definitionOpcodes.map((opcode) => authoringPrefix + opcode),
      ...expectedArguments.keys(),
    ].sort(),
    'The embedded authoring extension must register all eight definition forms and the scene/pose/say/think forms.',
  );
  assert(
    editors.every(
      (editor) =>
        editor.opcodes.every(
          (opcode) => editor.argument === (expectedArguments.get(opcode) ?? 'VALUE'),
        ) && typeof editor.schema === 'object',
    ),
    'Definition forms must edit VALUE, scene must edit PROPERTIES, pose must edit STEPS, and say/think must edit SPEC',
  );

  const info = extensionInfo.find((entry) =>
    entry.blocks?.some((block) => block.opcode === 'useSection'),
  );
  const section = info?.blocks?.find((block) => block.opcode === 'useSection');
  assert(
    section && section.hideFromPalette === !(buildConfig.blockAuthoring.sourceSections ?? false),
    'Source section palette visibility must match the build configuration.',
  );
  assert.equal(section.blockType, 'command');
  assert.equal(section.branchCount, 1);
  assert.equal(info?.menus?.sectionEnabled?.acceptReporters, false);
  assert.deepEqual(
    Array.from(info!.menus!.sectionEnabled!.items, (item) => String(item.value)),
    ['on', 'off'],
  );

  const blocks = stage.blocks;
  for (const target of project.targets) {
    for (const block of Object.values(target.blocks)) {
      assert(
        !/(?:whenDsl4Source|dsl4SourceFromYamlJson)$/.test(block.opcode),
        'A block script must not contain the retired YAML string declaration.',
      );
    }
  }
  const explicitRoot = Object.values(blocks).find(
    (block) => block.opcode === `${runtimePrefix}embeddedYamlRoot`,
  );
  if (explicitRoot) assertEmbeddedYamlBlockSource(project);
  const hats = Object.entries(blocks).filter(([, block]) =>
    explicitRoot
      ? block.opcode === `${runtimePrefix}embeddedYaml` &&
        block.fields?.DOCUMENT?.[0] === explicitRoot.fields?.DOCUMENT?.[0]
      : block.opcode === `${authoringPrefix}kamishibai` && block.topLevel === true,
  );
  assert.equal(hats.length, 1, 'The story must have one root script hat.');
  const [hatId, hat] = hats[0]!;
  if (!explicitRoot) {
    assert.deepEqual(hat.inputs?.VERSION, [1, [10, '4.0']]);
    assert.deepEqual(hat.inputs?.LABEL, [1, [10, '']], 'The Stage root script name must be empty.');
  }
  const story = parse(sourceText, {uniqueKeys: true}) as Dsl4Story;
  const configHats = Object.entries(blocks).filter(
    ([, block]) => block.opcode === `${authoringPrefix}kamishibaiConfig`,
  );
  const usesConfigHat = !explicitRoot && (info?.blocks?.some((block) => block.opcode === 'kamishibaiConfig') ?? false);
  if (usesConfigHat) {
    assert.equal(
      configHats.length,
      configSourceKeys.some((key) => Object.hasOwn(story, key)) ? 1 : 0,
      'The generated story must connect its configuration to one config hat.',
    );
  }
  for (const [, config] of configHats) {
    assert(usesConfigHat, 'The embedded extension must declare kamishibaiConfig.');
    assert.equal(config.topLevel, true);
    assert.equal(config.parent, null);
    assert.deepEqual(
      config.inputs?.LABEL,
      [1, [10, '']],
      'The generated root config name must be empty.',
    );
  }
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

  function declarations(parent: string, id: string | null | undefined, config = false) {
    while (id) {
      const block = connected(id, parent);
      if (block.opcode === runtimePrefix + 'embeddedYamlInclude' ||
          block.opcode === authoringPrefix + 'includeBlocks') {
        assert(!config, 'Includes must stay in a story document.');
        const [moduleId, module] = Object.entries(blocks).find(([, candidate]) =>
          explicitRoot
            ? candidate.opcode === runtimePrefix + 'embeddedYaml' &&
              candidate.fields?.DOCUMENT?.[0] === block.fields?.DOCUMENT?.[0]
            : candidate.opcode === authoringPrefix + 'kamishibai' &&
              candidate.inputs?.LABEL?.[1]?.[1] === block.inputs?.LABEL?.[1]?.[1],
        ) ?? [];
        assert(moduleId && module?.topLevel && module.parent === null, 'The include must name a document.');
        assert(!visited.has(moduleId), 'Each scene document must be included once.');
        visited.add(moduleId);
        declarations(moduleId, module.next);
      } else if (block.opcode === `${authoringPrefix}scene`) {
        assert(!config, 'Scenes must stay under the root script hat.');
        const sceneId = block.inputs?.SCENE?.[1]?.[1] as string;
        sceneIds.push(sceneId);
        const sourceScene = story.scenes?.[sceneId];
        assert(sourceScene, `Unexpected scene ${sceneId}.`);
        const actions = (
          Array.isArray(sourceScene)
            ? sourceScene
            : (sourceScene as {actions: Record<string, unknown>[]}).actions
        ) as Record<string, unknown>[];
        const inspectInputs = (block: ScratchBlock, owner: string) => {
          for (const [name, input] of Object.entries(block.inputs ?? {})) {
            if (name.startsWith('SUBSTACK')) continue;
            for (const value of input.slice(1)) {
              if (typeof value !== 'string') continue;
              const reporter = connected(value, owner);
              assert(
                reporter.opcode.startsWith(authoringPrefix + 'narrative') ||
                  reporter.opcode.startsWith(
                    'kubohiroyakamishibai4_menu_kubohiroyakamishibairuntime4__',
                  ),
                `Unexpected reporter ${reporter.opcode}.`,
              );
              inspectInputs(reporter, value);
            }
          }
        };
        const inspectActions = (
          expected: Record<string, unknown>[],
          owner: string,
          actionId: string | undefined,
        ) => {
          for (const sourceAction of expected) {
            assert(actionId, `Scene ${sceneId} must contain every command in script order.`);
            const action = connected(actionId, owner);
            const command = Object.keys(sourceAction)[0]!;
            const narrative = (
              {
                if: 'narrativeIf',
                repeat: 'narrativeRepeat',
                forEach: 'narrativeForEach',
              } as Record<string, string>
            )[command];
            if (narrative) {
              assert(
                narrativeEnabled,
                'Narrative controls must be available in the embedded runtime.',
              );
              assert.equal(action.opcode, authoringPrefix + narrative);
              const structure = sourceAction[command] as Record<string, unknown>;
              inspectActions(
                (structure[command === 'if' ? 'then' : 'do'] ?? []) as Record<string, unknown>[],
                actionId,
                action.inputs?.SUBSTACK?.[1] as string | undefined,
              );
              if (command === 'if')
                inspectActions(
                  (structure.else ?? []) as Record<string, unknown>[],
                  actionId,
                  action.inputs?.SUBSTACK2?.[1] as string | undefined,
                );
              inspectInputs(action, actionId);
            } else {
              let commandBlock = action;
              let commandId = actionId;
              if (action.opcode === authoringPrefix + 'actionOptions') {
                commandId = action.inputs?.SUBSTACK?.[1] as string;
                commandBlock = connected(commandId, actionId);
                assert.equal(commandBlock.next, null, 'Action options must wrap one command.');
              }
              const suffix = command.split('.').at(-1)!;
              if (
                ['say', 'think'].includes(suffix) &&
                commandBlock.opcode === runtimePrefix + suffix + 'Text'
              ) {
                const spec = sourceAction[command] as Record<string, unknown>;
                assert.deepEqual(
                  Object.keys(spec).sort(),
                  ['seconds', 'text'],
                  'Advanced speech must retain SPEC.',
                );
                assert.equal(commandBlock.inputs?.TEXT?.[1]?.[1], spec.text);
                assert.equal(
                  Number(commandBlock.inputs?.SECONDS?.[1]?.[1]),
                  spec.seconds,
                );
                assert.equal(
                  commandBlock.inputs?.TARGET?.[1]?.[1],
                  command.slice(0, -(suffix.length + 1)),
                );
              } else if (
                suffix === 'pose' &&
                commandBlock.opcode === authoringPrefix + 'poseSteps'
              ) {
                assert.equal(
                  commandBlock.inputs?.TARGET?.[1]?.[1],
                  command.slice(0, -(suffix.length + 1)),
                );
                const {steps} = sourceAction[command] as {
                  steps: {pose: string; skin?: string; sound?: string}[];
                };
                let stepParent = commandId;
                let stepId = commandBlock.inputs?.SUBSTACK?.[1] as string | undefined;
                for (const step of steps) {
                  assert(stepId, `Pose steps in scene ${sceneId} must contain every step.`);
                  const stepBlock = connected(stepId, stepParent);
                  assert.equal(stepBlock.opcode, authoringPrefix + 'poseStep');
                  assert.deepEqual(
                    ['POSE', 'SKIN', 'SOUND'].map((name) => stepBlock.inputs?.[name]?.[1]?.[1]),
                    [step.pose, step.skin ?? '', step.sound ?? ''],
                    `Pose steps in scene ${sceneId} must keep their pose, skin and sound.`,
                  );
                  inspectInputs(stepBlock, stepId);
                  stepParent = stepId;
                  stepId = stepBlock.next ?? undefined;
                }
                assert.equal(stepId, undefined, `Pose steps in scene ${sceneId} must not gain steps.`);
              } else {
                assert.equal(
                  commandBlock.opcode,
                  runtimePrefix + suffix,
                  `Scene ${sceneId} must contain every command in script order.`,
                );
              }
              inspectInputs(commandBlock, commandId);
            }
            owner = actionId;
            actionId = action.next ?? undefined;
          }
          assert.equal(actionId, undefined, `Scene ${sceneId} must not contain extra commands.`);
        };
        inspectActions(actions, id, block.inputs?.SUBSTACK?.[1] as string | undefined);
      } else {
        assert(
          [
            `${authoringPrefix}property`,
            ...definitionOpcodes.map((opcode) => authoringPrefix + opcode),
          ].includes(block.opcode),
          `Unexpected top-level declaration: ${block.opcode}`,
        );
        const dedicatedConfig = configDefinitionOpcodes.some(
          (opcode) => block.opcode === authoringPrefix + opcode,
        );
        const propertyConfig =
          block.opcode === `${authoringPrefix}property` &&
          configSourceKeys.includes(JSON.parse(block.inputs?.PATH?.[1]?.[1] ?? 'null')?.[0]);
        if (config) {
          assert(
            dedicatedConfig || propertyConfig,
            'Config hats must contain configuration definitions.',
          );
        } else if (usesConfigHat) {
          assert(
            !dedicatedConfig && !propertyConfig,
            'Configuration definitions must stay under kamishibaiConfig.',
          );
        }
      }
      parent = id;
      id = block.next;
    }
  }
  for (const [id, config] of configHats) {
    visited.add(id);
    declarations(id, config.next, true);
  }
  declarations(hatId, hat.next);
  for (const [id, block] of Object.entries(blocks)) {
    if (configDefinitionOpcodes.some((opcode) => block.opcode === authoringPrefix + opcode)) {
      assert(visited.has(id), `Configuration definition ${id} must stay connected.`);
    }
  }
  assert.deepEqual(
    sceneIds,
    Object.keys(story.scenes ?? {}),
    'Every scene must be connected in order.',
  );
}
