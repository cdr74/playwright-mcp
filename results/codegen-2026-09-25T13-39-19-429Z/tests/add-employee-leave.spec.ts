import { test, expect, Page, Locator } from '@playwright/test';

/**
 * Formats a Date as yyyy-mm-dd, the format required by the Leave module's
 * date inputs.
 */
function formatDate(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * The Leave module's From/To Date inputs open a date-picker popup and a
 * plain `.fill()` leaves the picker's internal state out of sync (producing
 * a "Should be a valid date" validation error). Instead: click the field,
 * select all existing text, type the date character-by-character, then
 * dismiss the popup.
 */
async function setLeaveDate(page: Page, input: Locator, dateStr: string) {
  await input.click();
  await input.press('Control+A');
  await input.pressSequentially(dateStr, { delay: 30 });
  await page.keyboard.press('Escape');
  await expect(input).toHaveValue(dateStr);
}

test('add an employee and assign them a leave request', async ({ page }) => {
  test.setTimeout(120_000);

  const uniqueId = Date.now().toString(36);
  const firstName = `Auto${uniqueId}`;
  const lastName = `Test${uniqueId}`;
  const fullName = `${firstName} ${lastName}`;

  // A single-day leave request, two weeks out, so it's always in the future.
  const leaveDate = new Date();
  leaveDate.setDate(leaveDate.getDate() + 14);
  const leaveDateStr = formatDate(leaveDate);

  await page.goto('http://localhost:8081/web/index.php/dashboard/index');

  // --- 1. Create a new employee via PIM ---
  await page.getByRole('link', { name: 'PIM' }).click();
  await page.getByRole('button', { name: 'Add' }).click();

  await page.getByRole('textbox', { name: 'First Name' }).fill(firstName);
  await page.getByRole('textbox', { name: 'Last Name' }).fill(lastName);

  await page.getByRole('button', { name: 'Save' }).click();

  // Successful save redirects to the employee's personal details page.
  await expect(page).toHaveURL(/pim\/viewPersonalDetails\/empNumber\/\d+/, {
    timeout: 15000,
  });
  await expect(page.getByText(fullName)).toBeVisible({ timeout: 10000 });

  // --- 2. Assign the new employee a leave request ---
  await page.getByRole('link', { name: 'Leave' }).click();
  await page.getByRole('link', { name: 'Assign Leave' }).click();
  await page.waitForLoadState('networkidle');

  const employeeInput = page.getByRole('textbox', { name: 'Type for hints...' });
  const employeeOption = page.getByRole('option', { name: fullName });

  // Search using the full (run-unique) first name rather than a generic
  // prefix like "Auto" - repeated test runs accumulate many employees whose
  // names share that prefix, and the autocomplete's result list is
  // truncated/virtualized, so a generic prefix can fail to surface this
  // run's specific employee. Also retry briefly in case the search index
  // lags just behind employee creation.
  let found = false;
  for (let attempt = 0; attempt < 6 && !found; attempt++) {
    await employeeInput.click();
    await employeeInput.fill('');
    await employeeInput.fill(firstName);
    found = await employeeOption
      .waitFor({ state: 'visible', timeout: 8000 })
      .then(() => true)
      .catch(() => false);
  }
  expect(found, `Employee autocomplete never showed an option for "${fullName}"`).toBe(true);
  await employeeOption.click();
  await expect(employeeInput).toHaveValue(new RegExp(`${firstName}\\s+${lastName}`));

  // Leave Type is a custom dropdown, not a native <select>. Its option list
  // includes the "-- Select --" placeholder as its own (non-)selectable
  // first entry, so explicitly skip it and pick the first real leave type.
  const leaveTypeGroup = page
    .locator('.oxd-input-group')
    .filter({ hasText: 'Leave Type' });
  const leaveTypeControl = leaveTypeGroup.locator('.oxd-select-text');
  await leaveTypeControl.click();
  const leaveTypeOptions = page
    .locator('.oxd-select-dropdown .oxd-select-option')
    .filter({ hasNotText: '-- Select --' });
  await expect(leaveTypeOptions.first()).toBeVisible({ timeout: 10000 });
  const chosenLeaveType = (await leaveTypeOptions.first().textContent())?.trim();
  expect(chosenLeaveType, 'Could not determine a real leave type option').toBeTruthy();
  await leaveTypeOptions.first().click();
  await expect(leaveTypeControl).toHaveText(chosenLeaveType!);

  const dateInputs = page.getByRole('textbox', { name: 'yyyy-mm-dd' });
  await setLeaveDate(page, dateInputs.nth(0), leaveDateStr);
  await setLeaveDate(page, dateInputs.nth(1), leaveDateStr);

  // Make sure no date-picker popup is left open/covering the Assign button.
  await page.getByText('Leave Balance').click();

  // Re-verify every field's state right before submitting (selections in
  // this custom-widget-heavy form have been observed to silently revert),
  // so a failure here gives a clear diagnostic instead of a generic
  // "Required" error after clicking Assign.
  await expect(leaveTypeControl).toHaveText(chosenLeaveType!);
  await expect(employeeInput).toHaveValue(new RegExp(`${firstName}\\s+${lastName}`));
  const preSubmitState = {
    employee: await employeeInput.inputValue(),
    leaveType: (await leaveTypeControl.textContent())?.trim(),
    fromDate: await dateInputs.nth(0).inputValue(),
    toDate: await dateInputs.nth(1).inputValue(),
  };

  await page.getByRole('button', { name: 'Assign' }).click();

  const confirmOk = page.getByRole('button', { name: 'Ok' });
  const successToast = page.getByText('Successfully Saved');
  const fieldError = page.locator('.oxd-input-field-error-message').first();

  const outcome = await Promise.race([
    confirmOk.waitFor({ state: 'visible', timeout: 20000 }).then(() => 'dialog' as const),
    successToast.waitFor({ state: 'visible', timeout: 20000 }).then(() => 'success' as const),
    fieldError.waitFor({ state: 'visible', timeout: 20000 }).then(() => 'error' as const),
  ]).catch(() => 'none' as const);

  if (outcome === 'none') {
    const bodyText = await page.locator('body').innerText();
    throw new Error(
      `Clicking Assign produced no visible dialog, toast, or field error. ` +
        `Field state right before submit: ${JSON.stringify(preSubmitState)}. ` +
        `Page text: ${bodyText.slice(0, 1000)}`
    );
  }

  if (outcome === 'error') {
    const allErrors = await page
      .locator('.oxd-input-field-error-message')
      .allTextContents();
    throw new Error(
      `Assign raised field validation errors instead of submitting. ` +
        `Field state right before submit: ${JSON.stringify(preSubmitState)}. ` +
        `Errors shown: ${JSON.stringify(allErrors)}`
    );
  }

  if (outcome === 'dialog') {
    // A brand-new employee has no leave balance yet; this confirmation
    // dialog must be accepted for the assignment to actually save.
    await confirmOk.click();
  }

  // --- 3. Verify the leave request was recorded ---
  await expect(successToast).toBeVisible({ timeout: 10000 });
});
