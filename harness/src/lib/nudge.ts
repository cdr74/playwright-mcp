/**
 * The testing best-practices guidance nudged runs get (NUDGE_QUALITY=1),
 * versioned like the app-knowledge primer: every version is a frozen file
 * under docs/testing-best-practices/, fed to the agent verbatim, and every
 * nudged run records which one it used. v1 is what the first nudged batch
 * saw, including an intro describing the benchmark itself; v2 is the
 * agent-facing guidance only (docs/testing-best-practices/README.md).
 */
import { readFile } from 'node:fs/promises';

export const NUDGE_VERSIONS = ['v1', 'v2'] as const;
export type NudgeVersion = (typeof NUDGE_VERSIONS)[number];
export const DEFAULT_NUDGE: NudgeVersion = 'v2';

export async function loadNudge(): Promise<{ version: NudgeVersion; text: string }> {
  const requested = process.env.NUDGE ?? DEFAULT_NUDGE;
  if (!(NUDGE_VERSIONS as readonly string[]).includes(requested)) {
    throw new Error(`Unknown NUDGE "${requested}" - expected one of: ${NUDGE_VERSIONS.join(', ')}`);
  }
  const version = requested as NudgeVersion;
  return { version, text: await readFile(`docs/testing-best-practices/${version}.md`, 'utf-8') };
}
