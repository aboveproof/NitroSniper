/*
Made with ❤️ by neoarz & rico
I am not responsible for any damage caused by this plugin; use at your own risk
Vencord does not endorse/support this plugin (Works with Equicord as well)
dm @neoarz if u need help or have any questions
https://github.com/neoarz/NitroSniper
*/

import { Logger } from "@utils/Logger";
import type { PluginNative } from "@utils/types";
import { findByPropsLazy } from "@webpack";
import { AuthenticationStore, UserStore } from "@webpack/common";

import { resolveGiftType } from "./giftCode";
import { settings } from "./settings";
import {
    ClaimAttempt,
    ClaimRequest,
    ClaimResult,
    NativeApiResponse,
    RedeemStrategy,
    SniperToken,
    TokenValidationResult
} from "./types";

const logger = new Logger("NitroSniper:Redeemer");
const GiftActions = findByPropsLazy("redeemGiftCode");

function getNative() {
    return (globalThis as any).VencordNative?.pluginHelpers?.NitroSniper as PluginNative<typeof import("./native")> | undefined;
}

interface SingleRedeemResult {
    success: boolean;
    tokenLabel: string;
    alreadyHasSubscription?: boolean;
    codeExhaustedOrInvalid?: boolean;
    error?: string;
}

function parseTokenError(status: number, data: string): { message: string; alreadyHasSub: boolean; codeExhausted: boolean; } {
    try {
        const parsed = JSON.parse(data) as { code?: number; message?: string; };
        const code = parsed.code;
        const msg = parsed.message ?? `HTTP ${status}`;

        // 50050: USER_ALREADY_HAS_SUBSCRIPTION
        // 50070: PAYMENT_SOURCE_REQUIRED
        const alreadyHasSub = code === 50050 || /already\s*(has|have)/i.test(msg);

        // 10038: UNKNOWN_GIFT_CODE
        // 50051: PAYMENT_SOURCE_ALREADY_ATTACHED
        const codeExhausted = code === 10038 || /unknown|claimed|redeemed|invalid/i.test(msg);

        return { message: msg, alreadyHasSub, codeExhausted };
    } catch {
        const msg = data || `HTTP ${status}`;
        return {
            message: msg,
            alreadyHasSub: /already\s*(has|have)/i.test(msg),
            codeExhausted: /unknown|claimed|redeemed|invalid/i.test(msg)
        };
    }
}

export function getUserIdFromToken(token: string): string | null {
    try {
        const firstPart = token.trim().split(".")[0];
        if (!firstPart) return null;
        let decoded = "";
        if (typeof atob === "function") {
            decoded = atob(firstPart);
        } else if (typeof Buffer !== "undefined") {
            decoded = Buffer.from(firstPart, "base64").toString("utf-8");
        }
        if (/^\d{17,20}$/.test(decoded)) {
            return decoded;
        }
        return null;
    } catch {
        return null;
    }
}

export function getDefaultAvatarUrl(userId?: string | null): string {
    if (!userId) return "https://cdn.discordapp.com/embed/avatars/0.png";
    try {
        const index = Number((BigInt(userId) >> 22n) % 6n);
        return `https://cdn.discordapp.com/embed/avatars/${Math.abs(index) % 6}.png`;
    } catch {
        return "https://cdn.discordapp.com/embed/avatars/0.png";
    }
}

export async function validateToken(tokenStr: string): Promise<TokenValidationResult> {
    const raw = tokenStr.trim();
    if (!raw) return { valid: false, error: "Empty token" };

    const native = getNative();
    let status = 0;
    let data = "";

    try {
        if (native?.validateUserToken) {
            const res = await native.validateUserToken(raw);
            status = res.status;
            data = res.data;
        } else {
            const res = await fetch("https://discord.com/api/v9/users/@me", {
                method: "GET",
                headers: {
                    "Authorization": raw,
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
                }
            });
            status = res.status;
            data = await res.text();
        }

        if (status >= 200 && status < 300) {
            const user = JSON.parse(data) as { id?: string; username?: string; global_name?: string; avatar?: string; };
            const fallbackId = user.id || getUserIdFromToken(raw);
            const avatarUrl = user.id && user.avatar
                ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128`
                : getDefaultAvatarUrl(fallbackId);

            return {
                valid: true,
                id: user.id || fallbackId || undefined,
                username: user.username,
                globalName: user.global_name,
                avatarUrl
            };
        } else {
            return {
                valid: false,
                error: `HTTP ${status}: ${data}`
            };
        }
    } catch (err) {
        return {
            valid: false,
            error: err instanceof Error ? err.message : String(err)
        };
    }
}

async function redeemViaToken(token: SniperToken, code: string, channelId?: string): Promise<SingleRedeemResult> {
    const label = token.label || token.username || `Token (${token.id.slice(0, 6)})`;
    const cleanToken = token.token.trim();
    const native = getNative();

    let res: NativeApiResponse;

    try {
        if (native?.redeemGiftCode) {
            res = await native.redeemGiftCode(cleanToken, code, channelId);
        } else {
            const response = await fetch(`https://discord.com/api/v9/entitlements/gift-codes/${encodeURIComponent(code)}/redeem`, {
                method: "POST",
                headers: {
                    "Authorization": cleanToken,
                    "Content-Type": "application/json",
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
                },
                body: JSON.stringify({
                    channel_id: channelId ?? null,
                    payment_source_id: null
                })
            });

            res = {
                status: response.status,
                data: await response.text(),
                ok: response.ok
            };
        }

        if (res.ok || (res.status >= 200 && res.status < 300)) {
            return {
                success: true,
                tokenLabel: label
            };
        }

        const parsed = parseTokenError(res.status, res.data);
        return {
            success: false,
            tokenLabel: label,
            alreadyHasSubscription: parsed.alreadyHasSub,
            codeExhaustedOrInvalid: parsed.codeExhausted,
            error: parsed.message
        };
    } catch (error) {
        return {
            success: false,
            tokenLabel: label,
            error: error instanceof Error ? error.message : String(error)
        };
    }
}

