/**
 * stories/*\/ 配下の設定ファイルとロックファイルの共有型。
 *
 * これらは JSON から読み込む動的な値だが、リポジトリ内で形が安定しているため
 * インターフェースとして固定し、ビルド/検証スクリプト間で共有する。
 * 将来フィールドが増えても壊れないよう、各インターフェースは索引シグネチャを持つ。
 */

import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';

import {appRuntimeIdentity, readAppRelease} from './app-dependency.ts';
import type {WorkEntry} from './works-catalog.ts';

export interface JsonRecord {
  [key: string]: unknown;
}

export interface PackagerOptionsConfig {
  target: string;
  autoplay: boolean;
  app: {windowTitle: string; [key: string]: unknown};
  cloudVariables: {mode: string; [key: string]: unknown};
  [key: string]: unknown;
}

export interface PackagerConfig {
  package: string;
  version: string;
  options: PackagerOptionsConfig;
}

export interface AudioUnlockConfig {
  enabled: boolean;
}

export interface OnlineDependency {
  urlPrefix: string;
  purpose: string;
}

export interface RuntimeCapability {
  capability: string;
  purpose: string;
}

/** Web packaging settings in sample.config.json. */
export interface WebConfig {
  enabled: boolean;
  inputProfile: string;
  outputDirectory: string;
  outputFilename: string;
  maxOutputBytes: number;
  scriptMode: string;
  assets: string;
  audioUnlock: AudioUnlockConfig;
  packager: PackagerConfig;
  allowedOnlineDependencies: OnlineDependency[];
  runtimeCapabilities: RuntimeCapability[];
  [key: string]: unknown;
}

export interface BuilderIdentity {
  package: string;
  version: string;
  source?: string;
  commit: string;
  [key: string]: unknown;
}

export interface BaseSb3Identity {
  path: string;
  profile: string;
  source: string;
  commit: string;
  size: number;
  sha256: string;
  [key: string]: unknown;
}

export interface StoryProfileConfig {
  outputName: string;
  script: string;
  assets: string;
  [key: string]: unknown;
}

/** stories/urashima/sample.config.json */
export interface StoryConfig {
  formatVersion: number;
  sample: string;
  builder: BuilderIdentity;
  baseSb3: BaseSb3Identity;
  sourceScript: string;
  assetManifest: string;
  artifactsLock: string;
  profiles: Record<string, StoryProfileConfig>;
  web: WebConfig;
  [key: string]: unknown;
}

export interface ScriptReplacement {
  description: string;
  from: string;
  to: string;
}

/** stories/my-urashima/sample.config.json */
export interface DerivedStoryConfig {
  formatVersion: number;
  sample: string;
  parentStory: {name: string; config: string};
  profile: StoryProfileConfig;
  projectAssets: {manifest: string; allowedRoots: string[]};
  scriptReplacements: ScriptReplacement[];
  artifactsLock: string;
  [key: string]: unknown;
}

export interface Dsl4Limits {
  maxSourceBytes: number;
  maxAssetFileBytes: number;
  maxAssetFiles: number;
  maxTotalAssetBytes: number;
}

export interface Dsl4RuntimeConfig extends JsonRecord {
  repository: string;
  version: string;
  commit: string;
  basePath: string;
  baseSourceIdentity: string;
  baseSize: number;
  baseSha256: string;
}

/** Story-specific DSL settings in sample.config.json; app pins are forbidden. */
export interface Dsl4StorySettings {
  formatVersion: number;
  status?: string;
  source?: string;
  starterSource?: string;
  sourceManifest?: string;
  starterManifest?: string;
  projectAssets: string;
  output: string;
  /** ブロック台本SB3。台本をTurboWarpの宣言ブロックとして持つauthoring成果物。 */
  blocksOutput?: string;
  artifactsLock?: string;
  publicSurfaces?: string;
  webArtifactsLock: string;
  archives?: Record<string, string>;
  limits?: Dsl4Limits;
  publication?: {enabled: boolean; reason?: string; issue: string};
  blockAuthoring?: {sourceSections?: boolean};
  web: WebConfig;
  work?: WorkEntry;
  [key: string]: unknown;
}

export interface Dsl4StoryConfig extends Dsl4StorySettings {
  runtime: Dsl4RuntimeConfig;
  version: string;
  releaseDependency: string;
}

