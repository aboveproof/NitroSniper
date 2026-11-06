/*
Persistent claim statistics for NitroSniper.
Tracks detected / attempted / claimed / failed counts plus per-account wins.
Persisted as a hidden setting so they survive restarts.
*/

import type { ClaimResult } from "./types";

export interface ClaimStats {
    detected: number;
    attempted: number;
    claimed: number;
    failed: number;
    claimedByAccount: Record<string, number>;
    lastClaimAt: number;
    firstClaimAt: number;
}

export const emptyStats: ClaimStats = {
    detected: 0,
    attempted: 0,
    claimed: 0,
    failed: 0,
    claimedByAccount: {},
    lastClaimAt: 0,
    firstClaimAt: 0
};

type StatsStore = { claimStats?: ClaimStats | null; };

export function getStats(store: StatsStore): ClaimStats {
    return { ...emptyStats, ...(store.claimStats ?? {}) };
}

export function recordDetected(store: StatsStore) {
    const s = getStats(store);
    s.detected += 1;
    store.claimStats = s;
}

export function recordResult(store: StatsStore, result: ClaimResult) {
    const s = getStats(store);
    s.attempted += 1;
    if (result.success) {
        s.claimed += 1;
        if (s.firstClaimAt === 0) s.firstClaimAt = Date.now();
        s.lastClaimAt = Date.now();
        const account = result.claimedBy ?? "Unknown";
        s.claimedByAccount[account] = (s.claimedByAccount[account] ?? 0) + 1;
    } else {
        s.failed += 1;
    }
    store.claimStats = s;
}

export function resetStats(store: StatsStore) {
    store.claimStats = { ...emptyStats };
}

/** "3 claimed out of 10 attempts (5 detected)" style summary line */
export function statsSummary(stats: ClaimStats): string {
    return `${stats.claimed} claimed out of ${stats.attempted} attempts (${stats.detected} detected)`;
}

/** Hit-rate percentage, null when no attempts yet */
export function hitRate(stats: ClaimStats): number | null {
    if (stats.attempted === 0) return null;
    return Math.round((stats.claimed / stats.attempted) * 100);
}

/** Top claiming accounts sorted by wins */
export function topAccounts(stats: ClaimStats, limit = 5): Array<{ account: string; wins: number; }> {
    return Object.entries(stats.claimedByAccount ?? {})
        .map(([account, wins]) => ({ account, wins }))
        .sort((a, b) => b.wins - a.wins)
        .slice(0, limit);
}
