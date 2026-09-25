import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:8081';

function computeFutureWeekdayDate(startOffsetDays: number): string {
  const date = new Date();
  date.setDate(date.getDate() + startOffsetDays);
  while (date.getDay() === 0 || date.getDay() === 6) {
    date.setDate(date.getDate() + 1);
  }
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

test('create employee and assign leave', async ({ page }) => {
  test.setTimeout(90_000);

  const suffix = Date.now().toString();
  const firstName = `Test${suffix}`;
  const lastName = `Auto${suffix}`;
  const leaveDate = computeFutureWeekdayDate(7);

  // --- Part 1: Create employee via PIM ---
  await page.goto(`${BASE_URL}/web/index.php/pim/addEmployee`);

  await page.getByPlaceholder('First Name').fill(firstName);
  await page.getByPlaceholder('Last Name').fill(lastName);

  await page.getByRole('button', { name: 'Save' }).click();

  // Confirm employee creation succeeded
  await expect(page).toHaveURL(/\/pim\/viewPersonalDetails\/empNumber\/\d+/, {
    timeout: 20_000,
  });

  // --- Part 2: Assign leave via Leave module ---
  await page.goto(`${BASE_URL}/web/index.php/leave/assignLeave`);

  const employeeInput = page.getByPlaceholder('Type for hints...');
  await employeeInput.click();
  await employeeInput.fill(firstName);

  const employeeOption = page.getByRole('option', {
    name: `${firstName} ${lastName}`,
  });
  await expect(employeeOption).toBeVisible({ timeout: 15_000 });
  await employeeOption.click();

  // Verify the selected value rendered with two spaces
  await expect(employeeInput).toHaveValue(`${firstName}  ${lastName}`);

  // Leave Type dropdown (the sole custom select control on this page)
  const leaveTypeControl = page.locator('.oxd-select-text').first();
  await leaveTypeControl.click();

  const leaveTypeListbox = page.getByRole('listbox');
  await expect(leaveTypeListbox).toBeVisible();

  // Pick the first real (non-placeholder) leave type option
  const options = leaveTypeListbox.getByRole('option');
  const optionCount = await options.count();
  let chosenLeaveType = '';
  for (let i = 0; i < optionCount; i++) {
    const text = (await options.nth(i).innerText()).trim();
    if (text && text !== '-- Select --') {
      chosenLeaveType = text;
      await options.nth(i).click();
      break;
    }
  }
  expect(chosenLeaveType).not.toBe('');

  // From Date
  const fromDateInput = page.getByPlaceholder('yyyy-mm-dd').first();
  await fromDateInput.click();
  await page.keyboard.press('ControlOrMeta+a');
  await fromDateInput.pressSequentially(leaveDate, { delay: 50 });

  // To Date - clicking into this field also dismisses the From Date picker popup
  const toDateInput = page.getByPlaceholder('yyyy-mm-dd').nth(1);
  await toDateInput.click();
  await page.keyboard.press('ControlOrMeta+a');
  await toDateInput.pressSequentially(leaveDate, { delay: 50 });

  // Dismiss the To Date picker popup by clicking the form heading (well away from
  // any popover position, so it can't be intercepted by a still-open calendar).
  await page.getByRole('heading', { name: 'Assign Leave' }).click();

  // Sanity checks before submit
  await expect(fromDateInput).toHaveValue(leaveDate);
  await expect(toDateInput).toHaveValue(leaveDate);
  await expect(leaveTypeControl).toContainText(chosenLeaveType);

  // Submit
  await page.getByRole('button', { name: 'Assign' }).click();

  // Handle optional confirmation dialog for insufficient leave balance.
  // Note: the dialog has role="dialog" but no accessible name (no aria-label),
  // so it must be matched without a `name` filter and by its visible text.
  // `waitFor` (not `isVisible`, which does not retry) is required here since the
  // dialog takes a moment to render after clicking Assign.
  const confirmDialog = page.getByRole('dialog').filter({
    hasText: 'Confirm Leave Assignment',
  });
  const dialogAppeared = await confirmDialog
    .waitFor({ state: 'visible', timeout: 8_000 })
    .then(() => true)
    .catch(() => false);
  if (dialogAppeared) {
    await confirmDialog.getByRole('button', { name: 'Ok' }).click();
  }

  // Primary success signal: success toast
  const successToast = page.locator('.oxd-toast', {
    hasText: 'Successfully Saved',
  });
  await expect(successToast).toBeVisible({ timeout: 15_000 });
});
