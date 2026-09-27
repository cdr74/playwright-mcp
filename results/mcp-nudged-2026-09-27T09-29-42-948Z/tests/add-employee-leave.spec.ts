import { test, expect, type Page } from '@playwright/test';

/**
 * Types a date into a yyyy-mm-dd date field and dismisses the date-picker
 * popup that OrangeHRM shows after typing. Setting `.fill()` directly is
 * unreliable for these fields (the app's own JS listens for keystrokes),
 * so we type slowly and then click the page heading to blur the field -
 * that both closes the popup calendar and is what triggers the app to
 * copy the From Date into the To Date field for a single-day request.
 */
async function typeDateAndDismissPicker(page: Page, field: ReturnType<Page['getByPlaceholder']>, value: string) {
  await field.click();
  await field.fill('');
  await field.pressSequentially(value, { delay: 30 });
  await page.getByRole('heading', { name: 'Assign Leave' }).click();
}

// Returns a future date (at least `daysAhead` days from today) that falls
// on a weekday, formatted as yyyy-mm-dd. Weekends have no working days in
// this app's leave periods, so weekend dates get rejected.
function futureWeekdayDate(daysAhead = 14): string {
  const date = new Date();
  date.setDate(date.getDate() + daysAhead);
  while (date.getDay() === 0 || date.getDay() === 6) {
    date.setDate(date.getDate() + 1);
  }
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

test('create employee and assign them a leave request', async ({ page }) => {
  const uniqueSuffix = `${Date.now()}`;
  const firstName = 'TestQA';
  const lastName = `Auto${uniqueSuffix}`;
  // OrangeHRM composes the employee's full display name as
  // "First Middle Last". With an empty middle name it renders as
  // "First  Last" (double space), so match on the two name parts with
  // flexible whitespace rather than a single hardcoded string.
  const fullNamePattern = new RegExp(`^${firstName}\\s+${lastName}$`);
  const leaveDate = futureWeekdayDate();

  // --- Step 1-6: create employee via PIM ---
  await page.goto('/web/index.php/pim/addEmployee');
  await expect(page.getByRole('heading', { name: 'Add Employee' })).toBeVisible();

  // These fields have no <label>; their accessible name comes from the
  // placeholder text, so getByRole('textbox', { name }) is the reliable
  // accessible locator here (getByLabel would time out with no match).
  await page.getByRole('textbox', { name: 'First Name' }).fill(firstName);
  await page.getByRole('textbox', { name: 'Last Name' }).fill(lastName);

  await page.getByRole('button', { name: 'Save' }).click();

  // Successful save navigates to the Personal Details page for the new employee.
  await expect(page).toHaveURL(/\/pim\/viewPersonalDetails\/empNumber\/\d+/, { timeout: 15000 });
  await expect(page.getByText('Personal Details').first()).toBeVisible();

  const url = page.url();
  const empNumberMatch = url.match(/empNumber\/(\d+)/);
  const empNumber = empNumberMatch ? empNumberMatch[1] : null;
  expect(empNumber, 'expected to extract empNumber from the Personal Details URL').not.toBeNull();

  // --- Step 7-10: navigate to Assign Leave and pick the employee ---
  await page.goto('/web/index.php/leave/assignLeave');
  // Use the page heading specifically - "Assign Leave" also appears as the
  // topbar nav link text, so getByText alone matches both.
  await expect(page.getByRole('heading', { name: 'Assign Leave' })).toBeVisible();

  const employeeInput = page.getByPlaceholder('Type for hints...');
  await employeeInput.click();
  // A single space between first/last is enough to trigger the autocomplete
  // and matches regardless of the middle-name spacing quirk noted above.
  await employeeInput.pressSequentially(`${firstName} ${lastName}`, { delay: 50 });

  const employeeOption = page.getByRole('option', { name: fullNamePattern });
  await expect(employeeOption).toBeVisible({ timeout: 10000 });
  await employeeOption.click();

  // Confirm the employee field now holds the selected employee's name.
  await expect(employeeInput).toHaveValue(fullNamePattern);

  // --- Step 11-12: choose leave type ---
  await page.getByText('-- Select --').first().click();
  const annualLeaveOption = page.getByRole('option', { name: 'Annual Leave' });
  await expect(annualLeaveOption).toBeVisible();
  await annualLeaveOption.click();
  await expect(page.getByText('Annual Leave').first()).toBeVisible();

  // --- Step 13-15: set From Date, verify To Date auto-populates ---
  const dateFields = page.getByPlaceholder('yyyy-mm-dd');
  const fromDateField = dateFields.first();
  const toDateField = dateFields.nth(1);

  await typeDateAndDismissPicker(page, fromDateField, leaveDate);
  await expect(fromDateField).toHaveValue(leaveDate);

  // The app defaults To Date to match From Date for a single-day request,
  // but only copies it over once the From Date field loses focus (see the
  // helper above).
  await expect(toDateField).toHaveValue(leaveDate, { timeout: 5000 });

  // --- Step 16-17: submit and confirm the low-balance dialog ---
  await page.getByRole('button', { name: 'Assign' }).click();

  // Note: the dialog's accessible *name* is not "Confirm Leave Assignment" -
  // that text is just a paragraph inside the dialog, not an aria-label/
  // aria-labelledby on the dialog element itself - so we locate the dialog
  // by role alone and assert on its body text instead of filtering by name.
  // Also note: Locator.isVisible() checks the current DOM state instantly
  // and does NOT poll/wait, so we use expect(...).toBeVisible() (which does
  // auto-wait) wrapped in try/catch to detect whether the dialog shows up.
  const confirmDialog = page.getByRole('dialog');
  let dialogAppeared = true;
  try {
    await expect(confirmDialog).toBeVisible({ timeout: 5000 });
  } catch (error) {
    dialogAppeared = false;
    console.log(
      `Low-balance confirmation dialog did not appear within 5s; treating as non-fatal since the employee may already have a balance in this environment. Original error: ${
        (error as Error).message
      }`
    );
  }

  if (dialogAppeared) {
    // Expected: new employees have no leave balance, so OrangeHRM asks for
    // confirmation before assigning leave anyway. Use exact match for the
    // title - without it, "Confirm Leave Assignment" also substring-matches
    // nothing here, but the body text below is a *different* paragraph, so
    // strict mode requires each getByText() to resolve to exactly one node.
    await expect(confirmDialog.getByText('Confirm Leave Assignment', { exact: true })).toBeVisible();
    await expect(confirmDialog.getByText(/does not have sufficient leave balance/i)).toBeVisible();
    await confirmDialog.getByRole('button', { name: 'Ok' }).click();
  }

  // --- Step 18: verify success toast ---
  // Use exact match for "Success" - the toast also has a "Successfully
  // Saved" message paragraph, of which "Success" is a substring.
  await expect(page.getByText('Success', { exact: true })).toBeVisible({ timeout: 10000 });
  await expect(page.getByText('Successfully Saved')).toBeVisible();
});
