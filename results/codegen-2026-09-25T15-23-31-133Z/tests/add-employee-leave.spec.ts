import { test, expect } from '@playwright/test';

/**
 * Returns a date string in yyyy-mm-dd format for the next weekday
 * (Mon-Fri) that is at least `minDaysAhead` days in the future.
 * Weekend dates are rejected by the app's leave assignment flow, so we
 * skip Saturdays and Sundays.
 */
function nextWeekdayDateString(minDaysAhead: number): string {
  const date = new Date();
  date.setDate(date.getDate() + minDaysAhead);
  while (date.getDay() === 0 || date.getDay() === 6) {
    date.setDate(date.getDate() + 1);
  }
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

async function fillDateField(page: import('@playwright/test').Page, field: import('@playwright/test').Locator, value: string) {
  await field.click();
  await field.press('Control+A');
  await field.pressSequentially(value, { delay: 30 });
  await page.keyboard.press('Escape');
}

test('add employee and assign them a leave request', async ({ page }) => {
  const unique = Date.now();
  const firstName = `Thomas${unique}`;
  const lastName = `Mueller${unique}`;

  await page.goto('/web/index.php/dashboard/index');

  // --- Step 1: create a new employee via PIM ---
  await page.getByRole('link', { name: 'PIM' }).click();
  await page.getByRole('button', { name: ' Add' }).click();

  await page.getByRole('textbox', { name: 'First Name' }).fill(firstName);
  await page.getByRole('textbox', { name: 'Last Name' }).fill(lastName);
  await page.getByRole('button', { name: 'Save' }).click();

  // Save redirects to the employee's personal details page.
  await expect(page).toHaveURL(/pim\/viewPersonalDetails\/empNumber\/\d+/, { timeout: 15000 });

  // --- Step 2: assign the employee a leave request ---
  await page.getByRole('link', { name: 'Leave' }).click();
  await page.getByRole('link', { name: 'Assign Leave' }).click();

  const employeeInput = page.getByRole('textbox', { name: 'Type for hints...' });
  await employeeInput.click();
  await employeeInput.fill(firstName.slice(0, 5));
  await page
    .getByRole('option', { name: new RegExp(`${firstName}\\s+${lastName}`) })
    .click();

  // Custom "Leave Type" dropdown - open it, then pick a real option
  // (the "-- Select --" placeholder is itself listed as an option and
  // must be avoided).
  await page.getByText('-- Select --').click();
  const leaveTypeOptions = page.getByRole('listbox').getByRole('option');
  await expect(leaveTypeOptions.first()).toBeVisible();
  const optionCount = await leaveTypeOptions.count();
  let leaveTypePicked = false;
  for (let i = 0; i < optionCount; i++) {
    const text = (await leaveTypeOptions.nth(i).textContent())?.trim();
    if (text && text !== '-- Select --') {
      await leaveTypeOptions.nth(i).click();
      leaveTypePicked = true;
      break;
    }
  }
  expect(leaveTypePicked).toBe(true);

  const dateValue = nextWeekdayDateString(5);
  const dateInputs = page.getByRole('textbox', { name: 'yyyy-mm-dd' });
  await fillDateField(page, dateInputs.first(), dateValue);
  await fillDateField(page, dateInputs.nth(1), dateValue);

  await page.getByRole('button', { name: 'Assign' }).click();

  // A brand-new employee has no leave entitlement yet, so a confirmation
  // dialog may appear asking to proceed anyway ("Employee does not have
  // sufficient leave balance..."). Race the dialog against the success
  // toast, since either may show up first depending on entitlement state.
  const confirmOkButton = page.getByRole('button', { name: 'Ok' });
  const successToast = page.getByText('Successfully Saved');

  await Promise.race([
    confirmOkButton.waitFor({ state: 'visible', timeout: 15000 }).catch(() => {}),
    successToast.waitFor({ state: 'visible', timeout: 15000 }).catch(() => {}),
  ]);

  if (await confirmOkButton.isVisible()) {
    await confirmOkButton.click();
  }

  // --- Step 3: verify the leave request was recorded ---
  await expect(successToast).toBeVisible({ timeout: 15000 });
});
