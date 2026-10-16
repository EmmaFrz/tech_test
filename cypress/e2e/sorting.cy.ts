import { SELECTORS } from '../support/selectors';

const LATENCY_CELL_INDEX = 4;

function latencyOf(row: HTMLElement | undefined): number {
  const text = row?.querySelectorAll('[role="gridcell"]')[LATENCY_CELL_INDEX]?.textContent ?? '';
  return Number.parseInt(text, 10);
}

describe('Sorting', () => {
  it('orders the grid by latency, descending, and keeps the order while paused', () => {
    cy.visit('/');
    cy.get(SELECTORS.connectionStatus).should('have.attr', 'data-state', 'live');
    cy.get(SELECTORS.nodeRow).should('have.length.greaterThan', 1);

    cy.get('select').select('Latency');
    cy.contains('button', 'Descending').should('be.visible');

    cy.contains('button', /^Pause$/).click();
    cy.get(SELECTORS.nodeRow).should(($rows) => {
      const first = latencyOf($rows[0]);
      const second = latencyOf($rows[1]);
      expect(Number.isNaN(first), 'first row latency is a number').to.equal(false);
      expect(first).to.be.at.least(second);
    });

    cy.contains('button', /^Resume$/).click();
    cy.contains('button', /^Pause$/).should('be.visible');
    cy.get(SELECTORS.connectionStatus).should('have.attr', 'data-state', 'live');
  });
});
