/*
Made with ❤️ by neoarz
I am not responsible for any damage caused by this plugin; use at your own risk
Vencord does not endorse/support this plugin (Works with Equicord as well)
dm @neoarz if u need help or have any questions
https://github.com/neoarz/NitroSniper
*/

import type { PluginNative } from "@utils/types";

import type {
    ClaimRequest,
    ClaimResult,
    WebhookEmbed,
    WebhookField,
    WebhookPayload,
    WebhookResult
} from "./types";

const BLURPLE_COLOR = 0x5865f2;
const SUCCESS_COLOR = 0x43b581;
const WEBHOOK_NAME = "NitroSniper";

function parseWebhookUrl(webhookUrl: string) {
    const trimmed = webhookUrl.trim();
    if (!trimmed) return null;

    try {
        return new URL(trimmed);
    } catch {
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

function createPayload(embeds: WebhookEmbed[], content?: string): WebhookPayload {
    return {
        content,
        username: WEBHOOK_NAME,
        embeds,
        allowed_mentions: {
            parse: []
        }
    };
}

function buildMessageUrl(request: ClaimRequest) {
    if (!request.channelId || !request.messageId) return null;

    return `https://discord.com/channels/${request.guildId ?? "@me"}/${request.channelId}/${request.messageId}`;
}

function buildClaimFields(request: ClaimRequest, claimResult?: ClaimResult): WebhookField[] {
    const fields: WebhookField[] = [];

    // 1. Code (inline: true)
    fields.push({
        name: "Code",
        value: `\`${request.code}\``,
        inline: true
    });

    // 2. Link (inline: true)
    fields.push({
        name: "Link",
        value: `[Claim Link](https://discord.gift/${request.code})`,
        inline: true
    });

    // 3. Detected By (Alt) or (Main) (inline: false)
    const detectedName = request.detectedBy ?? "Unknown";
    const detectedTitle = request.isAlt ? "Detected By (Alt)" : "Detected By (Main)";
    const detectedValue = request.detectedById
        ? `${detectedName} ( \`${request.detectedById}\` )`
        : detectedName;

    fields.push({
        name: detectedTitle,
        value: detectedValue,
        inline: false
    });

    // 4. Server (inline: true)
    const serverName = request.guildName ?? (request.guildId ? "Unknown Server" : "Direct Messages");
    const serverValue = request.guildId
        ? `${serverName} ( \`${request.guildId}\` )`
        : serverName;

    fields.push({
        name: "Server",
        value: serverValue,
        inline: true
    });

    // 5. Channel (inline: true)
    const rawChan = request.channelName ?? (request.guildId ? "channel" : "Direct Messages");
    const cleanChan = rawChan.startsWith("#") ? rawChan : `#${rawChan}`;
    const channelValue = request.channelId
        ? `${cleanChan} ( \`${request.channelId}\` )`
        : cleanChan;

    fields.push({
        name: "Channel",
        value: channelValue,
        inline: true
    });

    // 6. Sender (inline: false)
    const senderName = request.authorUsername ?? request.authorName ?? "Unknown";
    const senderValue = request.authorId
        ? `${senderName} ( \`${request.authorId}\` )`
        : senderName;

    fields.push({
        name: "Sender",
        value: senderValue,
        inline: false
    });

    // 7. Message Link (inline: true)
    const messageUrl = buildMessageUrl(request);
    fields.push({
        name: "Message Link",
        value: messageUrl ? `[Jump to Message](${messageUrl})` : "None",
        inline: true
    });

    // 8. Delay (inline: true)
    const delay = claimResult?.elapsedMs ?? (request.detectedAt ? Math.max(1, Date.now() - request.detectedAt) : undefined);
    fields.push({
        name: "Delay",
        value: typeof delay === "number" ? `\`${delay}ms\`` : "`Unknown`",
        inline: true
    });

    // 9. If claimed, show Claimed on
    if (claimResult?.success && claimResult.claimedBy) {
        fields.push({
            name: "Claimed on",
            value: claimResult.claimedBy,
            inline: false
        });
    }

    return fields;
}

function buildClaimEmbed(
    result: WebhookResult,
    request: ClaimRequest,
    claimResult?: ClaimResult
): WebhookEmbed {
    return {
        author: {
            name: "🎁 Discord Gift Detected!",
            icon_url: request.guildIconUrl
        },
        color: result === "claimed" ? SUCCESS_COLOR : BLURPLE_COLOR,
        fields: buildClaimFields(request, claimResult)
    };
}

function buildTestWebhookPayload(): WebhookPayload {
    const testRequest: ClaimRequest = {
        code: "vhnuzeE2YkNCZ7sfYHHKebKXB",
        authorId: "1286955963508850719",
        authorUsername: "cr_a_s_h",
        channelId: "731254148678549595",
        channelName: "lounge",
        guildId: "505974446914535426",
        guildName: "Socialize | Active VC Server • Hangout • Voice Chat • Call • Social • Chill • Anime • Memes • Emojis",
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

    return createPayload(
        [buildClaimEmbed("failed", testRequest, testClaimResult)],
        `https://discord.gift/${testRequest.code}`
    );
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

async function postWebhook(url: URL, payload: WebhookPayload) {
    const { status, data } = await getNative().sendWebhook(url.toString(), JSON.stringify(payload));

    if (status < 200 || status >= 300) {
        throw new Error(parseWebhookError(data, status));
    }
}

export async function sendClaimWebhook(
    webhookUrl: string,
    result: WebhookResult,
    request: ClaimRequest,
    _giftType?: string | null,
    claimResult?: ClaimResult
) {
    const url = parseWebhookUrl(webhookUrl);
    if (!url) return;

    const content = `https://discord.gift/${request.code}`;
    await postWebhook(url, createPayload([buildClaimEmbed(result, request, claimResult)], content));
}

export async function sendTestWebhook(webhookUrl: string) {
    const url = parseWebhookUrl(webhookUrl);
    if (!url) {
        throw new Error("Webhook URL is empty.");
    }

    await postWebhook(url, buildTestWebhookPayload());
}
