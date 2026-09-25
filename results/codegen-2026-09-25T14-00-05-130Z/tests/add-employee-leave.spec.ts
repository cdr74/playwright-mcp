import { test, expect, Page } from '@playwright/test';

test.use({
  viewport: {
    height: 1200,
    width: 1900,
  },
});

function formatDate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function futureWeekday(daysAhead: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  while (d.getDay() === 0 || d.getDay() === 6) {
    d.setDate(d.getDate() + 1);
  }
  return d;
}

async function fillPendingDropdowns(page: Page, maxIterations = 5) {
  for (let i = 0; i < maxIterations; i++) {
    const placeholder = page.getByText('-- Select --').first();
    if (!(await placeholder.isVisible().catch(() => false))) {
      return;
    }
    await placeholder.click();
    const options = page.locator('.oxd-select-dropdown').getByRole('option');
    await expect(options.first()).toBeVisible();
    const count = await options.count();
    let picked = false;
    for (let j = 0; j < count; j++) {
      const text = (await options.nth(j).textContent())?.trim();
      if (text && text !== '-- Select --') {
        await options.nth(j).click();
        picked = true;
        break;
      }
    }
    if (!picked) {
      await options.first().click();
    }
  }
}

// The employee-name autocomplete on Assign Leave only returns a handful of
// matches for a given search term (older matches first), and only accepts
// real keystrokes (`.fill()` doesn't reliably trigger its search). Search
// using the full, timestamp-suffixed first name so the query is specific
// enough to match only this run's employee even after many prior test runs
// have left similarly-named employees in the database, and retry briefly in
// case the just-created employee hasn't been indexed for search yet.
async function selectEmployeeInAutocomplete(
  page: Page,
  searchTerm: string,
  optionName: string,
) {
  const input = page.getByRole('textbox', { name: 'Type for hints...' });
  const option = page.getByRole('option', { name: optionName });

  for (let attempt = 0; attempt < 5; attempt++) {
    await input.click();
    await input.press('Control+A');
    await input.press('Backspace');
    await input.pressSequentially(searchTerm, { delay: 50 });
    const found = await option
      .first()
      .waitFor({ state: 'visible', timeout: 5000 })
      .then(() => true)
      .catch(() => false);
    if (found) {
      await option.first().click();
      return;
    }
    await page.waitForTimeout(1500);
  }
  throw new Error(
    `Employee option "${optionName}" never appeared in autocomplete after retries`,
  );
}

test('add employee and assign leave', async ({ page }) => {
  test.setTimeout(90000);

  const unique = Date.now();
  const firstName = `Thomas${unique}`;
  const lastName = `Mueller${unique}`;
  const fullName = `${firstName} ${lastName}`;

  await page.goto('http://localhost:8081/web/index.php/dashboard/index');

  // --- Step 1: Create employee via PIM ---
  await page.getByRole('link', { name: 'PIM' }).click();
  await page.getByRole('button', { name: ' Add' }).click();

  await page.getByRole('textbox', { name: 'First Name' }).fill(firstName);
  await page.getByRole('textbox', { name: 'Last Name' }).fill(lastName);

  await page.getByRole('button', { name: 'Save' }).click();

  // Confirm employee was created - redirect to personal details page
  await expect(page).toHaveURL(/pim\/viewPersonalDetails\/empNumber\/\d+/, {
    timeout: 15000,
  });

  // --- Step 2: Assign leave to the new employee ---
  await page.getByRole('link', { name: 'Leave' }).click();
  await page.getByRole('link', { name: 'Assign Leave' }).click();

  await selectEmployeeInAutocomplete(page, firstName, fullName);

  // Leave Type dropdown
  await fillPendingDropdowns(page);

  // Wait for leave balance to update (confirms leave type selection took)
  await page.waitForTimeout(500);

  // Pick a single-day date on a future weekday (weekends have no working
  // days configured, which the app rejects as "No Working Days Selected").
  const dateStr = formatDate(futureWeekday(30));

  const fromDateInput = page.getByRole('textbox', { name: 'yyyy-mm-dd' }).first();
  await fromDateInput.click();
  await fromDateInput.press('Control+A');
  await fromDateInput.pressSequentially(dateStr);
  await page.keyboard.press('Escape');

  const toDateInput = page.getByRole('textbox', { name: 'yyyy-mm-dd' }).nth(1);
  await toDateInput.click();
  await toDateInput.press('Control+A');
  await toDateInput.pressSequentially(dateStr);
  await page.keyboard.press('Escape');

  // A "Duration"/Partial Day dropdown may appear once a single-day range
  // is selected - fill it (and any other newly-appeared dropdown) too.
  await fillPendingDropdowns(page);

  await page.getByRole('button', { name: 'Assign' }).click();

  // A brand-new employee has no leave balance yet - a confirmation dialog
  // may appear asking to confirm despite insufficient balance.
  const okButton = page.getByRole('button', { name: 'Ok' });
  if (await okButton.isVisible({ timeout: 5000 }).catch(() => false)) {
    await okButton.click();
  }

  // --- Step 3: Verify the leave request was recorded ---
  await expect(page.locator('.oxd-toast')).toContainText('Success', {
    timeout: 15000,
  });
});
