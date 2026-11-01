/*
Made with ❤️ by neoarz & rico
I am not responsible for any damage caused by this plugin; use at your own risk
Vencord does not endorse/support this plugin (Works with Equicord as well)
dm @neoarz if u need help or have any questions
https://github.com/neoarz/NitroSniper
*/

import { IpcMainInvokeEvent } from "electron";

import type { NativeApiResponse, NativeWebhookResponse } from "./types";

export async function sendWebhook(_: IpcMainInvokeEvent, webhookUrl: string, payload: string): Promise<NativeWebhookResponse> {
    try {
        const url = new URL(webhookUrl);
        url.searchParams.set("wait", "true");

        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: payload
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
        const cleanCode = code.trim();
        const url = `https://discord.com/api/v9/entitlements/gift-codes/${encodeURIComponent(cleanCode)}/redeem`;
        const headers: Record<string, string> = {
            "Authorization": token.trim(),
            "Content-Type": "application/json",
            "User-Agent": typeof userAgent === "string" && userAgent.length > 0
                ? userAgent.slice(0, 300)
                : "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
        };
        if (typeof superProperties === "string" && superProperties.length > 0) {
            headers["X-Super-Properties"] = superProperties.slice(0, 512);
        }

        const response = await fetch(url, {
            method: "POST",
            headers,
            body: JSON.stringify({
                channel_id: channelId ?? null,
                payment_source_id: null
            })
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
        const url = "https://discord.com/api/v9/users/@me";
        const headers: Record<string, string> = {
            "Authorization": token.trim(),
            "User-Agent": typeof userAgent === "string" && userAgent.length > 0
                ? userAgent.slice(0, 300)
                : "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
        };

        const response = await fetch(url, {
            method: "GET",
            headers
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

