/*
Claim statistics for NitroSniper.
In-memory only: writing stats through the plugin settings store triggered
a structured-clone IPC crash ("An object could not be cloned") that killed
the claim handler mid-detection. Stats now live in module memory.
*/

import * as DataStore from "@api/DataStore";

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

const STORE_KEY = "NitroSniper_stats";

const stats: ClaimStats = { ...emptyStats };
let loaded = false;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

function ensureLoaded() {
    if (loaded) return;
    loaded = true;
    void DataStore.get<ClaimStats>(STORE_KEY).then(saved => {
        if (saved) {
            Object.assign(stats, emptyStats, saved, {
                claimedByAccount: { ...(saved.claimedByAccount ?? {}) }
            });
            notify();
        }
    }).catch(() => { /* stats are optional */ });
}

function notify() {
    for (const fn of listeners) {
        try { fn(); } catch { /* listener errors must not kill claims */ }
    }
}

function scheduleSave() {
    if (saveTimer !== null) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
        saveTimer = null;
        void DataStore.set(STORE_KEY, { ...stats, claimedByAccount: { ...stats.claimedByAccount } }).catch(() => { });
    }, 2000);
}

export function subscribeStats(listener: () => void): () => void {
    ensureLoaded();
    listeners.add(listener);
    return () => listeners.delete(listener);
}

export function getStats(): ClaimStats {
    ensureLoaded();
    return stats;
}

export function recordDetected() {
    ensureLoaded();
    stats.detected += 1;
    scheduleSave();
}

export function recordResult(result: ClaimResult) {
    ensureLoaded();
    stats.attempted += 1;
    if (result.success) {
        stats.claimed += 1;
        if (stats.firstClaimAt === 0) stats.firstClaimAt = Date.now();
        stats.lastClaimAt = Date.now();
        const account = result.claimedBy ?? "Unknown";
        stats.claimedByAccount[account] = (stats.claimedByAccount[account] ?? 0) + 1;
    } else {
        stats.failed += 1;
    }
    scheduleSave();
    notify();
}

export function resetStats() {
    Object.assign(stats, emptyStats, { claimedByAccount: {} });
    void DataStore.set(STORE_KEY, stats).catch(() => { });
    notify();
}

/** "3 claimed out of 10 attempts (5 detected)" style summary line */
export function statsSummary(s: ClaimStats): string {
    return `${s.claimed} claimed out of ${s.attempted} attempts (${s.detected} detected)`;
}

/** Hit-rate percentage, null when no attempts yet */
export function hitRate(s: ClaimStats): number | null {
    if (s.attempted === 0) return null;
    return Math.round((s.claimed / s.attempted) * 100);
}

/** Top claiming accounts sorted by wins */
export function topAccounts(s: ClaimStats, limit = 5): Array<{ account: string; wins: number; }> {
    return Object.entries(s.claimedByAccount ?? {})
        .map(([account, wins]) => ({ account, wins }))
        .sort((a, b) => b.wins - a.wins)
        .slice(0, limit);
}
