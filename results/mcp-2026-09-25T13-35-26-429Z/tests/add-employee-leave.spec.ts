import { test, expect } from '@playwright/test';

test('add employee via PIM and assign leave via Leave module', async ({ page }) => {
  test.setTimeout(90_000);

  const unique = Date.now();
  const firstName = 'Testeragent';
  const lastName = `Autoqa${unique}`;
  const fullName = `${firstName} ${lastName}`;

  // Step 1-6: Add Employee
  await page.goto('http://localhost:8081/web/index.php/pim/addEmployee');
  await expect(page.getByRole('heading', { name: 'Add Employee' })).toBeVisible();

  await page.getByPlaceholder('First Name').fill(firstName);
  await page.getByPlaceholder('Last Name').fill(lastName);

  await page.getByRole('button', { name: 'Save' }).click();

  await expect(page).toHaveURL(/\/pim\/viewPersonalDetails\/empNumber\/\d+/, { timeout: 30_000 });

  // Step 7: Navigate to Assign Leave
  await page.goto('http://localhost:8081/web/index.php/leave/assignLeave');
  await expect(page.getByRole('heading', { name: 'Assign Leave' })).toBeVisible();

  // Step 8-9: Select employee
  const employeeInput = page.getByPlaceholder('Type for hints...');
  await employeeInput.click();
  await employeeInput.pressSequentially(firstName, { delay: 50 });

  const employeeOption = page.getByRole('option', { name: fullName });
  await expect(employeeOption).toBeVisible({ timeout: 15_000 });
  await employeeOption.click();

  // The app may render the selected value with normalized/extra whitespace
  // (e.g. middle name gap), so check it contains both first and last name
  // rather than an exact string match.
  const selectedValue = await employeeInput.inputValue();
  expect(selectedValue).toContain(firstName);
  expect(selectedValue).toContain(lastName);

  // Step 10: Select Leave Type
  const leaveTypeDropdown = page.locator('.oxd-select-text', { hasText: '-- Select --' }).first();
  await leaveTypeDropdown.click();

  const listbox = page.getByRole('listbox');
  await expect(listbox).toBeVisible();
  const leaveTypeOptions = listbox.getByRole('option');
  // pick first option that is not the placeholder
  const count = await leaveTypeOptions.count();
  let chosenLeaveType = '';
  for (let i = 0; i < count; i++) {
    const text = (await leaveTypeOptions.nth(i).textContent())?.trim() ?? '';
    if (text && text !== '-- Select --') {
      chosenLeaveType = text;
      await leaveTypeOptions.nth(i).click();
      break;
    }
  }
  expect(chosenLeaveType).not.toBe('');

  // Step 11-13: Dates
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 21);
  const yyyy = futureDate.getFullYear();
  const mm = String(futureDate.getMonth() + 1).padStart(2, '0');
  const dd = String(futureDate.getDate()).padStart(2, '0');
  const dateStr = `${yyyy}-${mm}-${dd}`;

  const dateInputs = page.getByPlaceholder('yyyy-mm-dd');
  const fromDateInput = dateInputs.nth(0);
  const toDateInput = dateInputs.nth(1);

  await fromDateInput.click();
  await page.keyboard.press('Control+A');
  await fromDateInput.pressSequentially(dateStr, { delay: 50 });
  await page.keyboard.press('Escape');

  await toDateInput.click();
  await page.keyboard.press('Control+A');
  await toDateInput.pressSequentially(dateStr, { delay: 50 });
  await page.keyboard.press('Escape');

  await expect(fromDateInput).toHaveValue(dateStr);
  await expect(toDateInput).toHaveValue(dateStr);

  // Step 14: Click Assign
  await page.getByRole('button', { name: 'Assign' }).click();

  // Step 15: Handle possible confirmation dialog
  const okButton = page.getByRole('button', { name: 'Ok' });
  try {
    await okButton.waitFor({ state: 'visible', timeout: 5_000 });
    await okButton.click();
  } catch {
    // No confirmation dialog appeared - employee likely had sufficient balance
  }

  // Step 16: Verify success toast
  await expect(page.getByText('Successfully Saved')).toBeVisible({ timeout: 15_000 });
});
