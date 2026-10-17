function elementOf($element: JQuery): HTMLElement {
  const element = $element[0];
  if (element === undefined) {
    throw new Error('The element is missing');
  }
  return element;
}

/** The pointer lands on the element itself at its center, not on something covering it. */
export function expectReceivesPointer($element: JQuery): void {
  const element = elementOf($element);
  const box = element.getBoundingClientRect();
  const hit = element.ownerDocument.elementFromPoint(
    (box.left + box.right) / 2,
    (box.top + box.bottom) / 2,
  );
  expect(hit !== null && element.contains(hit), `${element.tagName} receives the pointer`).to.equal(
    true,
  );
}

export function expectPointerReaches(selector: string): void {
  cy.get(selector).should(expectReceivesPointer);
}

// Scroll positions are whole pixels while boxes are not, so an aligned edge can miss by a fraction.
const SUBPIXEL_TOLERANCE_PX = 1;

/** Entirely inside the window: neither clipped by an edge nor scrolled out of sight. */
export function expectInWindow($element: JQuery): void {
  const element = elementOf($element);
  const box = element.getBoundingClientRect();
  const page = element.ownerDocument.documentElement;
  const [minimum, maximumX, maximumY] = [
    -SUBPIXEL_TOLERANCE_PX,
    page.clientWidth + SUBPIXEL_TOLERANCE_PX,
    page.clientHeight + SUBPIXEL_TOLERANCE_PX,
  ];
  expect(box.left, `${element.tagName} left edge`).to.be.at.least(minimum);
  expect(box.top, `${element.tagName} top edge`).to.be.at.least(minimum);
  expect(box.right, `${element.tagName} right edge`).to.be.at.most(maximumX);
  expect(box.bottom, `${element.tagName} bottom edge`).to.be.at.most(maximumY);
}