export interface TutorialStoryConfig extends Dsl4StoryConfig {
  source: string;
  starterSource: string;
  blocksOutput: string;
  artifactsLock: string;
  publicSurfaces: string;
  archives: {starter: string; additionKit: string};
  publication: {enabled: boolean; reason: string; issue: string};
  work: WorkEntry & {thumbnail: NonNullable<WorkEntry['thumbnail']>};
}

export async function readTutorialStoryConfig(
  storyDirectory: string,
  root?: string,
): Promise<TutorialStoryConfig> {
  const config = await readDsl4StoryConfig(storyDirectory, root);
  for (const key of [
    'source',
    'starterSource',
    'blocksOutput',
    'artifactsLock',
    'publicSurfaces',
  ]) {
    assert(
      typeof config[key] === 'string',
      `Tutorial ${key} must be configured.`,
    );
  }
  assert(
    config.archives &&
      typeof config.archives.starter === 'string' &&
      typeof config.archives.additionKit === 'string',
  );
  assert(config.publication && typeof config.publication.enabled === 'boolean');
  assert(
    config.work && typeof config.work.id === 'string' && config.work.thumbnail,
    'Tutorial work must be configured.',
  );
  return config as TutorialStoryConfig;
}

/** Resolve app facts in memory, keeping checked-in story settings independent of releases. */
export async function readDsl4StoryConfig(
  storyDirectory: string,
  root = path.resolve(storyDirectory, '../..'),
): Promise<Dsl4StoryConfig> {
  const sample = JSON.parse(
    await readFile(path.join(storyDirectory, 'sample.config.json'), 'utf8'),
  );
  const settings = sample.dsl4 as Dsl4StorySettings;
  assert(
    settings && settings.formatVersion === 1,
    'sample.config.json must contain DSL 4.0 settings.',
  );
  for (const key of ['runtime', 'version', 'releaseDependency']) {
    assert(
      !Object.hasOwn(settings, key),
      `App dependency ${key} belongs only in app-release.json.`,
    );
  }
  if (settings.blockAuthoring) {
    assert(
      Object.keys(settings.blockAuthoring).every(
        (key) => key === 'sourceSections',
      ),
      'Independent authoring pins are forbidden; use app-release.json.',
    );
    assert(
      typeof (settings.blockAuthoring.sourceSections ?? false) === 'boolean',
    );
  }
  const release = await readAppRelease(root);
  return {
    ...settings,
    runtime: appRuntimeIdentity(release),
    version: release.version,
    releaseDependency: `https://github.com/${release.repository}/releases/tag/${release.tag}`,
    ...(settings.publication
      ? {
          publication: {
            enabled: settings.publication.enabled,
            reason: `TurboWarp-Kamishibai ${release.version} release artifacts are published and integrity-verified`,
            issue: settings.publication.issue,
          },
        }
      : {}),
  };
}

export interface ProjectAssetSpecification {
  kind: string;
  file: string;
  target?: string;
  name?: string;
  license?: string;
  [key: string]: unknown;
}

/** project-assets*.yml */
export interface ProjectAssetsManifest {
  formatVersion: number;
  assets: Record<string, ProjectAssetSpecification>;
  [key: string]: unknown;
}

export interface AssetManifestEntry {
  name: string;
  uri: string;
  [key: string]: unknown;
}

/** assets.lock.json */
export interface AssetManifest {
  assets: AssetManifestEntry[];
  [key: string]: unknown;
}

export interface DependencyRecord {
  path: string;
  size: number;
  sha256: string;
}

export interface ArtifactDigest {
  filename?: string;
  size: number;
  sha256: string;
  [key: string]: unknown;
}

export interface StoryDateLock {
  value: string;
  contentSha256: string;
}

/** artifacts.lock.json の profiles 配下 1 件。 */
export interface ProfileLock {
  outputName: string;
  sb3: {size: number; sha256: string};
  script: {size: number; sha256: string};
  manifest: {sha256: string};
}

export interface ArtifactsLock {
  formatVersion: number;
  builder?: Partial<BuilderIdentity>;
  storyDate?: StoryDateLock;
  profiles?: Record<string, ProfileLock>;
  /** 派生ストーリー (my-urashima) の単一成果物。 */
  output?: {outputName: string; [artifact: string]: ArtifactDigest | string};
  outputs?: Record<string, ArtifactDigest>;
  web?: {input?: unknown; output?: unknown; [key: string]: unknown};
  [key: string]: unknown;
}
