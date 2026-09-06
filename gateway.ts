/*
Made with ❤️ by neoarz & rico
I am not responsible for any damage caused by this plugin; use at your own risk
Vencord does not endorse/support this plugin (Works with Equicord as well)
dm @neoarz if u need help or have any questions
https://github.com/neoarz/NitroSniper
*/

import { Logger } from "@utils/Logger";
import { ChannelStore, GuildStore } from "@webpack/common";

import { getDefaultAvatarUrl } from "./redeemer";
import type { ClaimRequest, SniperToken } from "./types";

const logger = new Logger("NitroSniper:Gateway");
const GIFT_LINK_REGEX = /(?:discord\.gift\/|discord\.com\/gifts?\/)([a-zA-Z0-9]{16,24})/;
const GATEWAY_URL = "wss://gateway.discord.gg/?v=9&encoding=json";

export type MessageHandler = (request: ClaimRequest) => void;
export type TokenUpdateHandler = (tokenId: string, updates: Partial<SniperToken>) => void;

export class TokenGatewayConnection {
    private ws: WebSocket | null = null;
    private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
    private jitterTimer: ReturnType<typeof setTimeout> | null = null;
    private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    private lastSequence: number | null = null;
    private heartbeatAck = true;
    private reconnectAttempts = 0;
    private stopped = false;
    private guilds = new Map<string, { name: string; icon?: string | null; channels: Map<string, string>; }>();

    constructor(
        public token: SniperToken,
        private onClaimRequest: MessageHandler,
        private onTokenUpdate?: TokenUpdateHandler
    ) {}


    public start() {
        this.stopped = false;
        this.connect();
    }

    public stop() {
        this.stopped = true;
        this.cleanup();
    }

    private cleanup() {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
        if (this.jitterTimer) {
            clearTimeout(this.jitterTimer);
            this.jitterTimer = null;
        }
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        if (this.ws) {
            try {
                this.ws.onopen = null;
                this.ws.onmessage = null;
                this.ws.onerror = null;
                this.ws.onclose = null;
                this.ws.close(1000, "Normal Closure");
            } catch {
                // ignore
            }
            this.ws = null;
        }
    }

    private connect() {
        if (this.stopped) return;
        this.cleanup();

        const rawToken = this.token.token.trim();
        if (!rawToken) return;

        try {
            this.ws = new WebSocket(GATEWAY_URL);
        } catch (error) {
            logger.error(`Failed to create WebSocket for token ${this.token.label ?? this.token.id}:`, error);
            this.scheduleReconnect();
            return;
        }

        this.ws.onopen = () => {
            logger.log(`Gateway WebSocket connected for ${this.token.label ?? this.token.id}`);
            this.reconnectAttempts = 0;
            this.heartbeatAck = true;
        };

        this.ws.onmessage = (event: MessageEvent) => {
            try {
                const payload = JSON.parse(event.data as string) as {
                    op: number;
                    d: any;
                    s?: number | null;
                    t?: string | null;
                };

                if (typeof payload.s === "number") {
                    this.lastSequence = payload.s;
                }

                this.handleMessage(payload.op, payload.d, payload.t);
            } catch (error) {
                logger.error("Error parsing gateway message:", error);
            }
        };

        this.ws.onerror = (event: Event) => {
            logger.error(`Gateway error for ${this.token.label ?? this.token.id}:`, event);
        };

        this.ws.onclose = (event: CloseEvent) => {
            logger.warn(`Gateway connection closed for ${this.token.label ?? this.token.id} (code ${event.code}, reason: ${event.reason})`);
            // Code 4004 indicates Authentication Failed (invalid token)
            if (event.code === 4004) {
                logger.error(`Token ${this.token.label ?? this.token.id} is invalid or unauthorized.`);
                this.onTokenUpdate?.(this.token.id, { enabled: false });
                this.stop();
                return;
            }

            if (!this.stopped) {
                this.scheduleReconnect();
            }
        };
    }

