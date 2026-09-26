import { test, expect, type Page } from '@playwright/test';

/**
 * Returns a yyyy-mm-dd date string that is `daysAhead` days from today,
 * nudged forward to the next weekday if it lands on a weekend. Leave
 * requests covering only a weekend day are rejected by the app
 * ("No Working Days Selected"), so we must guarantee a weekday.
 */
function futureWeekdayDate(daysAhead: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysAhead);
  while (date.getDay() === 0 || date.getDay() === 6) {
    date.setDate(date.getDate() + 1);
  }
  return date.toISOString().slice(0, 10);
}

/**
 * OrangeHRM's dropdowns are custom widgets, not native <select> elements.
 * This helper opens the dropdown that lives inside the form row labelled
 * with `groupLabel`, then picks the option with the given text.
 */
async function selectCustomDropdownOption(page: Page, groupLabel: string, optionText: string) {
  const group = page.locator('.oxd-input-group', { hasText: groupLabel }).last();
  await group.locator('.oxd-select-text').click();
  await page.getByRole('option', { name: optionText, exact: true }).click();
}

/**
 * Types a date into one of the fiddly date-picker inputs. Typing the
 * value directly (rather than setting it or using the calendar widget)
 * is what reliably registers with the app.
 */
async function typeDate(input: ReturnType<Page['getByRole']>, value: string) {
  await input.click();
  await input.fill('');
  await input.type(value);
  await input.press('Escape');
}

test('create employee and assign them a leave request', async ({ page }) => {
  const uniqueSuffix = Date.now();
  const firstName = `Auto${uniqueSuffix}`;
  const lastName = `QA${uniqueSuffix}`;
  // The employee list / autocomplete render "First [Middle] Last" - since
  // we leave Middle Name blank, the app renders a double space between
  // first and last name. We match on the two name parts rather than
  // assuming a single-space-joined full name.
  const leaveDate = futureWeekdayDate(10);

  // ---- Step 1: create a new employee via PIM ----
  await page.goto('/web/index.php/pim/viewEmployeeList');
  await expect(page.getByRole('heading', { name: 'Employee Information' })).toBeVisible();

  await page.getByRole('button', { name: 'Add' }).click();
  await expect(page.getByRole('heading', { name: 'Add Employee' })).toBeVisible();

  await page.getByRole('textbox', { name: 'First Name' }).fill(firstName);
  await page.getByRole('textbox', { name: 'Last Name' }).fill(lastName);
  await page.getByRole('button', { name: 'Save' }).click();

  // Successful save redirects to the new employee's Personal Details page.
  await expect(page.getByRole('heading', { name: 'Personal Details' })).toBeVisible({ timeout: 15000 });
  await expect(page).toHaveURL(/\/pim\/viewPersonalDetails\/empNumber\/\d+/);
  await expect(page.getByText(firstName, { exact: false }).first()).toBeVisible();

  // ---- Step 2: assign that employee a leave request ----
  // "Assign Leave" (Leave module) assigns leave to someone else; "Apply"
  // only files leave for the logged-in user, so we must use Assign Leave.
  await page.goto('/web/index.php/leave/assignLeave');
  await expect(page.getByRole('heading', { name: 'Assign Leave' })).toBeVisible();

  const employeeInput = page.getByRole('textbox', { name: 'Type for hints...' }).first();
  await employeeInput.click();
  await employeeInput.fill(firstName);
  const suggestion = page.getByRole('option', { name: new RegExp(`${firstName}\\s+${lastName}`) });
  await expect(suggestion).toBeVisible({ timeout: 10000 });
  await suggestion.click();
  const selectedValue = await employeeInput.inputValue();
  expect(selectedValue).toContain(firstName);
  expect(selectedValue).toContain(lastName);

  await selectCustomDropdownOption(page, 'Leave Type', 'Annual Leave');
  await expect(page.locator('.oxd-input-group', { hasText: 'Leave Type' }).last().locator('.oxd-select-text')).toContainText('Annual Leave');

  const fromDateInput = page.getByPlaceholder('yyyy-mm-dd').first();
  const toDateInput = page.getByPlaceholder('yyyy-mm-dd').nth(1);
  await typeDate(fromDateInput, leaveDate);
  await typeDate(toDateInput, leaveDate);
  await expect(fromDateInput).toHaveValue(leaveDate);
  await expect(toDateInput).toHaveValue(leaveDate);

  await page.getByRole('button', { name: 'Assign' }).click();

  // New employees have no leave balance yet, so a confirmation dialog
  // about insufficient balance is expected here - but only sometimes,
  // depending on leave period configuration, so we don't treat its
  // absence as a failure.
  const insufficientBalanceOkButton = page.getByRole('button', { name: 'Ok' });
  try {
    await expect(insufficientBalanceOkButton).toBeVisible({ timeout: 5000 });
    await insufficientBalanceOkButton.click();
  } catch {
    console.log(
      'No "insufficient leave balance" confirmation dialog appeared - ' +
        'proceeding, since this dialog is only expected when the employee has no accrued balance.'
    );
  }

  // The "Successfully Saved" toast is the reliable signal that the leave
  // request was recorded - the Leave List search is known to be flaky on
  // this build, so we don't rely on searching for the entry afterwards.
  await expect(page.getByText('Successfully Saved')).toBeVisible({ timeout: 15000 });
});
