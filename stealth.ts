/*
Captcha prevention engine for NitroSniper.
Humanizes claim timing, enforces velocity budgets, backs off on captcha signals,
and pre-validates codes so dead baits never touch the redeem endpoint.
*/

import { Logger } from "@utils/Logger";
import { Constants, RestAPI } from "@webpack/common";

import { settings } from "./settings";
import { isCaptchaResponse, type GiftCodeResolution } from "./types";

const logger = new Logger("NitroSniper:Stealth");

export const stealthState = {
    lastClaimAt: 0,
    claimTimestamps: [] as number[],
    lastCaptchaAt: 0,
    captchaCount: 0
};

function randomBetween(min: number, max: number) {
    return min + Math.random() * (max - min);
}

export function resetStealthState() {
    stealthState.lastClaimAt = 0;
    stealthState.claimTimestamps = [];
    stealthState.lastCaptchaAt = 0;
    stealthState.captchaCount = 0;
}

/**
 * Humanized reaction delay before claiming.
 * Randomized within [minDelayMs, maxDelayMs], scaled up by recent claim velocity.
 */
export async function humanizedClaimDelay(): Promise<number> {
    const min = Math.max(0, settings.store.stealthMinDelayMs);
    const max = Math.max(min, settings.store.stealthMaxDelayMs);

    let delay = randomBetween(min, max);

    // Recent claims stack extra wait: each claim in the last 5 minutes adds 25%
    const recentCount = countRecentClaims(5 * 60 * 1000);
    delay *= 1 + recentCount * 0.25;

    // Active captcha backoff multiplies delay
    delay *= captchaBackoffMultiplier();

    if (delay > 0) {
        logger.log(`Humanizing claim: waiting ${Math.round(delay)}ms before redeem`);
        await sleep(delay);
    }
    return delay;
}

function sleep(ms: number) {
    return new Promise<void>(resolve => setTimeout(resolve, ms));
}

function countRecentClaims(windowMs: number) {
    const cutoff = Date.now() - windowMs;
    stealthState.claimTimestamps = stealthState.claimTimestamps.filter(ts => ts > cutoff);
    return stealthState.claimTimestamps.length;
}

/**
 * Record a claim attempt for velocity budgeting.
 */
export function recordClaimAttempt() {
    stealthState.lastClaimAt = Date.now();
    stealthState.claimTimestamps.push(stealthState.lastClaimAt);
    if (stealthState.claimTimestamps.length > 200) {
        stealthState.claimTimestamps = stealthState.claimTimestamps.slice(-100);
    }
}

/**
 * Record a captcha/risk signal and enter backoff.
 */
export function recordCaptchaSignal(source: string) {
    stealthState.lastCaptchaAt = Date.now();
    stealthState.captchaCount += 1;
    const minutes = Math.min(120, captchaCooldownMinutes() * stealthState.captchaCount);
    logger.warn(`Captcha signal from ${source} (#${stealthState.captchaCount}). Backing off claims for ~${minutes}m.`);
}

/**
 * Multiplier applied to claim delays while in captcha backoff.
 * 1.0 when idle, up to 3x while cooling down.
 */
export function captchaBackoffMultiplier(): number {
    if (!settings.store.captchaPrevention) return 1;
    const cooldownMs = captchaCooldownMinutes() * 60 * 1000;
    if (stealthState.lastCaptchaAt === 0 || cooldownMs === 0) return 1;

    const elapsed = Date.now() - stealthState.lastCaptchaAt;
    if (elapsed >= cooldownMs) return 1;

    const remaining = 1 - elapsed / cooldownMs; // 1 -> 0
    return 1 + remaining * 2; // 3x at start, decaying to 1x
}

function captchaCooldownMinutes(): number {
    return Math.max(0, settings.store.captchaBackoffMinutes);
}

/**
 * Velocity gate: is claiming allowed right now?
 * Blocks while in hard captcha cooldown, or over hourly/daily budgets.
 */
export function canClaimNow(): { allowed: boolean; reason?: string; retryInMs?: number } {
    if (!settings.store.captchaPrevention) return { allowed: true };

    // Hard cooldown after captcha signal
    const cooldownMs = captchaCooldownMinutes() * 60 * 1000;
    if (stealthState.lastCaptchaAt !== 0 && cooldownMs > 0) {
        const elapsed = Date.now() - stealthState.lastCaptchaAt;
        if (elapsed < cooldownMs) {
            return {
                allowed: false,
                reason: "captcha cooldown",
                retryInMs: cooldownMs - elapsed
            };
        }
    }

    // Hourly budget
    const maxHourly = Math.max(0, settings.store.maxClaimsPerHour);
    if (maxHourly > 0 && countRecentClaims(60 * 60 * 1000) >= maxHourly) {
        return { allowed: false, reason: `hourly budget (${maxHourly}) reached`, retryInMs: 10 * 60 * 1000 };
    }

    // Daily budget
    const maxDaily = Math.max(0, settings.store.maxClaimsPerDay);
    if (maxDaily > 0 && countRecentClaims(24 * 60 * 60 * 1000) >= maxDaily) {
        return { allowed: false, reason: `daily budget (${maxDaily}) reached`, retryInMs: 60 * 60 * 1000 };
    }

    // Per-claim cooldown
    const claimGapMs = Math.max(0, settings.store.claimCooldownSeconds) * 1000;
    if (claimGapMs > 0 && stealthState.lastClaimAt !== 0) {
        const elapsed = Date.now() - stealthState.lastClaimAt;
        if (elapsed < claimGapMs) {
            return {
                allowed: false,
                reason: "claim cooldown",
                retryInMs: claimGapMs - elapsed
            };
        }
    }

    return { allowed: true };
}

/**
 * Pre-validate a gift code through the read-only resolve endpoint.
 * Dead/invalid/bait codes are filtered before any redeem attempt,
 * so only real gifts ever touch the flag-prone redeem endpoint.
 * Returns true when the code looks redeemable (or validation is disabled/unavailable).
 */
export async function preValidateCode(code: string): Promise<boolean> {
    if (!settings.store.preValidateCodes) return true;

    try {
        const response: { body: GiftCodeResolution & { code?: number; message?: string; uses?: number; max_uses?: number; }; } = await RestAPI.get({
            url: Constants.Endpoints.GIFT_CODE_RESOLVE(code),
            query: {
                with_application: false,
                with_subscription_plan: true
            },
            oldFormErrors: true
        }).catch(() => ({ body: {} as GiftCodeResolution }));

        const body = response.body ?? {};
        if (body.code === 10038 || /unknown_gift_code/i.test(body.message ?? "")) {
            logger.log(`Pre-validation rejected dead code ${code}`);
            return false;
        }

        if (typeof body.uses === "number" && typeof body.max_uses === "number" && body.uses >= body.max_uses) {
            logger.log(`Pre-validation rejected exhausted code ${code} (${body.uses}/${body.max_uses})`);
            return false;
        }

        return true;
    } catch {
        // Resolve endpoint unreachable — don't block the claim on this
        return true;
    }
}

export { isCaptchaResponse };
