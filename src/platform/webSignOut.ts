/** Native has no web session — hook returns null so Settings hides the button. */
export function useWebSignOut(): (() => Promise<void>) | null {
  return null;
}
