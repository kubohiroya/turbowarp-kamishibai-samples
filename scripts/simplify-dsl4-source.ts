import assert from "node:assert/strict";

export type RecordValue = Record<string, unknown>;
export type DefinitionPath = (string | number)[];
export interface SourceReferences {
  references: { namespace: string; name: string; path: DefinitionPath }[];
  uncertain: { namespaces: string[]; path: DefinitionPath; reason: string }[];
}
export const record = (value: unknown): RecordValue =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as RecordValue)
    : {};
const canonical = (value: unknown): unknown =>
  Array.isArray(value)
    ? value.map(canonical)
    : value !== null && typeof value === "object"
      ? Object.fromEntries(
          Object.entries(value)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, child]) => [key, canonical(child)]),
        )
      : value;

/** Compare executable values while ignoring source positions and unused declaration IDs. */
export function dsl4ExecutableValue(story: RecordValue): string {
  const assets = record(story.assets);
  const assetFields = new Set([
    "asset",
    "backdrop",
    "bgm",
    "skin",
    "sound",
    "recognitionModel",
    "finish",
    "reveal",
    "voice",
    "frames",
    "base",
    "characterSound",
    "buttonAsset",
    "showMirrored",
    "showUnmirrored",
    "chargeSound",
    "idleSound",
    "startSound",
    "costumes",
  ]);
  function walk(value: unknown, field = "", parent = ""): unknown {
    if (
      typeof value === "string" &&
      (assetFields.has(field) || parent === "actors") &&
      Object.hasOwn(assets, value)
    ) {
      const { id: _id, ...asset } = record(assets[value]);
      return { $asset: asset };
    }
    if (Array.isArray(value))
      return value.map((child) => walk(child, field, parent));
    if (value !== null && typeof value === "object")
      return Object.fromEntries(
        Object.entries(value)
          .filter(
            ([key]) =>
              ![
                "sourceRange",
                "sourceMap",
                "sourceOrigins",
                "metadata",
              ].includes(key),
          )
          .map(([key, child]) => [key, walk(child, key, field)]),
      );
    return value;
  }
  const { assets: _assets, ...body } = story;
  return JSON.stringify(canonical(walk(body)));
}

function at(root: unknown, path: DefinitionPath): unknown {
  return path.reduce<unknown>(
    (value, part) =>
      value !== null && typeof value === "object"
        ? (value as Record<string | number, unknown>)[part]
        : undefined,
    root,
  );
}
function setAt(root: RecordValue, path: DefinitionPath, value: unknown) {
  const parent = path
    .slice(0, -1)
    .reduce<unknown>(
      (value, part) => (value as Record<string | number, unknown>)[part],
      root,
    ) as Record<string | number, unknown>;
  parent[path.at(-1)!] = value;
}

/** Omit a declaration only when the production frontend proves the same executable values. */
export function simplifyDsl4Source(
  input: RecordValue,
  options: {
    normalize(source: RecordValue): RecordValue;
    references(source: RecordValue): SourceReferences;
  },
) {
  let source = structuredClone(input);
  const baseline = dsl4ExecutableValue(options.normalize(source));
  const removed: { namespace: string; name: string }[] = [];
  const retained: { namespace: string; name: string; reason: string }[] = [];
  function attempt(
    namespace: string,
    name: string,
    mutate: (copy: RecordValue) => void,
  ) {
    const next = structuredClone(source);
    mutate(next);
    try {
      if (dsl4ExecutableValue(options.normalize(next)) !== baseline)
        throw new Error("実行値・素材・初期状態が変わるため保持");
      source = next;
      removed.push({ namespace, name });
    } catch (error) {
      retained.push({
        namespace,
        name,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }
  const initialReferences = options.references(source);
  const protectedNamespace = (namespace: string) =>
    initialReferences.uncertain.some((issue) => {
      const value = record(at(source, issue.path));
      // The schema's scalar setSkin alternative also visits valid long-form objects.
      const scalarAlternative =
        typeof issue.path.at(-1) === "string" &&
        String(issue.path.at(-1)).endsWith(".setSkin") &&
        typeof value.skin === "string";
      return issue.namespaces.includes(namespace) && !scalarAlternative;
    });
  for (const [id, raw] of Object.entries(record(source.assets))) {
    const asset =
      typeof raw === "string"
        ? { kind: raw.split(":")[0], name: id }
        : record(raw);
    if (
      !["backdrop", "costume", "sound"].includes(String(asset.kind)) ||
      asset.file !== undefined ||
      asset.source !== undefined ||
      protectedNamespace("assets")
    )
      continue;
    const name = typeof asset.name === "string" ? asset.name : id;
    attempt("assets", id, (copy) => {
      const references = options
        .references(copy)
        .references.filter(
          (ref) => ref.namespace === "assets" && ref.name === id,
        );
      for (const reference of references) setAt(copy, reference.path, name);
      delete record(copy.assets)[id];
      if (!Object.keys(record(copy.assets)).length) delete copy.assets;
    });
  }
  if (!protectedNamespace("actors"))
    for (const actor of Object.keys(record(source.actors))) {
      attempt("actors", actor, (copy) => {
        delete record(copy.actors)[actor];
        if (!Object.keys(record(copy.actors)).length) delete copy.actors;
      });
    }
  if (source.cover !== undefined)
    attempt("cover", "cover", (copy) => {
      delete copy.cover;
    });
  if (record(source.variables).startSceneIndex === 1)
    attempt("variables", "startSceneIndex", (copy) => {
      delete record(copy.variables).startSceneIndex;
      if (!Object.keys(record(copy.variables)).length) delete copy.variables;
    });
  assert.equal(dsl4ExecutableValue(options.normalize(source)), baseline);
  return { source, removed, retained };
}
