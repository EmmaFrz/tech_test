describe('Application shell', () => {
  it('serves the dashboard on the root and a client-side route', () => {
    for (const path of ['/', '/nodes/node-0042']) {
      cy.visit(path);
      cy.title().should('eq', 'Fleet Ops');
      cy.get('main h1').should('have.text', 'A clear view of your fleet.');
      cy.contains('Telemetry is not connected yet.').should('be.visible');
    }
  });
});
