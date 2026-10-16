/**
 * Mirror the server's status thresholds, but only to color meters. A node's status itself
 * always comes from the server and is never derived here.
 */
export const CPU_THRESHOLDS = { warning: 75, critical: 90 } as const;
export const MEMORY_THRESHOLDS = { warning: 80, critical: 92 } as const;
