/**
 * Curated subset of playwright-mcp's ~25 browser tools, scoped to what a
 * tester doing form-filling/navigation flows like ours actually needs.
 * Deliberately excludes: browser_run_code_unsafe and browser_evaluate
 * (arbitrary JS execution - more capability than this flow needs),
 * browser_network_request(s), browser_file_upload, browser_drag/drop,
 * browser_tabs, browser_resize, browser_console_messages,
 * browser_emulate_media (not needed for this flow, keep the surface
 * area lean rather than granting everything by default).
 *
 * browser_handle_dialog is included deliberately: assigning leave to a
 * zero-balance employee raises a confirmation dialog (see
 * docs/app-knowledge.md) that must be handled to complete the flow.
 */
export const PLAYWRIGHT_MCP_TOOLS = [
  'browser_navigate',
  'browser_navigate_back',
  'browser_snapshot',
  'browser_click',
  'browser_type',
  'browser_fill_form',
  'browser_press_key',
  'browser_select_option',
  'browser_hover',
  'browser_wait_for',
  'browser_handle_dialog',
  'browser_find',
  'browser_take_screenshot',
] as const;

export function withServerPrefix(serverName: string, toolNames: readonly string[]): string[] {
  return toolNames.map((name) => `mcp__${serverName}__${name}`);
}
