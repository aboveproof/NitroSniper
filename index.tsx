/*
Made with ❤️ by neoarz
I am not responsible for any damage caused by this plugin; use at your own risk
Vencord does not endorse/support this plugin (Works with Equicord as well)
dm @neoarz if u need help or have any questions
https://github.com/neoarz/NitroSniper
*/

import { Logger } from "@utils/Logger";
import definePlugin from "@utils/types";
import { Message } from "@vencord/discord-types";
import { ChannelStore, GuildStore, UserStore } from "@webpack/common";

import { gatewayManager } from "./gateway";
import { executeRedeem } from "./redeemer";
import { settings } from "./settings";
import { cleanTokens, type ClaimRequest, type SniperToken } from "./types";
import { sendClaimWebhook } from "./webhook";

const GIFT_LINK_REGEX = /(?:discord\.gift\/|discord\.com\/gifts?\/)([a-zA-Z0-9]{16,24})/;

const logger = new Logger("NitroSniper");

let startTime = 0;
let claiming = false;
const claimQueue: ClaimRequest[] = [];
const seenCodes = new Set<string>();

function resetState() {
    startTime = Date.now();
    claimQueue.length = 0;
    seenCodes.clear();
    claiming = false;
}

function isOwnMessage(message: Message) {
    return message.author?.id === UserStore.getCurrentUser()?.id;
}

function shouldSkipMessage(message: Message) {
    return settings.store.ignoreOwnGiftLinks && isOwnMessage(message);
}

function isMessageOlderThanStart(message: Message) {
    return new Date(message.timestamp).getTime() < startTime;
}

function extractGiftCode(content: string) {
    return content.match(GIFT_LINK_REGEX)?.[1] ?? null;
}

function createClaimRequest(message: Message): ClaimRequest | null {
    const detectedAt = Date.now();
    const code = message.content ? extractGiftCode(message.content) : null;
    if (!code) return null;

    const authorId = message.author?.id;
    const authorAvatar = message.author?.avatar;
    const currentUser = UserStore.getCurrentUser();

    const channelId = message.channel_id;
    const channel = ChannelStore.getChannel(channelId);
    const guildId = (message as any).guild_id ?? channel?.guild_id;
    const guild = guildId ? GuildStore.getGuild(guildId) : undefined;

    const channelName = channel?.name ?? (guildId ? "channel" : "Direct Messages");
    const guildName = guild?.name ?? (guildId ? "Unknown Server" : "Direct Messages");
    const guildIcon = guild?.icon;
    const guildIconUrl = (guild as any)?.getIconURL?.(128)
        ?? (guildId && guildIcon ? `https://cdn.discordapp.com/icons/${guildId}/${guildIcon}.${guildIcon.startsWith("a_") ? "gif" : "png"}?size=128` : undefined);

    return {
        code,
        authorId,
        authorName: message.author?.globalName ?? message.author?.username,
        authorUsername: message.author?.username,
        authorAvatarUrl: authorId && authorAvatar
            ? `https://cdn.discordapp.com/avatars/${authorId}/${authorAvatar}.png?size=128`
            : undefined,
        channelId,
        channelName,
        guildId,
        guildName,
        guildIconUrl,
        messageId: message.id,
        detectedBy: currentUser?.username ?? "Main Account",
        detectedById: currentUser?.id,
        isAlt: false,
        detectedAt
    };
}

function handleIncomingClaimRequest(request: ClaimRequest) {
    if (seenCodes.has(request.code)) {
        logger.log(`Ignoring duplicate gift code: ${request.code}`);
        return;
    }

    seenCodes.add(request.code);
    if (seenCodes.size > 1000) {
        const [first] = seenCodes;
        seenCodes.delete(first);
    }

    claimQueue.push(request);
    void processQueue();
}

async function processQueue() {
    if (claiming) return;

    const request = claimQueue.shift();
    if (!request) return;

    claiming = true;

    try {
        const result = await executeRedeem(request);

        if (result.success) {
            logger.log(`Successfully redeemed code: ${request.code} on ${result.claimedBy ?? "Unknown Account"}`);
            void sendClaimWebhook(
                settings.store.webhookUrl,
                "claimed",
                request,
                result.giftType ?? null,
                result
            ).catch(webhookError => {
                logger.error("Failed to send NitroSniper webhook notification", webhookError);
            });
        } else {
            logger.error(`Failed to redeem code: ${request.code}`);
            void sendClaimWebhook(
                settings.store.webhookUrl,
                "failed",
                request,
                result.giftType ?? null,
                result
            ).catch(webhookError => {
                logger.error("Failed to send NitroSniper webhook notification", webhookError);
            });
        }
    } catch (error) {
        logger.error(`Error processing redeem queue for ${request.code}:`, error);
    } finally {
        claiming = false;
        if (claimQueue.length > 0) {
            void processQueue();
        }
    }
}

export default definePlugin({
    name: "NitroSniper",
    description: "Automatically redeems Nitro gift links sent in chat with multi-token support",
    authors: [
        {
            name: "neoarz",
            id: 218675193592283137n
        },
        {
            name: "rico",
            id: 1361736124858630274n
        }
    ],
    tags: ["Chat", "Utility"],
    searchTerms: ["nitro", "gift", "redeem", "snipe", "tokens"],
    settings,

    start() {
        resetState();
        gatewayManager.init(
            request => handleIncomingClaimRequest(request),
            (tokenId, updates) => {
                const currentTokens: SniperToken[] = settings.store.tokens ?? [];
                const idx = currentTokens.findIndex(t => t.id === tokenId);
                if (idx !== -1) {
                    const cloned = cleanTokens(currentTokens);
                    cloned[idx] = { ...cloned[idx], ...updates };
                    settings.store.tokens = cleanTokens(cloned);
                }
            }
        );
        gatewayManager.start(settings.store.tokens ?? []);
    },

    stop() {
        gatewayManager.stop();
        claimQueue.length = 0;
        seenCodes.clear();
        claiming = false;
    },

    flux: {
        MESSAGE_CREATE({ message }: { message: Message; }) {
            if (!message.content || shouldSkipMessage(message) || isMessageOlderThanStart(message)) return;

            const request = createClaimRequest(message);
            if (!request) return;

            handleIncomingClaimRequest(request);
        }
    }
});
