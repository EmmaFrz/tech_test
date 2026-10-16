/** Remembers only the latest call; arguments are compared by identity. */
export function memoizeLast<Args extends readonly unknown[], Result>(
  compute: (...args: Args) => Result,
): (...args: Args) => Result {
  let last: { readonly args: Args; readonly result: Result } | null = null;

  return (...args) => {
    if (last !== null && last.args.every((argument, index) => Object.is(argument, args[index]))) {
      return last.result;
    }

    const result = compute(...args);
    last = { args, result };
    return result;
  };
}
