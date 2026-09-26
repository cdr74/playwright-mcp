/**
 * The app-knowledge primer both conditions get is an explicit experimental
 * variable, not fixed setup (CLAUDE.md decision 14): moving from v1 to v2
 * changed results more than anything else measured. v1/v2 were
 * harness-development primers; v3 is the realistic "tester's notes"
 * baseline and the default (CLAUDE.md decision 16). Every version is a
 * frozen file under docs/app-knowledge/ - never edit a published version,
 * add a new one - and every run records which one it used.
 */
import { readFile } from 'node:fs/promises';

export const PRIMER_VERSIONS = ['v1', 'v2', 'v3'] as const;
export type PrimerVersion = (typeof PRIMER_VERSIONS)[number];
export const DEFAULT_PRIMER: PrimerVersion = 'v3';

export async function loadPrimer(): Promise<{ version: PrimerVersion; text: string }> {
  const requested = process.env.PRIMER ?? DEFAULT_PRIMER;
  if (!(PRIMER_VERSIONS as readonly string[]).includes(requested)) {
    throw new Error(`Unknown PRIMER "${requested}" - expected one of: ${PRIMER_VERSIONS.join(', ')}`);
  }
  const version = requested as PrimerVersion;
  return { version, text: await readFile(`docs/app-knowledge/${version}.md`, 'utf-8') };
}
