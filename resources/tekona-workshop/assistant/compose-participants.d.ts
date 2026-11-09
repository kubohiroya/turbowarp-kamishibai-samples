// SPDX-License-Identifier: MPL-2.0
/** One board submission in the participant handout format. */
export interface Submission {
  nn: string;
  author?: string;
  name?: string;
  hint?: string;
  proposal?: string;
  refusal?: string;
  after?: string;
  moved: boolean;
  model?: string;
}

export function parseSubmission(text: string): Submission;
export function checkSubmission(submission: Submission): string[];
export function participantYaml(
  source: string,
  submission: Submission,
  options?: {pose?: string},
): {assets: string; scene: string};
export function composeParticipants(
  source: string,
  submissions: Submission[],
  options?: {pose?: string},
): string;
