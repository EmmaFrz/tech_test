import { SELECTORS } from '../support/selectors';

describe('Critical triage', () => {
  it('filters the critical nodes, opens one and inspects its telemetry', () => {
    cy.visit('/');
    cy.get(SELECTORS.connectionStatus).should('have.attr', 'data-state', 'live');

    cy.contains('label', /^CRITICAL/).click();
    cy.get(SELECTORS.nodeRow).should('have.length.greaterThan', 0);

    cy.get(SELECTORS.nodeRow)
      .first()
      .invoke('attr', 'data-node-id')
      .then((nodeId) => {
        cy.get(`${SELECTORS.nodeRow}[data-node-id="${nodeId}"] button`).click();

        cy.get(SELECTORS.nodeDetail).should('contain.text', nodeId);
        cy.get(SELECTORS.nodeDetail).contains('dt', 'CPU load');
        cy.get(SELECTORS.nodeDetail).contains('dt', 'Latency');
        cy.get(`${SELECTORS.telemetryChart} polyline`).should('have.length.greaterThan', 0);
      });

    cy.contains('button', /^Pause$/).click();
    cy.get(SELECTORS.nodeRow).should(($rows) => {
      expect($rows.length).to.be.greaterThan(0);
      $rows.each((_, row) => {
        expect(row.getAttribute('data-status')).to.equal('CRITICAL');
      });
    });
  });
});
