import {
  emitDelta,
  emitSnapshot,
  emulateReducedMotion,
  fleetNode,
  laterSample,
  makeFleet,
  resetReducedMotion,
  visitWithTelemetry,
} from '../support/fakeTelemetry';
import { SELECTORS } from '../support/selectors';

const { DOWN, UP } = Cypress.Keyboard.Keys;

function focusRow(nodeId: string): void {
  cy.contains(SELECTORS.nodeRowButton, new RegExp(`^${nodeId}$`)).focus();
}

function rowOf(nodeId: string): Cypress.Chainable<JQuery> {
  return cy.get(`${SELECTORS.nodeRow}[data-node-id="${nodeId}"]`);
}

/** The row's computed animation; asserting through it first requires the row to exist. */
function animationOf($row: JQuery): string {
  expect($row, 'the row').to.have.length(1);
  const row = $row[0];
  return row?.ownerDocument.defaultView?.getComputedStyle(row).animationName ?? 'missing';
}

describe('Grid keyboard focus during live updates', () => {
  it('stays in the grid when a reorder moves the focused row out of the window', () => {
    visitWithTelemetry(makeFleet(200));
    cy.get('select').select('Latency');
    focusRow('node-0001');

    emitDelta(laterSample(1, { latencyMs: 1 }));

    cy.get(SELECTORS.nodeRow).first().should('have.attr', 'data-node-id', 'node-0002');
    cy.focused().should('match', SELECTORS.nodeGrid);
    cy.press(DOWN);
    cy.focused().should('have.text', 'node-0002');
    cy.press(DOWN);
    cy.focused().should('have.text', 'node-0003');
  });

  it('keeps focus on a row that a reorder moves within the window', () => {
    visitWithTelemetry(makeFleet(5));
    cy.get('select').select('Latency');
    focusRow('node-0001');

    emitDelta(laterSample(1, { latencyMs: 1 }));

    cy.get(SELECTORS.nodeRow).last().should('have.attr', 'data-node-id', 'node-0001');
    cy.focused().should('have.text', 'node-0001');
    cy.press(UP);
    cy.focused().should('have.text', 'node-0005');
  });

  it('stays in the grid when the focused node leaves the status filter', () => {
    visitWithTelemetry(makeFleet(4, 'CRITICAL'));
    cy.contains('label', /^CRITICAL/).click();
    focusRow('node-0002');

    emitDelta(laterSample(2, { status: 'OK' }));

    cy.get(SELECTORS.nodeRow).should('have.length', 3);
    cy.focused().should('match', SELECTORS.nodeGrid);
    cy.press(DOWN);
    cy.focused().should('have.text', 'node-0003');
  });

  it('stays in the grid when a replacement snapshot drops the focused node', () => {
    visitWithTelemetry(makeFleet(3));
    focusRow('node-0002');

    emitSnapshot([fleetNode(1), fleetNode(3)]);

    cy.get(SELECTORS.nodeRow).should('have.length', 2);
    cy.focused().should('match', SELECTORS.nodeGrid);
    cy.press(UP);
    cy.focused().should('have.text', 'node-0001');
  });

  it('leaves focus in the search box while the grid reorders', () => {
    visitWithTelemetry(makeFleet(200));
    cy.get('select').select('Latency');
    focusRow('node-0001');
    cy.get('input[type="search"]').focus();

    emitDelta(laterSample(1, { latencyMs: 1 }));

    cy.get(SELECTORS.nodeRow).first().should('have.attr', 'data-node-id', 'node-0002');
    cy.focused().should('have.attr', 'type', 'search');
  });
});

describe('Critical pulse', () => {
  afterEach(() => {
    resetReducedMotion();
  });

  it('pulses a node that enters CRITICAL while the CRITICAL filter hid it', () => {
    visitWithTelemetry([fleetNode(1), fleetNode(2, { status: 'CRITICAL' }), fleetNode(3)]);
    cy.contains('label', /^CRITICAL/).click();
    cy.get(SELECTORS.nodeRow).should('have.length', 1);
    rowOf('node-0002').should(($row) => expect(animationOf($row)).to.equal('none'));

    emitDelta(laterSample(1, { status: 'CRITICAL', cpuLoad: 95 }));

    rowOf('node-0001').should(($row) => expect(animationOf($row)).not.to.equal('none'));
  });

  it('does not animate the pulse when the user prefers reduced motion', () => {
    emulateReducedMotion();
    visitWithTelemetry([fleetNode(1), fleetNode(2, { status: 'CRITICAL' })]);
    cy.contains('label', /^CRITICAL/).click();

    emitDelta(laterSample(1, { status: 'CRITICAL', cpuLoad: 95 }));

    rowOf('node-0001').should(($row) => {
      expect($row.attr('class')).to.match(/pulse/);
      expect(animationOf($row)).to.equal('none');
    });
  });
});
