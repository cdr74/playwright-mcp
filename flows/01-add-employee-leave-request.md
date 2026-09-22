Write a single Playwright test for OrangeHRM that does the following:

1. Create a new employee via the PIM module. Use a unique, generated first
   and last name so the test can be re-run without colliding with existing
   data.
2. Assign that employee a leave request (any available leave type, any
   single-day date in the future) via the Leave module's administrative
   assignment flow.
3. Verify the leave request was recorded successfully.

Save the finished test as `tests/add-employee-leave.spec.ts`, relative to
your output directory. It should use `@playwright/test`'s `test`/`expect`.
The browser context is already authenticated against the app - do not
write a login step.
