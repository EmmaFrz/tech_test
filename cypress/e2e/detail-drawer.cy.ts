import {
  emitDelta,
  laterSample,
  makeFleet,
  pressEnter,
  pressShiftTab,
  visitWithTelemetry,
} from '../support/fakeTelemetry';
import { SELECTORS } from '../support/selectors';

const { DOWN, ESC, TAB } = Cypress.Keyboard.Keys;

function openWithKeyboard(index: number): void {
  cy.get(SELECTORS.nodeRowButton).eq(index).as('opener').focus();
  pressEnter();
  cy.get(SELECTORS.nodeDetail).should('have.attr', 'tabindex', '-1');
}

function expectFocusInDrawer(): void {
  cy.focused().should(($focused) => {
    expect($focused, 'the focused element').to.have.length(1);
    expect($focused[0]?.closest(SELECTORS.detailDrawer), 'focus inside the drawer').not.to.equal(
      null,
    );
  });
}

describe('Detail drawer below 1280 px', () => {
  beforeEach(() => {
    cy.viewport(1100, 900);
  });

  it('takes keyboard focus and keeps the covered grid out of reach', () => {
    visitWithTelemetry(makeFleet(500));

    openWithKeyboard(0);

    cy.focused().should('match', SELECTORS.nodeDetail);
    cy.press(DOWN);
    expectFocusInDrawer();
    cy.press(TAB);
    cy.focused().should('have.text', 'Close');
    pressShiftTab();
    cy.focused().should('have.text', 'Pause');
    cy.press(TAB);
    cy.focused().should('have.text', 'Close');
    cy.get(SELECTORS.nodeRowButton)
      .first()
      .should(($button) => expect($button.closest('[inert]'), 'covered row').to.have.length(1));
    cy.focused().should('have.text', 'Close');
  });

  it('returns focus to the row that opened it when Close is activated', () => {
    visitWithTelemetry(makeFleet(500));
    openWithKeyboard(2);
    cy.press(TAB);
    cy.focused().should('have.text', 'Close');

    pressEnter();

    cy.get(SELECTORS.nodeDetail).should('contain.text', 'No node selected');
    cy.get('@opener').should('have.focus');
    cy.press(DOWN);
    cy.focused().should('have.text', 'node-0004');
  });

  it('returns focus to the row that opened it on Escape', () => {
    visitWithTelemetry(makeFleet(500));
    openWithKeyboard(1);

    cy.press(ESC);

    cy.get('@opener').should('have.focus');
  });

  it('brings the row back into view when it moved out of the window while open', () => {
    visitWithTelemetry(makeFleet(500));
    cy.get('select').select('Latency');
    openWithKeyboard(0);
    cy.get('@opener').should('have.text', 'node-0001');

    emitDelta(laterSample(1, { latencyMs: 1 }));
    cy.get(SELECTORS.nodeRow).first().should('have.attr', 'data-node-id', 'node-0002');
    cy.press(ESC);

    cy.focused().should('have.text', 'node-0001');
    cy.focused().should(($button) => {
      const row = $button[0]?.closest('[role="row"]');
      const scroller = row?.closest('[role="rowgroup"]')?.parentElement;
      const rowBottom = row?.getBoundingClientRect().bottom ?? Number.POSITIVE_INFINITY;
      const viewportBottom = scroller?.getBoundingClientRect().bottom ?? 0;
      expect(rowBottom, 'focused row bottom').to.be.at.most(viewportBottom + 1);
    });
  });

  it('falls back to the grid when the row left the filter while open', () => {
    visitWithTelemetry(makeFleet(6, 'CRITICAL'));
    cy.contains('label', /^CRITICAL/).click();
    openWithKeyboard(0);

    emitDelta(laterSample(1, { status: 'OK' }));
    cy.get(SELECTORS.nodeRow).should('have.length', 5);
    cy.press(ESC);

    cy.focused().should('match', SELECTORS.nodeGrid);
    cy.press(DOWN);
    cy.focused().should('have.text', 'node-0002');
  });
});
