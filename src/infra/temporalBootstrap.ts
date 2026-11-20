/**
 * Ensure globalThis.Temporal is available before Temporal-dependent calendar code runs.
 * Loads temporal-polyfill only when native Temporal is unavailable.
 */
export async function ensureTemporal(): Promise<void> {
  if (typeof globalThis.Temporal !== 'undefined') return;
  const polyfill = await import('temporal-polyfill');
  globalThis.Temporal = polyfill.Temporal;
}
