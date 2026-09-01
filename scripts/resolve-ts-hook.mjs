/** Resolve extensionless relative imports to .ts or directory index.ts for Node's native test runner. */
export async function resolve(specifier, context, nextResolve) {
  if (
    (specifier.startsWith('./') || specifier.startsWith('../')) &&
    !/\.(?:ts|js|json|node|mjs|cjs)$/.test(specifier)
  ) {
    for (const candidate of [`${specifier}.ts`, `${specifier}/index.ts`]) {
      try {
        return await nextResolve(candidate, context);
      } catch {
        // try next candidate
      }
    }
  }
  return nextResolve(specifier, context);
}
