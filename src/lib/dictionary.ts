/**
 * Returns a string-keyed map without a prototype, holding a copy of `source`. External keys such
 * as `__proto__`, `constructor` or `toString` are then ordinary entries: they cannot resolve to
 * inherited values or replace the prototype on assignment.
 */
export function createDictionary<Value>(
  source: Readonly<Record<string, Value>> = {},
): Record<string, Value> {
  const dictionary: Record<string, Value> = {};
  Object.setPrototypeOf(dictionary, null);
  return Object.assign(dictionary, source);
}