    private handleMessage(op: number, data: any, eventType?: string | null) {
        switch (op) {
            case 10: { // Hello
                const interval = data?.heartbeat_interval;
                if (typeof interval === "number") {
                    this.setupHeartbeat(interval);
                    this.sendIdentify();
                }
                break;
            }
            case 1: { // Heartbeat requested by server
                this.sendHeartbeat();
                break;
            }
            case 11: { // Heartbeat ACK
                this.heartbeatAck = true;
                break;
            }
            case 7: // Reconnect
            case 9: { // Invalid Session
                this.scheduleReconnect(1000);
                break;
            }
            case 0: { // Dispatch
                this.handleDispatch(eventType, data);
                break;
            }
            default:
                break;
        }
    }

    private setupHeartbeat(interval: number) {
        if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
        if (this.jitterTimer) clearTimeout(this.jitterTimer);

        this.heartbeatAck = true;
        const jitter = Math.floor(Math.random() * interval * 0.9);

        this.jitterTimer = setTimeout(() => {
            if (this.stopped) return;
            this.sendHeartbeat();
            this.heartbeatTimer = setInterval(() => {
                if (this.stopped) return;
                if (!this.heartbeatAck) {
                    logger.warn(`Heartbeat ACK missed for ${this.token.label ?? this.token.id}, reconnecting...`);
                    this.scheduleReconnect(500);
                    return;
                }
                this.heartbeatAck = false;
                this.sendHeartbeat();
            }, interval);
        }, jitter);
    }

    private sendHeartbeat() {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
        this.ws.send(JSON.stringify({
            op: 1,
            d: this.lastSequence
        }));
    }

    private sendIdentify() {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

        const identifyPayload = {
            op: 2,
            d: {
                token: this.token.token.trim(),
                capabilities: 30717,
                properties: {
                    os: "Windows",
                    browser: "Discord Client",
                    release_channel: "stable",
                    client_version: "1.0.9160",
                    os_version: "10.0.22631",
                    os_arch: "x64",
                    system_locale: "en-US"
                },
                presence: {
                    status: "online",
                    since: 0,
                    activities: [],
                    afk: false
                },
                compress: false
            }
        };

        this.ws.send(JSON.stringify(identifyPayload));
    }

