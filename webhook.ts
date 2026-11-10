/*
Made with ❤️ by neoarz & rico
I am not responsible for any damage caused by this plugin; use at your own risk
Vencord does not endorse/support this plugin (Works with Equicord as well)
dm @neoarz if u need help or have any questions
https://github.com/neoarz/NitroSniper
*/

import type { PluginNative } from "@utils/types";

import { getStats, hitRate, statsSummary } from "./stats";
import type {
    ClaimRequest,
    ClaimResult,
    V2Button,
    V2Container,
    V2Payload,
    V2Section,
    V2TextDisplay,
    V2Thumbnail,
    WebhookResult
} from "./types";

const BLURPLE_COLOR = 0x5865f2;
const SUCCESS_COLOR = 0x43b581;
const WEBHOOK_NAME = "NitroSniper";
const IS_COMPONENTS_V2 = 1 << 15;

const ALLOWED_WEBHOOK_ORIGINS = new Set(["https://discord.com", "https://discordapp.com"]);

function parseWebhookUrl(webhookUrl: string) {
    const trimmed = webhookUrl.trim();
    if (!trimmed) return null;

    try {
        const url = new URL(trimmed);
        if (!ALLOWED_WEBHOOK_ORIGINS.has(url.origin)) {
            throw new Error("Webhook URL must point to discord.com or discordapp.com.");
        }
        return url;
    } catch (e) {
        if (e instanceof Error && e.message.includes("discord.com")) throw e;
        throw new Error("Webhook URL is invalid.");
    }
}

function getNative() {
    const native = (globalThis as any).VencordNative?.pluginHelpers?.NitroSniper as PluginNative<typeof import("./native")> | undefined;
    if (!native) {
        throw new Error("Webhook sending requires desktop native support.");
    }

    return native;
}

function text(content: string): V2TextDisplay {
    return { type: 10, content };
}

function buildMessageUrl(request: ClaimRequest) {
    if (!request.channelId || !request.messageId) return null;
    return `https://discord.com/channels/${request.guildId ?? "@me"}/${request.channelId}/${request.messageId}`;
}

function buildClaimV2(
    result: WebhookResult,
    request: ClaimRequest,
    claimResult?: ClaimResult
): V2Payload {
    const claimed = result === "claimed";
    const stats = getStats();
    const rate = hitRate(stats);

    const serverName = request.guildName ?? (request.guildId ? "Unknown server" : "Direct Messages");
    const rawChan = request.channelName ?? (request.guildId ? "channel" : "DMs");
    const channelLabel = rawChan.startsWith("#") ? rawChan : `#${rawChan}`;
    const channelUrl = request.channelId
        ? `https://discord.com/channels/${request.guildId ?? "@me"}/${request.channelId}`
        : null;
    const senderMention = request.authorId ? `<@${request.authorId}>` : "unknown";
    const spotterMention = request.detectedById ? `<@${request.detectedById}>` : (request.detectedBy ?? "unknown");
    const delay = claimResult?.elapsedMs ?? (request.detectedAt ? Math.max(1, Date.now() - request.detectedAt) : null);
    const messageUrl = buildMessageUrl(request);

    const headerText = claimed
        ? `## 🎁 Claimed a gift code\n\`${request.code}\` landed on \`${claimResult?.claimedBy ?? "an account"}\``
        : `## 🎁 Gift code missed\n\`${request.code}\` slipped away`;

    const detailLines = [
        `Server: \`${serverName}\``,
        channelUrl
            ? `Channel: [#${channelLabel.replace("#", "")}](${channelUrl}) (\`${request.channelId}\`)`
            : `Channel: \`${channelLabel}\``,
        `Sender: ${senderMention}${request.authorId ? ` (\`${request.authorId}\`)` : ""}`,
        `Spotted by: ${spotterMention}${request.isAlt ? " (alt)" : " (main)"}${request.detectedById ? ` (\`${request.detectedById}\`)` : ""}`,
        `Delay: \`${delay != null ? `${delay}ms` : "unknown"}\``,
        `Lifetime: \`${statsSummary(stats)}${rate != null ? ` (${rate}%)` : ""}\``
    ];

    const headerBlock: V2Section | V2TextDisplay = request.guildIconUrl
        ? {
            type: 9,
            components: [text(headerText)],
            accessory: {
                type: 11,
                media: { url: request.guildIconUrl }
            }
        }
        : text(headerText);

    const container: V2Container = {
        type: 17,
        accent_color: claimed ? SUCCESS_COLOR : BLURPLE_COLOR,
        components: [
            headerBlock,
            { type: 14, spacing: 1, divider: true },
            text(detailLines.join("\n")),
            { type: 14, spacing: 1, divider: true },
            {
                type: 1,
                components: [
                    {
                        type: 2,
                        style: 5,
                        label: "Open gift page",
                        url: `https://discord.gift/${request.code}`
                    } as V2Button,
                    ...(messageUrl
                        ? [{
                            type: 2,
                            style: 5,
                            label: "Jump to message",
                            url: messageUrl
                        } as V2Button]
                        : [])
                ]
            },
            text(`-# ${stats.claimed} claimed / ${stats.attempted} attempted`)
        ]
    };

    return {
        username: WEBHOOK_NAME,
        flags: IS_COMPONENTS_V2,
        // gift link sits above the container
        components: [
            text(`https://discord.gift/${request.code}`),
            container
        ],
        allowed_mentions: { parse: [] }
    };
}

