/** Source of `cachesToDelete(names)`: every cache name except those starting with a preserved prefix. */
export function cachesToDeleteSource(preservedPrefixes: readonly string[]): string {
  return `const PRESERVED_CACHE_PREFIXES = ${JSON.stringify(preservedPrefixes)};
  const cachesToDelete = function (names) {
    return names.filter(function (name) {
      return !PRESERVED_CACHE_PREFIXES.some(function (prefix) { return name.indexOf(prefix) === 0; });
    });
  };`;
}
