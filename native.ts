/*
Made with ❤️ by neoarz & rico
I am not responsible for any damage caused by this plugin; use at your own risk
Vencord does not endorse/support this plugin (Works with Equicord as well)
dm @neoarz if u need help or have any questions
https://github.com/neoarz/NitroSniper
*/

import { IpcMainInvokeEvent } from "electron";

import type { NativeApiResponse, NativeWebhookResponse } from "./types";

const DISCORD_API_BASE = "https://discord.com/api/v9";
const ALLOWED_WEBHOOK_ORIGINS = new Set(["https://discord.com", "https://discordapp.com"]);
const TOKEN_RE = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
const CODE_RE = /^[a-zA-Z0-9]{16,24}$/;
const CHANNEL_ID_RE = /^\d{17,20}$/;
const DEFAULT_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

/** Renderer args are untrusted: validate shape and reject control chars (CRLF header injection). */
function isHeaderSafe(value: unknown, maxLength = 1024): value is string {
    return typeof value === "string"
        && value.length <= maxLength
        && !/[\r\n\0]/.test(value);
}

function cleanHeader(value: unknown, max: number, fallback: string): string {
    if (!isHeaderSafe(value, max)) return fallback;
    return value;
}

export async function sendWebhook(_: IpcMainInvokeEvent, webhookUrl: string, payload: string): Promise<NativeWebhookResponse> {
    try {
        if (typeof webhookUrl !== "string" || typeof payload !== "string" || payload.length > 8192) {
            return { status: -1, data: "Invalid webhook request." };
        }

        const url = new URL(webhookUrl);
        if (!ALLOWED_WEBHOOK_ORIGINS.has(url.origin)) {
            return { status: -1, data: "Webhook URL must be a Discord webhook (discord.com / discordapp.com)." };
        }
        url.searchParams.set("wait", "true");

        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: payload,
            redirect: "error",
            signal: AbortSignal.timeout(15000)
        });

        return {
            status: response.status,
            data: await response.text()
        };
    } catch (error) {
        return {
            status: -1,
            data: error instanceof Error ? error.message : String(error)
        };
    }
}

export async function redeemGiftCode(
    _: IpcMainInvokeEvent,
    token: string,
    code: string,
    channelId?: string,
    superProperties?: string,
    userAgent?: string
): Promise<NativeApiResponse> {
    try {
        if (typeof token !== "string" || !TOKEN_RE.test(token)) {
            return { status: -1, data: "Invalid token format.", ok: false };
        }
        if (typeof code !== "string" || !CODE_RE.test(code)) {
            return { status: -1, data: "Invalid gift code format.", ok: false };
        }
        if (channelId !== undefined && channelId !== null && (typeof channelId !== "string" || !CHANNEL_ID_RE.test(channelId))) {
            channelId = undefined;
        }

        const url = `${DISCORD_API_BASE}/entitlements/gift-codes/${code}/redeem`;
        const headers: Record<string, string> = {
            "Authorization": token,
            "Content-Type": "application/json",
            "User-Agent": cleanHeader(userAgent, 300, DEFAULT_UA)
        };
        if (isHeaderSafe(superProperties, 512)) {
            headers["X-Super-Properties"] = superProperties;
        }

        const response = await fetch(url, {
            method: "POST",
            headers,
            body: JSON.stringify({
                channel_id: channelId ?? null,
                payment_source_id: null
            }),
            redirect: "error",
            signal: AbortSignal.timeout(15000)
        });

        return {
            status: response.status,
            data: await response.text(),
            ok: response.ok
        };
    } catch (error) {
        return {
            status: -1,
            data: error instanceof Error ? error.message : String(error),
            ok: false
        };
    }
}

export async function validateUserToken(
    _: IpcMainInvokeEvent,
    token: string,
    userAgent?: string
): Promise<NativeApiResponse> {
    try {
        if (typeof token !== "string" || !TOKEN_RE.test(token)) {
            return { status: -1, data: "Invalid token format.", ok: false };
        }

        const response = await fetch(`${DISCORD_API_BASE}/users/@me`, {
            method: "GET",
            headers: {
                "Authorization": token,
                "User-Agent": cleanHeader(userAgent, 300, DEFAULT_UA)
            },
            redirect: "error",
            signal: AbortSignal.timeout(15000)
        });

        return {
            status: response.status,
            data: await response.text(),
            ok: response.ok
        };
    } catch (error) {
        return {
            status: -1,
            data: error instanceof Error ? error.message : String(error),
            ok: false
        };
    }
}
