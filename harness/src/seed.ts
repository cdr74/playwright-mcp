/**
 * Seed step: logs in (via plain Playwright, not an agent) and saves an
 * authenticated storage state that both the MCP and Codegen conditions start
 * from - so neither burns tokens on the login form itself, the same way a
 * real tester would already have a session going.
 *
 * Also ensures the Leave module's one-time org setup (Leave Period, one
 * Leave Type) exists - a completely fresh OrangeHRM install can't use
 * Leave at all otherwise. This is deterministic environment setup, not
 * part of the "add employee, assign leave" flow under test - see
 * docs/app-knowledge.md.
 *
 * Exported as `seed()` so every run script (explore-mcp.ts,
 * generate-mcp.ts, run-codegen.ts) can call it unconditionally as its first
 * step - the saved session can expire between runs (confirmed for real,
 * see TODO.md Gotchas), and re-seeding is cheap, deterministic, and
 * already off the measured token budget either way, so there's no reason
 * to make freshness the operator's problem. Still runnable standalone:
 * `tsx harness/src/seed.ts` (or `npm run seed`) - useful for warming
 * state without spinning up Claude Code, e.g. right after
 * `setup:app`/`cleanup:app`, or per docs/verify-setup.md.
 */
import 'dotenv/config';
import { chromium, type Page } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const BASE_URL = process.env.TARGET_APP_URL ?? 'http://localhost:8081/';
const ADMIN_USER = process.env.OHRM_ADMIN_USER ?? 'Admin';
const ADMIN_PASSWORD = process.env.OHRM_ADMIN_PASSWORD;
const LEAVE_TYPE_NAME = 'Annual Leave';
const AUTH_STATE_PATH = path.resolve('harness/.auth/state.json');

if (!ADMIN_PASSWORD) {
  console.error('OHRM_ADMIN_PASSWORD is not set. Copy .env.example to .env first (see README.md).');
  process.exit(1);
}

function url(pathname: string): string {
  return new URL(pathname, BASE_URL).toString();
}

async function login(page: Page): Promise<void> {
  console.log(`==> Logging in to ${BASE_URL} as ${ADMIN_USER}`);
  await page.goto(url('web/index.php/auth/login'));
  await page.getByPlaceholder('Username').fill(ADMIN_USER!);
  await page.getByPlaceholder('Password').fill(ADMIN_PASSWORD!);
  await page.getByRole('button', { name: 'Login' }).click();
  await page.waitForURL('**/dashboard/index');
}

async function ensureLeavePeriodDefined(page: Page): Promise<void> {
  await page.goto(url('web/index.php/leave/defineLeavePeriod'));
  await page.waitForTimeout(500);
  const saveButton = page.getByRole('button', { name: 'Save' });
  if (!(await saveButton.isVisible().catch(() => false))) {
    console.log('==> Leave period page did not show a Save button, skipping (already handled?)');
    return;
  }
  // Idempotent: re-saving an already-defined period with its own current
  // values is a harmless no-op.
  await saveButton.click();
  await page.waitForTimeout(500);
  console.log('==> Leave period ensured');
}

async function ensureLeaveTypeExists(page: Page, name: string): Promise<void> {
  await page.goto(url('web/index.php/leave/leaveTypeList'));
  await page.waitForTimeout(500);
  const alreadyExists = await page.getByText(name, { exact: true }).isVisible().catch(() => false);
  if (alreadyExists) {
    console.log(`==> Leave type "${name}" already exists`);
    return;
  }
  await page.getByRole('button', { name: 'Add' }).click();
  await page.waitForURL('**/leave/defineLeaveType');
  // index 0 is the page-level header search box, index 1 is this form's Name field
  const nameInput = page.locator('input.oxd-input').nth(1);
  await nameInput.fill(name);
  // Clicking Save immediately after fill() races the SPA's form-state
  // update: confirmed by direct network inspection that the click then
  // fires *no* POST request at all - it silently no-ops, no error, no
  // toast, and this function used to log "Created" regardless because it
  // only waited a fixed timeout rather than checking anything actually
  // happened. Blurring the field first lets the model update settle.
  await nameInput.blur();
  await page.waitForTimeout(300);
  const [response] = await Promise.all([
    page.waitForResponse(
      (res) => res.url().includes('/api/v2/leave/leave-types') && res.request().method() === 'POST',
      { timeout: 10_000 },
    ),
    page.getByRole('button', { name: 'Save' }).click(),
  ]);
  if (!response.ok()) {
    throw new Error(`Failed to create leave type "${name}": ${response.status()} ${await response.text()}`);
  }
  console.log(`==> Created leave type "${name}"`);
}

export async function seed(): Promise<void> {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  await login(page);
  await ensureLeavePeriodDefined(page);
  await ensureLeaveTypeExists(page, LEAVE_TYPE_NAME);

  await mkdir(path.dirname(AUTH_STATE_PATH), { recursive: true });
  await page.context().storageState({ path: AUTH_STATE_PATH });
  console.log(`==> Saved authenticated storage state to ${AUTH_STATE_PATH}`);

  await browser.close();
}

// Run directly (`tsx harness/src/seed.ts` / `npm run seed`) vs. imported
// by another run script - only invoke automatically in the former case.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  seed().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
