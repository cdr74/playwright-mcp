export function newRunId(prefix: string): string {
  return `${prefix}-${new Date().toISOString().replace(/[:.]/g, '-')}`;
}