function buildTestPayload(): V2Payload {
    const testRequest: ClaimRequest = {
        code: "vhnuzeE2YkNCZ7sfYHHKebKXB",
        authorId: "1286955963508850719",
        authorUsername: "cr_a_s_h",
        channelId: "731254148678549595",
        channelName: "lounge",
        guildId: "505974446914535426",
        guildName: "Socialize",
        guildIconUrl: "https://cdn.discordapp.com/icons/1181008820433068042/b0b48a4bfc0aa5f73018ceda9178c103.png?size=128",
        messageId: "1361736124858630274",
        detectedBy: "wkcp",
        detectedById: "1154222789409509459",
        isAlt: true,
        detectedAt: Date.now() - 142
    };

    const testClaimResult: ClaimResult = {
        success: false,
        elapsedMs: 142,
        attempts: []
    };

    return buildClaimV2("failed", testRequest, testClaimResult);
}

function parseWebhookError(data: string, status: number) {
    if (!data) {
        return `Webhook request failed with status ${status}.`;
    }

    try {
        const body = JSON.parse(data) as { message?: string; errors?: unknown; };
        const detail = [
            body.message,
            body.errors ? JSON.stringify(body.errors) : null
        ]
            .filter(Boolean)
            .join(" ");

        return detail
            ? `Webhook request failed with status ${status}: ${detail}`
            : `Webhook request failed with status ${status}.`;
    } catch {
        return `Webhook request failed with status ${status}: ${data}`;
    }
}

async function postWebhook(url: URL, payload: V2Payload) {
    const { status, data } = await getNative().sendWebhook(url.toString(), JSON.stringify(payload));

    if (status < 200 || status >= 300) {
        throw new Error(parseWebhookError(data, status));
    }
}

const sentCodes = new Set<string>();

export async function sendClaimWebhook(
    webhookUrl: string,
    result: WebhookResult,
    request: ClaimRequest,
    _giftType?: string | null,
    claimResult?: ClaimResult
) {
    const url = parseWebhookUrl(webhookUrl);
    if (!url) return;

    // one webhook per code per session, even if the claim result fires twice
    if (sentCodes.has(request.code)) return;
    sentCodes.add(request.code);
    if (sentCodes.size > 500) {
        const [first] = sentCodes;
        sentCodes.delete(first);
    }

    await postWebhook(url, buildClaimV2(result, request, claimResult));
}

export async function sendTestWebhook(webhookUrl: string) {
    const url = parseWebhookUrl(webhookUrl);
    if (!url) {
        throw new Error("Webhook URL is empty.");
    }

    await postWebhook(url, buildTestPayload());
}
