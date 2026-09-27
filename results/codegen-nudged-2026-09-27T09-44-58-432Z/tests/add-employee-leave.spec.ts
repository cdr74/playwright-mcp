import { test, expect, Page, Locator } from '@playwright/test';

function formatDate(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// Leave assignment requires a future weekday - per app notes, weekends have
// no working days and requests covering only a weekend are rejected.
function getFutureWeekday(daysAhead: number): Date {
  const date = new Date();
  date.setDate(date.getDate() + daysAhead);
  while (date.getDay() === 0 || date.getDay() === 6) {
    date.setDate(date.getDate() + 1);
  }
  return date;
}

// The OrangeHRM date pickers are fiddly custom widgets. Per app notes,
// typing the value directly (yyyy-mm-dd) is more reliable than clicking
// calendar days, but the popup calendar that appears on focus can still
// intercept later clicks, so we dismiss it with Escape afterwards.
async function setDateField(page: Page, locator: Locator, dateStr: string) {
  await locator.click();
  await locator.fill(dateStr);
  await page.keyboard.press('Escape');
}

test('assign leave to a newly created employee', async ({ page }) => {
  const uniqueId = Date.now();
  const firstName = `Thomas${uniqueId}`;
  const lastName = `Mueller${uniqueId}`;
  // The employee record has no middle name, so OrangeHRM renders the full
  // name with a double space between first and last name - match loosely
  // rather than hardcoding that formatting quirk.
  const fullNamePattern = new RegExp(`${firstName}\\s+${lastName}`);

  // Land on the authenticated dashboard - the session is already logged in.
  await page.goto('/web/index.php/dashboard/index');
  await expect(page.getByRole('link', { name: 'PIM' })).toBeVisible({ timeout: 15000 });

  // 1. Create employee via PIM
  await page.getByRole('link', { name: 'PIM' }).click();
  await expect(page.getByRole('heading', { name: 'Employee Information' })).toBeVisible();

  await page.getByRole('button', { name: ' Add' }).click();
  await expect(page.getByRole('heading', { name: 'Add Employee' })).toBeVisible();

  await page.getByRole('textbox', { name: 'First Name' }).fill(firstName);
  await page.getByRole('textbox', { name: 'Last Name' }).fill(lastName);
  await page.getByRole('button', { name: 'Save' }).click();

  // Saving navigates to the employee's Personal Details page - that
  // navigation, plus the prefilled name fields, confirms creation.
  await expect(page.getByRole('heading', { name: 'Personal Details' })).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole('textbox', { name: 'First Name' })).toHaveValue(firstName);
  await expect(page.getByRole('textbox', { name: 'Last Name' })).toHaveValue(lastName);

  // 2. Assign leave via Leave -> Assign Leave (the administrative flow -
  // "Apply" only files leave for the logged-in user).
  await page.getByRole('link', { name: 'Leave' }).click();
  await page.getByRole('link', { name: 'Assign Leave' }).click();
  await expect(page.getByRole('heading', { name: 'Assign Leave' })).toBeVisible();

  const employeeInput = page.getByPlaceholder('Type for hints...');
  await employeeInput.fill(firstName);
  // The autocomplete widget's suggestions are custom divs with no
  // accessible role, so we target the visible suggestion by its text.
  const suggestion = page.locator('.oxd-autocomplete-option', { hasText: firstName });
  await expect(suggestion).toBeVisible({ timeout: 10000 });
  await suggestion.click();
  await expect(employeeInput).toHaveValue(fullNamePattern);

  // Leave Type dropdown (custom widget, not a native <select>)
  await page.locator('.oxd-select-text').first().click();
  await page.getByRole('option', { name: 'Annual Leave' }).click();
  await expect(page.locator('.oxd-select-text').first()).toHaveText('Annual Leave');

  const leaveDate = formatDate(getFutureWeekday(7));
  const dateInputs = page.getByPlaceholder('yyyy-mm-dd');
  await setDateField(page, dateInputs.nth(0), leaveDate);
  await setDateField(page, dateInputs.nth(1), leaveDate);
  await expect(dateInputs.nth(0)).toHaveValue(leaveDate);
  await expect(dateInputs.nth(1)).toHaveValue(leaveDate);

  // Once dates are set, remaining dropdowns (e.g. Duration) may still show
  // their unselected "-- Select --" placeholder and need an explicit
  // choice before the form can be submitted. We don't hardcode how many
  // there are - resolve whatever is left by picking each one's first
  // option, generically.
  const unselectedDropdowns = page.locator('.oxd-select-text', { hasText: '-- Select --' });
  while (await unselectedDropdowns.count() > 0) {
    await unselectedDropdowns.first().click();
    await page.locator('.oxd-select-option').first().click();
  }

  await page.getByRole('button', { name: 'Assign' }).click();

  // New employees have no leave balance, so a confirmation dialog about
  // insufficient balance is expected here and must be OK'd. The app
  // computes the balance check asynchronously after the click, so we poll
  // for the dialog rather than checking immediately. It's not strictly
  // guaranteed (balance rules could differ), so its absence isn't treated
  // as fatal - we log why we're proceeding without it instead of silently
  // ignoring an unusual case.
  const okButton = page.getByRole('button', { name: 'Ok' });
  try {
    await okButton.waitFor({ state: 'visible', timeout: 10000 });
    await okButton.click();
  } catch {
    console.log(
      'No insufficient-balance confirmation dialog appeared after clicking Assign - ' +
      'continuing, since this dialog is only expected when the employee lacks leave balance ' +
      '(a brand new employee should always lack one, so this is worth investigating if seen).'
    );
  }

  // 3. Verify the leave request was recorded. Per app notes, the Leave
  // List search is unreliable on this build, so the toast notification is
  // the reliable signal - capture its exact text so a future failure here
  // shows what actually happened (e.g. a validation error) instead of just
  // "toast not found".
  const toast = page.locator('.oxd-toast');
  await expect(toast).toBeVisible({ timeout: 15000 });
  const toastText = (await toast.first().textContent()) ?? '';
  console.log(`Toast shown after Assign: "${toastText}"`);
  expect(toastText).toContain('Successfully Saved');
});
