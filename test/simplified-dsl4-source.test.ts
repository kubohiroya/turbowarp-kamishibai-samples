import assert from "node:assert/strict";
import { test } from "vitest";
import {
  dsl4ExecutableValue,
  simplifyDsl4Source,
} from "../scripts/simplify-dsl4-source.ts";

test("compares referenced asset content independently from generated IDs without rewriting literal text or actor IDs", () => {
  const story = (id: string, text = "Hero", target = "Hero") => ({
    assets: { [id]: { id, kind: "costume", target: "Hero", name: "Idle" } },
    actors: { Hero: id },
    scenes: [
      {
        id: "Hero",
        actions: [
          { target, command: "show", args: { skin: id } },
          { target, command: "say", args: { text, seconds: 1 } },
        ],
      },
    ],
  });
  assert.equal(
    dsl4ExecutableValue(story("Hero")),
    dsl4ExecutableValue(story("@project/costume/Hero/Idle")),
  );
  assert.notEqual(
    dsl4ExecutableValue(story("Hero")),
    dsl4ExecutableValue(story("Hero", "Other")),
  );
  assert.notEqual(
    dsl4ExecutableValue(story("Hero")),
    dsl4ExecutableValue(story("Hero", "Hero", "Other")),
  );
});

test("omits only equivalent defaults, retains unsupported declarations, and leaves the input intact", () => {
  const input = {
    kamishibai: "4.0",
    actors: { Hero: "File" },
    assets: {
      File: { kind: "costume", target: "Hero", file: "hero.svg" },
      Remote: {
        kind: "sound",
        source: { url: "https://example.com/sound.wav" },
      },
    },
    variables: { startSceneIndex: 1, score: 2 },
    cover: { backdrop: "Chosen" },
    scenes: { opening: [] },
  };
  const original = structuredClone(input);
  const result = simplifyDsl4Source(input, {
    references: () => ({ references: [], uncertain: [] }),
    normalize: (source) => {
      assert(source.actors, "explicit actor required");
      assert(source.cover, "explicit cover required");
      return {
        ...source,
        variables: {
          startSceneIndex: 1,
          ...(source.variables as Record<string, unknown>),
        },
      };
    },
  });
  assert.deepEqual(input, original);
  assert.deepEqual(result.removed, [
    { namespace: "variables", name: "startSceneIndex" },
  ]);
  assert.deepEqual(result.source.assets, input.assets);
  assert.equal(result.retained.length, 2);
});
