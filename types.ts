/*
Made with ❤️ by neoarz & rico
I am not responsible for any damage caused by this plugin; use at your own risk
Vencord does not endorse/support this plugin (Works with Equicord as well)
dm @neoarz if u need help or have any questions
https://github.com/neoarz/NitroSniper
*/

export interface ClaimRequest {
    code: string;
    authorId?: string;
    authorName?: string;
    authorUsername?: string;
    authorAvatarUrl?: string;
    channelId?: string;
    channelName?: string;
    guildId?: string;
    guildName?: string;
    guildIconUrl?: string;
    messageId?: string;
    detectedBy?: string;
    detectedById?: string;
    isAlt?: boolean;
    detectedAt?: number;
}

export interface SniperToken {
    id: string;
    token: string;
    label?: string;
    userId?: string;
    username?: string;
    avatarUrl?: string;
    enabled: boolean;
}

export function cleanToken(t: Partial<SniperToken> | null | undefined): SniperToken | null {
    if (!t || typeof t !== "object" || !t.token) return null;
    return {
        id: String(t.id || crypto.randomUUID()),
        token: String(t.token).trim(),
        label: t.label ? String(t.label) : undefined,
        userId: t.userId ? String(t.userId) : undefined,
        username: t.username ? String(t.username) : undefined,
        avatarUrl: t.avatarUrl ? String(t.avatarUrl) : undefined,
        enabled: Boolean(t.enabled ?? true)
    };
}

export function cleanTokens(tokens: any[]): SniperToken[] {
    if (!Array.isArray(tokens)) return [];
    return JSON.parse(JSON.stringify(
        tokens.map(cleanToken).filter((t): t is SniperToken => t !== null && Boolean(t.token))
    ));
}

export const enum RedeemStrategy {
    CURRENT_FIRST = "current_first",
    ALTS_FIRST = "alts_first",
    ALTS_ONLY = "alts_only",
    RACE = "race",
    CURRENT_ONLY = "current_only"
}

export interface ClaimAttempt {
    tokenLabel: string;
    success: boolean;
    error?: string;
}

export interface ClaimResult {
    success: boolean;
    claimedBy?: string;
    giftType?: string | null;
    elapsedMs?: number;
    attempts: ClaimAttempt[];
}

export type WebhookResult = "claimed" | "failed";

export interface WebhookField {
    name: string;
    value: string;
    inline?: boolean;
}

export interface WebhookEmbed {
    title?: string;
    color: number;
    description?: string;
    fields?: WebhookField[];
    timestamp?: string;

    author?: {
        name: string;
        icon_url?: string;
    };
    footer?: {
        text: string;
    };
}

export interface WebhookPayload {
    content?: string;
    username: string;
    embeds: WebhookEmbed[];
    allowed_mentions: {
        parse: string[];
    };
}

export interface NativeWebhookResponse {
    status: number;
    data: string;
}

export interface NativeApiResponse {
    status: number;
    data: string;
    ok: boolean;
}

export interface TokenValidationResult {
    valid: boolean;
    id?: string;
    username?: string;
    globalName?: string;
    avatarUrl?: string;
    error?: string;
}

export interface GiftCodeResolution {
    store_listing?: {
        sku?: {
            name?: string;
        };
    };
    subscription_plan?: {
        name?: string;
    };
}

/* Components V2 webhook payload types */

export interface V2TextDisplay {
    type: 10;
    content: string;
}

export interface V2Thumbnail {
    type: 11;
    media: { url: string; };
    description?: string;
}

export interface V2Section {
    type: 9;
    components: V2TextDisplay[];
    accessory?: V2Thumbnail;
}

export interface V2Separator {
    type: 14;
    spacing?: 1 | 2;
    divider?: boolean;
}

export interface V2Button {
    type: 2;
    style: 1 | 2 | 3 | 4 | 5;
    label?: string;
    url?: string;
    custom_id?: string;
    disabled?: boolean;
}

export interface V2ActionRow {
    type: 1;
    components: V2Button[];
}

export interface V2Container {
    type: 17;
    accent_color?: number;
    spoiler?: boolean;
    components: Array<V2TextDisplay | V2Section | V2Separator | V2ActionRow>;
}

export type V2Component = V2TextDisplay | V2Section | V2Separator | V2ActionRow | V2Container;

export interface V2Payload {
    username?: string;
    flags: number;
    components: V2Component[];
    allowed_mentions: {
        parse: string[];
    };
}

