import { test, expect } from '@playwright/test';

test.use({
  viewport: { width: 1900, height: 1200 },
});

// Build a yyyy-mm-dd string for "days" days from today.
function futureDateString(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// Fill a "yyyy-mm-dd" date-picker input reliably: plain .fill() gets the
// picker's internal state out of sync, so click, select-all, then type
// character-by-character and dismiss the popup.
async function setDatePickerValue(input: import('@playwright/test').Locator, page: import('@playwright/test').Page, value: string) {
  await input.click();
  await input.press('Control+A');
  await input.pressSequentially(value, { delay: 30 });
  await page.keyboard.press('Escape');
}

// Wait (without throwing) for a locator to become visible within a timeout.
// Locator.isVisible() checks the *current* state instantly and does not
// wait, so a plain isVisible() call right after an action is a race - use
// waitFor() instead when the element may appear asynchronously.
async function appears(locator: import('@playwright/test').Locator, timeout: number): Promise<boolean> {
  try {
    await locator.waitFor({ state: 'visible', timeout });
    return true;
  } catch {
    return false;
  }
}

test('add employee and assign leave', async ({ page }) => {
  const uniqueSuffix = Date.now().toString();
  const firstName = 'Thomas';
  const lastName = `Mueller${uniqueSuffix}`;

  // Land on the authenticated dashboard before navigating via the sidebar.
  await page.goto('/web/index.php/dashboard/index');

  // --- 1. Create a new employee via PIM ---
  await page.getByRole('link', { name: 'PIM' }).click();
  await page.getByRole('button', { name: 'Add' }).click();

  await page.getByRole('textbox', { name: 'First Name' }).fill(firstName);
  await page.getByRole('textbox', { name: 'Last Name' }).fill(lastName);

  await page.getByRole('button', { name: 'Save' }).click();

  // Save redirects to the employee's personal details page.
  await page.waitForURL(/pim\/viewPersonalDetails\/empNumber\/\d+/, { timeout: 15000 });
  await expect(page.getByRole('heading', { name: `${firstName} ${lastName}` })).toBeVisible();

  // --- 2. Assign that employee a leave request via Leave > Assign Leave ---
  await page.getByRole('link', { name: 'Leave' }).click();
  await page.getByRole('link', { name: 'Assign Leave' }).click();
  await expect(page).toHaveURL(/leave\/assignLeave/);

  const employeeInput = page.getByRole('textbox', { name: 'Type for hints...' });
  await employeeInput.click();
  await employeeInput.fill(firstName);
  await page
    .getByRole('option', { name: new RegExp(`${firstName}.*${lastName}`) })
    .first()
    .click();

  // Leave Type is a custom dropdown, not a native <select>. The listbox's
  // own first entry can just be the "-- Select --" placeholder re-rendered,
  // so explicitly pick a real option, not just the first one in the list.
  await page.getByText('-- Select --').first().click();
  await page
    .getByRole('listbox')
    .getByRole('option')
    .filter({ hasNotText: '-- Select --' })
    .first()
    .click();

  const fromDateInput = page.getByRole('textbox', { name: 'yyyy-mm-dd' }).first();
  const toDateInput = page.getByRole('textbox', { name: 'yyyy-mm-dd' }).nth(1);

  const leaveDate = futureDateString(7); // any single-day date in the future
  await setDatePickerValue(fromDateInput, page, leaveDate);
  await setDatePickerValue(toDateInput, page, leaveDate);

  await page.getByRole('button', { name: 'Assign' }).click();

  // A brand-new employee has no entitlement yet, so a confirmation dialog
  // ("Employee does not have sufficient leave balance...") may appear -
  // click through it if present.
  const confirmOkButton = page.getByRole('button', { name: 'Ok' });
  if (await appears(confirmOkButton, 8000)) {
    await confirmOkButton.click();
  }

  // --- 3. Verify the leave request was recorded ---
  // Primary success signal: the "Successfully Saved" toast.
  await expect(page.getByText('Successfully Saved')).toBeVisible({ timeout: 15000 });

  // Secondary, best-effort check: Leave List search. This is known to
  // sometimes not surface a just-assigned request (app quirk, see
  // docs/app-knowledge.md), so we don't fail the test on it - we just log
  // the outcome for diagnostic purposes.
  await page.getByRole('link', { name: 'Leave List', exact: true }).click().catch(() => {});
  const searchButton = page.getByRole('button', { name: 'Search' });
  if (await appears(searchButton, 5000)) {
    await searchButton.click();
    const rowFound = await appears(
      page.getByRole('row', { name: new RegExp(`${firstName}.*${lastName}`) }).first(),
      5000
    );
    if (!rowFound) {
      console.log('Leave List did not show the new request (known app quirk) - relying on the "Successfully Saved" toast as the source of truth.');
    }
  }
});