    private handleDispatch(eventType: string | null | undefined, data: any) {
        if (eventType === "READY") {
            const user = data?.user;
            if (user) {
                const avatarUrl = user.id && user.avatar
                    ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128`
                    : getDefaultAvatarUrl(user.id);
                this.token.userId = user.id;
                this.token.username = user.username;
                this.token.avatarUrl = avatarUrl;
                this.onTokenUpdate?.(this.token.id, {
                    userId: user.id,
                    username: user.username,
                    avatarUrl
                });
                logger.log(`Gateway READY for token ${this.token.label ?? user.username} (${user.id})`);
            }
            return;
        }

        if (eventType === "GUILD_CREATE") {
            const channelsMap = new Map<string, string>();
            if (Array.isArray(data?.channels)) {
                for (const ch of data.channels) {
                    if (ch?.id && ch?.name) {
                        channelsMap.set(ch.id, ch.name);
                    }
                }
            }
            this.guilds.set(data.id, {
                name: data.name ?? "Unknown Server",
                icon: data?.icon ?? null,
                channels: channelsMap
            });
            return;
        }

        if (eventType === "CHANNEL_CREATE" || eventType === "CHANNEL_UPDATE") {
            if (data?.guild_id && data?.id && data?.name) {
                const guild = this.guilds.get(data.guild_id);
                if (guild) {
                    guild.channels.set(data.id, data.name);
                }
            }
            return;
        }

        if (eventType === "MESSAGE_CREATE") {
            const detectedAt = Date.now();
            const content = data?.content;
            if (typeof content !== "string" || !content) return;

            const match = content.match(GIFT_LINK_REGEX);
            if (!match) return;

            const code = match[1];
            const author = data.author;
            const authorAvatarUrl = author?.id && author?.avatar
                ? `https://cdn.discordapp.com/avatars/${author.id}/${author.avatar}.png?size=128`
                : undefined;

            const tokenDisplayName = this.token.username || this.token.label || `Token ${this.token.id.slice(0, 4)}`;

            const guildInfo = data.guild_id ? this.guilds.get(data.guild_id) : undefined;
            const guildStoreObj = data.guild_id ? GuildStore.getGuild(data.guild_id) : undefined;
            const guildName = guildInfo?.name
                ?? (data.guild_id ? guildStoreObj?.name : undefined)
                ?? (data.guild_id ? "Unknown Server" : "Direct Messages");

            const channelName = guildInfo?.channels.get(data.channel_id)
                ?? ChannelStore.getChannel(data.channel_id)?.name
                ?? (data.guild_id ? "channel" : "Direct Messages");

            const guildIcon = guildInfo?.icon ?? guildStoreObj?.icon;
            const guildIconUrl = (guildStoreObj as any)?.getIconURL?.(128)
                ?? (data.guild_id && guildIcon ? `https://cdn.discordapp.com/icons/${data.guild_id}/${guildIcon}.${guildIcon.startsWith("a_") ? "gif" : "png"}?size=128` : undefined);

            const request: ClaimRequest = {
                code,
                authorId: author?.id,
                authorName: author?.global_name ?? author?.username,
                authorUsername: author?.username,
                authorAvatarUrl,
                channelId: data.channel_id,
                channelName,
                guildId: data.guild_id,
                guildName,
                guildIconUrl,
                messageId: data.id,
                detectedBy: tokenDisplayName,
                detectedById: this.token.userId,
                isAlt: true,
                detectedAt
            };

            logger.log(`Gift code [${code}] detected by alt token [${tokenDisplayName}] in server [${guildName}] #${channelName}`);
            this.onClaimRequest(request);
        }
    }

    private scheduleReconnect(delayMs?: number) {
        if (this.stopped) return;
        this.cleanup();

        const delay = delayMs ?? Math.min(30000, 3000 * Math.pow(1.5, this.reconnectAttempts++));
        logger.log(`Scheduling reconnect for ${this.token.label ?? this.token.id} in ${Math.round(delay / 1000)}s`);

        this.reconnectTimer = setTimeout(() => {
            if (!this.stopped) {
                this.connect();
            }
        }, delay);
    }
}

export class GatewayManager {
    private connections = new Map<string, TokenGatewayConnection>();
    private running = false;
    private onClaimRequest?: MessageHandler;
    private onTokenUpdate?: TokenUpdateHandler;

    public init(onClaimRequest: MessageHandler, onTokenUpdate?: TokenUpdateHandler) {
        this.onClaimRequest = onClaimRequest;
        this.onTokenUpdate = onTokenUpdate;
    }

    public start(tokens: SniperToken[]) {
        this.running = true;
        this.syncTokens(tokens);
    }

    public stop() {
        this.running = false;
        for (const conn of this.connections.values()) {
            conn.stop();
        }
        this.connections.clear();
    }

    public syncTokens(tokens: SniperToken[]) {
        if (!this.running) return;

        const currentIds = new Set(tokens.filter(t => t.enabled && t.token.trim().length > 0).map(t => t.id));

        // Stop and remove connections for disabled/removed tokens
        for (const [id, conn] of this.connections.entries()) {
            if (!currentIds.has(id)) {
                conn.stop();
                this.connections.delete(id);
            }
        }

        // Start or update connections for enabled tokens
        for (const token of tokens) {
            if (!token.enabled || !token.token.trim()) continue;

            const existing = this.connections.get(token.id);
            if (existing) {
                if (existing.token.token.trim() !== token.token.trim()) {
                    existing.stop();
                    const newConn = new TokenGatewayConnection(
                        token,
                        req => this.onClaimRequest?.(req),
                        (id, upd) => this.onTokenUpdate?.(id, upd)
                    );
                    this.connections.set(token.id, newConn);
                    newConn.start();
                } else {
                    existing.token = token;
                }
            } else {
                const newConn = new TokenGatewayConnection(
                    token,
                    req => this.onClaimRequest?.(req),
                    (id, upd) => this.onTokenUpdate?.(id, upd)
                );
                this.connections.set(token.id, newConn);
                newConn.start();
            }
        }
    }

    public getActiveCount(): number {
        return this.connections.size;
    }
}

export const gatewayManager = new GatewayManager();

