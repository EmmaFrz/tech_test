import { makeFleet, visitWithTelemetry } from '../support/fakeTelemetry';
import { expectInWindow, expectReceivesPointer } from '../support/layout';
import { SELECTORS } from '../support/selectors';

const { ESC } = Cypress.Keyboard.Keys;
const DRAWER_BELOW_PX = 1280;
const USABLE_ROW_COUNT = 4;
const CRITICAL_COUNT = 3;

// Windows where the header, overview and filters used to leave the grid little or no height.
const LAYOUTS = [
  { name: 'a 375 px window with normal text', width: 375, height: 900, fontSize: '' },
  { name: 'a 375 px window with text at 200 %', width: 375, height: 900, fontSize: '200%' },
  { name: 'a short 375 px window', width: 375, height: 600, fontSize: '' },
  { name: 'a 1440 px window with text at 200 %', width: 1440, height: 900, fontSize: '200%' },
] as const;

function visitAt(layout: (typeof LAYOUTS)[number]): void {
  cy.viewport(layout.width, layout.height);
  const fleet = makeFleet(200).map((node, index) =>
    index < CRITICAL_COUNT ? { ...node, status: 'CRITICAL' as const } : node,
  );
  visitWithTelemetry(fleet);
  cy.document().then((page) => {
    page.documentElement.style.fontSize = layout.fontSize;
  });
  // The grid has measured its rows at this text size once each starts where the previous ends.
  // Acting earlier mounts rows while the ResizeObserver is still delivering the new sizes.
  cy.get(SELECTORS.nodeRow).should(($rows) => {
    const boxes = $rows
      .toArray()
      .map((row) => row.getBoundingClientRect())
      .sort((upper, lower) => upper.top - lower.top);
    boxes.slice(1).forEach((box, index) => {
      expect(box.top, 'row top').to.be.closeTo(boxes[index]?.bottom ?? 0, 1);
    });
  });
}

function expectUsable(selector: string): void {
  cy.get(selector).each(($element) => {
    cy.wrap($element).scrollIntoView();
    cy.wrap($element).should(($current) => {
      expectInWindow($current);
      expectReceivesPointer($current);
    });
  });
}

/** The drawer can be taller than the window; its top, with the node's name, must be in sight. */
function expectInWindowTop($panel: JQuery): void {
  const top = $panel[0]?.getBoundingClientRect().top ?? Number.NEGATIVE_INFINITY;
  expect(top, 'top of the panel').to.be.at.least(0);
}

describe('Layout with little room for the grid', () => {
  for (const layout of LAYOUTS) {
    describe(`in ${layout.name}`, () => {
      beforeEach(() => {
        visitAt(layout);
      });

      it('keeps the header controls, every status filter, the search and the sort usable', () => {
        expectUsable(SELECTORS.connectionStatus);
        expectUsable('header button');
        expectUsable('[role="radiogroup"] label');
        expectUsable('input[type="search"]');
        expectUsable('select');
        expectUsable('[role="toolbar"] button');

        cy.contains('label', /^CRITICAL/).click();
        cy.get(SELECTORS.nodeRow).should('have.length', CRITICAL_COUNT);
        cy.contains('label', /^All/).click();
        cy.get('input[type="search"]').type('node-0042');
        cy.get(SELECTORS.nodeRow).should('have.length', 1);
        cy.get('select').select('Latency');
        cy.get(SELECTORS.nodeRow).should('have.attr', 'data-node-id', 'node-0042');
      });

      it('keeps a grid tall enough to select a row and come back to it', () => {
        cy.get(SELECTORS.nodeRow).then(($rows) => {
          const rowHeight = $rows[0]?.getBoundingClientRect().height ?? 0;
          cy.get(SELECTORS.nodeGrid).should(($grid) => {
            const gridHeight = $grid[0]?.getBoundingClientRect().height ?? 0;
            expect(gridHeight, 'grid height').to.be.at.least(rowHeight * (USABLE_ROW_COUNT + 1));
          });
        });

        cy.contains(SELECTORS.nodeRowButton, 'node-0004').click();

        cy.get(SELECTORS.nodeDetail).should('contain.text', 'node-0004');
        if (layout.width < DRAWER_BELOW_PX) {
          cy.get(SELECTORS.nodeDetail).should('have.focus').and(expectInWindowTop);
        }
        cy.press(ESC);
        cy.get(SELECTORS.nodeDetail).should('contain.text', 'No node selected');
        cy.focused().should('have.text', 'node-0004');
        cy.focused().should(($button) => expectInWindow($button.closest('[role="row"]')));
      });
    });
  }
});
