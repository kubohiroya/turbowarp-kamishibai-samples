// SPDX-License-Identifier: MPL-2.0
/** One board submission in the participant handout format. */
export interface Submission {
  nn: string;
  author?: string;
  name?: string;
  hint?: string;
  rejectedHint?: string;
  proposal?: string;
  refusal?: string;
  after?: string;
  moved: boolean;
  model?: string;
}

export const costumeNames: string[];
export function parseSubmission(text: string): Submission;
export function checkSubmission(submission: Submission): string[];
export function participantYaml(
  source: string,
  submission: Submission,
  options?: {pose?: string},
): {assets: string; actor: string; scene: string};
export function composeSlots(
  source: string,
  count: number,
  options: {modelUrl: string; modelUrls?: Record<string, string>; pose?: string},
): string;
export function composeParticipants(
  source: string,
  submissions: Submission[],
  options?: {pose?: string},
): string;
