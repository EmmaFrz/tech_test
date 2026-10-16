describe('Application shell', () => {
  it('serves the dashboard on the root and a client-side route', () => {
    for (const path of ['/', '/nodes/node-0042']) {
      cy.visit(path);
      cy.title().should('match', /Fleet Ops$/);
      cy.get('h1').should('have.text', 'Fleet Ops');
      cy.get('[data-testid="connection-status"]').should('have.attr', 'data-state', 'live');
    }
  });
});
