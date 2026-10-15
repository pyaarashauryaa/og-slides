// Pure helper (unit-tested): what to do when a toast is asked for while an identical one is on screen.
// Identical text+kind refreshes the existing toast instead of stacking a copy ("flood protection").
export function mergeToast(items, next, max = 4) {
  const same = items.find((t) => t.text === next.text && t.kind === next.kind);
  if (same) return { items: items.map((t) => (t === same ? { ...t, count: (t.count || 1) + 1, bump: (t.bump || 0) + 1 } : t)), id: same.id, refreshed: true };
  return { items: [...items.slice(-(max - 1)), { ...next, count: 1, bump: 0 }], id: next.id, refreshed: false };
}

