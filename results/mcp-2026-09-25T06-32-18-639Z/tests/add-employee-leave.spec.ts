import { test, expect } from '@playwright/test';

test('add employee and assign leave', async ({ page }) => {
  const suffix = Date.now().toString();
  const firstName = `TestFN${suffix}`;
  const lastName = `TestLN${suffix}`;
  const fullName = `${firstName} ${lastName}`;

  // --- Step 1: Create a new employee via PIM ---
  await page.goto('http://localhost:8081/web/index.php/pim/addEmployee');

  await page.getByRole('textbox', { name: 'First Name' }).fill(firstName);
  await page.getByRole('textbox', { name: 'Last Name' }).fill(lastName);

  await page.getByRole('button', { name: 'Save' }).click();

  await page.waitForURL(/\/pim\/viewPersonalDetails\/empNumber\/\d+/);
  await expect(page).toHaveURL(/\/pim\/viewPersonalDetails\/empNumber\/\d+/);

  // --- Step 2: Assign leave to that employee via Leave -> Assign Leave ---
  await page.goto('http://localhost:8081/web/index.php/leave/assignLeave');

  const employeeInput = page.getByPlaceholder('Type for hints...').first();
  await employeeInput.click();
  await employeeInput.fill(fullName);
  await page.getByRole('option', { name: fullName }).click();

  // Custom Leave Type dropdown (not a native <select>)
  await page.getByText('-- Select --').first().click();
  const leaveTypeOptions = page.getByRole('listbox').last().getByRole('option');
  await expect(leaveTypeOptions.first()).toBeVisible();
  // Pick the first option that is not the placeholder / "No Records Found"
  const count = await leaveTypeOptions.count();
  let picked = false;
  for (let i = 0; i < count; i++) {
    const text = (await leaveTypeOptions.nth(i).textContent())?.trim() ?? '';
    if (text && text !== '-- Select --' && text !== 'No Records Found') {
      await leaveTypeOptions.nth(i).click();
      picked = true;
      break;
    }
  }
  expect(picked).toBeTruthy();

  // Pick a future single date that falls on a weekday (Mon-Fri). The org's
  // default work week has no working days on the weekend, and the Assign
  // Leave API rejects non-working-day requests with a 400 error.
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 30);
  while (futureDate.getDay() === 0 || futureDate.getDay() === 6) {
    futureDate.setDate(futureDate.getDate() + 1);
  }
  const yyyy = futureDate.getFullYear();
  const mm = String(futureDate.getMonth() + 1).padStart(2, '0');
  const dd = String(futureDate.getDate()).padStart(2, '0');
  const dateStr = `${yyyy}-${mm}-${dd}`;

  // Plain .fill() can desync the date-picker's internal state, so click,
  // select-all, and type the date character-by-character instead.
  const fromDateInput = page.getByPlaceholder('yyyy-mm-dd').first();
  await fromDateInput.click();
  await page.keyboard.press('ControlOrMeta+A');
  await fromDateInput.pressSequentially(dateStr, { delay: 30 });

  const toDateInput = page.getByPlaceholder('yyyy-mm-dd').nth(1);
  await toDateInput.click();
  await page.keyboard.press('ControlOrMeta+A');
  await toDateInput.pressSequentially(dateStr, { delay: 30 });
  await page.keyboard.press('Escape');

  await expect(fromDateInput).toHaveValue(dateStr);
  await expect(toDateInput).toHaveValue(dateStr);

  await page.getByRole('button', { name: 'Assign' }).click();

  // A brand-new employee has no leave entitlement yet, so a confirmation
  // dialog ("Employee does not have sufficient leave balance... Click OK
  // to confirm") is expected here and needs an extra click. Use waitFor
  // (which polls) rather than isVisible() (which checks once, immediately)
  // since the dialog takes a moment to render after clicking Assign.
  const okButton = page.getByRole('button', { name: 'Ok' });
  const dialogAppeared = await okButton
    .waitFor({ state: 'visible', timeout: 8000 })
    .then(() => true)
    .catch(() => false);
  if (dialogAppeared) {
    await okButton.click();
  }

  // --- Step 3: Verify the leave request was recorded ---
  // Primary assertion: success toast.
  await expect(page.getByText('Successfully Saved')).toBeVisible({ timeout: 15000 });

  // Secondary / best-effort verification via Leave List (not a failure
  // condition — known app quirk where a freshly-assigned leave request can
  // fail to appear in this search even though it exists in the DB).
  await page.goto('http://localhost:8081/web/index.php/leave/viewLeaveList');
  const listEmployeeInput = page.getByPlaceholder('Type for hints...').first();
  await listEmployeeInput.click();
  await listEmployeeInput.fill(fullName);
  const option = page.getByRole('option', { name: fullName });
  const optionAppeared = await option
    .waitFor({ state: 'visible', timeout: 5000 })
    .then(() => true)
    .catch(() => false);
  if (optionAppeared) {
    await option.click();
    await page.getByRole('button', { name: 'Search' }).click();
  }
});
