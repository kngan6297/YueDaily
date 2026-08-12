/** Resolve extensionless relative imports to .ts for Node's native test runner. */
export async function resolve(specifier, context, nextResolve) {
  if (
    (specifier.startsWith('./') || specifier.startsWith('../')) &&
    !/\.(?:ts|js|json|node|mjs|cjs)$/.test(specifier)
  ) {
    return nextResolve(specifier + '.ts', context);
  }
  return nextResolve(specifier, context);
}
