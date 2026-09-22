/**
 * Seed step: logs in once (via plain Playwright, not an agent) and saves
 * an authenticated storage state that both the MCP and CLI conditions
 * start from - so neither burns tokens on the login form itself, the same
 * way a real tester would already have a session going.
 *
 * Also ensures the Leave module's one-time org setup (Leave Period, one
 * Leave Type) exists - a completely fresh OrangeHRM install can't use
 * Leave at all otherwise. This is deterministic environment setup, not
 * part of the "add employee, assign leave" flow under test - see
 * docs/app-knowledge.md.
 *
 * Usage: tsx harness/src/seed.ts   (or: npm run seed)
 */
import 'dotenv/config';
import { chromium, type Page } from 'playwright';
import { mkdir } from 'node:fs/promises';
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
  await page.locator('input.oxd-input').nth(1).fill(name);
  await page.getByRole('button', { name: 'Save' }).click();
  await page.waitForTimeout(500);
  console.log(`==> Created leave type "${name}"`);
}

async function main(): Promise<void> {
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

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
