/** Fix both inputs so examples can be replayed without relying on today's date. */
export const runOptions = { seed: 42, now: '2026-01-01T00:00:00Z', check: 'schema' } as const;