async function redeemViaCurrentAccount(code: string, channelId?: string): Promise<SingleRedeemResult> {
    const currentUser = UserStore.getCurrentUser();
    const label = currentUser ? `Current Account (${currentUser.username})` : "Current Account";

    // If GiftActions is available, use Discord's native redeem flow
    if (GiftActions?.redeemGiftCode) {
        return new Promise(resolve => {
            GiftActions.redeemGiftCode({
                code,
                onRedeemed: () => {
                    resolve({
                        success: true,
                        tokenLabel: label
                    });
                },
                onError: (error: any) => {
                    const status = error?.status ?? error?.body?.status ?? 400;
                    const data = typeof error?.body === "string"
                        ? error.body
                        : JSON.stringify(error?.body ?? { message: error?.message ?? String(error) });
                    const parsed = parseTokenError(status, data);

                    resolve({
                        success: false,
                        tokenLabel: label,
                        alreadyHasSubscription: parsed.alreadyHasSub,
                        codeExhaustedOrInvalid: parsed.codeExhausted,
                        error: parsed.message
                    });
                }
            });
        });
    }

    // Fallback: If current token is available from AuthenticationStore
    const currentToken = (AuthenticationStore as any)?.getToken?.() as string | undefined;
    if (currentToken) {
        const dummyToken: SniperToken = {
            id: "current",
            token: currentToken,
            label,
            enabled: true
        };
        return redeemViaToken(dummyToken, code, channelId);
    }

    return {
        success: false,
        tokenLabel: label,
        error: "Current account token or GiftActions unavailable"
    };
}

export async function executeRedeem(request: ClaimRequest): Promise<ClaimResult> {
    const startTime = request.detectedAt ?? Date.now();
    const strategy = (settings.store.redeemStrategy ?? RedeemStrategy.CURRENT_FIRST) as RedeemStrategy;
    const tokens: SniperToken[] = (settings.store.tokens ?? []).filter((t: SniperToken) => t.enabled && t.token.trim().length > 0);

    const attempts: ClaimAttempt[] = [];
    const giftTypePromise = settings.store.webhookUrl.trim() ? resolveGiftType(request.code) : Promise.resolve(null);

    logger.log(`Executing redeem for code [${request.code}] using strategy: ${strategy}`);

    // Helper to record attempt
    const recordAttempt = (res: SingleRedeemResult) => {
        attempts.push({
            tokenLabel: res.tokenLabel,
            success: res.success,
            error: res.error
        });
        if (res.success) {
            logger.log(`Successfully redeemed [${request.code}] with [${res.tokenLabel}]`);
        } else {
            logger.warn(`Failed redeem [${request.code}] with [${res.tokenLabel}]: ${res.error}`);
        }
    };

    if (strategy === RedeemStrategy.RACE) {
        // Race mode: Attempt all enabled tokens + current account concurrently
        const targets: Array<() => Promise<SingleRedeemResult>> = [];

        targets.push(() => redeemViaCurrentAccount(request.code, request.channelId));
        for (const token of tokens) {
            targets.push(() => redeemViaToken(token, request.code, request.channelId));
        }

        const results = await Promise.all(targets.map(fn => fn()));
        const elapsedMs = Math.max(1, Date.now() - startTime);
        for (const res of results) {
            recordAttempt(res);
        }

        const successful = results.find(r => r.success);
        const giftType = await giftTypePromise;
        return {
            success: Boolean(successful),
            claimedBy: successful?.tokenLabel,
            giftType,
            elapsedMs,
            attempts
        };
    }

    // Sequential strategies
    const sequence: Array<() => Promise<SingleRedeemResult>> = [];

    if (strategy === RedeemStrategy.CURRENT_FIRST) {
        sequence.push(() => redeemViaCurrentAccount(request.code, request.channelId));
        for (const token of tokens) {
            sequence.push(() => redeemViaToken(token, request.code, request.channelId));
        }
    } else if (strategy === RedeemStrategy.ALTS_FIRST) {
        for (const token of tokens) {
            sequence.push(() => redeemViaToken(token, request.code, request.channelId));
        }
        sequence.push(() => redeemViaCurrentAccount(request.code, request.channelId));
    } else if (strategy === RedeemStrategy.ALTS_ONLY) {
        for (const token of tokens) {
            sequence.push(() => redeemViaToken(token, request.code, request.channelId));
        }
    } else if (strategy === RedeemStrategy.CURRENT_ONLY) {
        sequence.push(() => redeemViaCurrentAccount(request.code, request.channelId));
    }

    for (const step of sequence) {
        const result = await step();
        recordAttempt(result);

        if (result.success) {
            const elapsedMs = Math.max(1, Date.now() - startTime);
            const giftType = await giftTypePromise;
            return {
                success: true,
                claimedBy: result.tokenLabel,
                giftType,
                elapsedMs,
                attempts
            };
        }

        // If the code is already claimed by someone else or completely invalid, stop trying further tokens
        if (result.codeExhaustedOrInvalid) {
            logger.warn(`Gift code [${request.code}] was already claimed or invalid. Aborting further attempts.`);
            break;
        }

        // Otherwise, if already has subscription or general error, continue to next token in sequence
    }

    const elapsedMs = Math.max(1, Date.now() - startTime);
    const giftType = await giftTypePromise;
    return {
        success: false,
        giftType,
        elapsedMs,
        attempts
    };
}
