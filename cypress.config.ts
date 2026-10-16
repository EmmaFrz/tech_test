import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    baseUrl: process.env['CYPRESS_baseUrl'] ?? 'http://localhost:3000',
    specPattern: 'cypress/e2e/**/*.cy.ts',
    supportFile: false,
    viewportWidth: 1440,
    viewportHeight: 900,
  },
  video: false,
});
