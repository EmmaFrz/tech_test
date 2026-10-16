// Hydration mismatches and crashed regions are reported through console.error, so any call fails
// the test. Uncaught page errors already fail Cypress runs on their own.
const consoleErrors: string[] = [];

Cypress.on('window:before:load', (win) => {
  const reportToConsole = win.console.error.bind(win.console);

  win.console.error = (...args: unknown[]): void => {
    consoleErrors.push(args.map(String).join(' '));
    reportToConsole(...args);
  };
});

beforeEach(() => {
  consoleErrors.length = 0;
});

afterEach(() => {
  expect(consoleErrors, 'console errors logged by the page').to.deep.equal([]);
});
