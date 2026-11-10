/*
Blacklist/whitelist filters for NitroSniper.
Blocks claims from specific channels, DMs, group DMs, or servers —
or restricts claiming to whitelisted locations only. Blacklist always
wins over whitelist.
*/

import { Logger } from "@utils/Logger";
import { showToast } from "@webpack/common";

import { settings } from "./settings";
import type { ClaimRequest } from "./types";

const logger = new Logger("NitroSniper:Filters");

function parseIds(raw: string | undefined): Set<string> {
    if (!raw) return new Set();
    return new Set(
        raw.split(/[\s,;]+/)
            .map(s => s.trim())
            .filter(s => /^\d{17,20}$/.test(s))
    );
}

export interface FilterVerdict {
    allowed: boolean;
    reason?: string;
}

export function isLocationAllowed(request: ClaimRequest): FilterVerdict {
    const { guildId, channelId, authorId } = request;
    const isDm = !guildId;

    const blServers = parseIds(settings.store.blacklistServerIds);
    const blChannels = parseIds(settings.store.blacklistChannelIds);
    const blDms = parseIds(settings.store.blacklistDmIds);

    // Blacklist always wins
    if (guildId && blServers.has(guildId)) {
        return { allowed: false, reason: `server ${guildId} blacklisted` };
    }
    if (channelId && blChannels.has(channelId)) {
        return { allowed: false, reason: `channel ${channelId} blacklisted` };
    }
    if (isDm && authorId && blDms.has(authorId)) {
        return { allowed: false, reason: `DM from ${authorId} blacklisted` };
    }
    if (isDm && channelId && blDms.has(channelId)) {
        return { allowed: false, reason: `DM/group ${channelId} blacklisted` };
    }

    // Whitelists: if any is set, claiming is restricted to matching locations only
    const wlServers = parseIds(settings.store.whitelistServerIds);
    const wlChannels = parseIds(settings.store.whitelistChannelIds);
    const wlDms = parseIds(settings.store.whitelistDmIds);
    const anyWhitelist = wlServers.size > 0 || wlChannels.size > 0 || wlDms.size > 0;

    if (!anyWhitelist) return { allowed: true };

    const inServerWl = guildId != null && wlServers.has(guildId);
    const inChannelWl = channelId != null && wlChannels.has(channelId);
    const inDmWl = isDm && (
        (authorId != null && wlDms.has(authorId)) ||
        (channelId != null && wlDms.has(channelId))
    );

    if (inServerWl || inChannelWl || inDmWl) return { allowed: true };

    return { allowed: false, reason: "location not whitelisted" };
}

export function checkFilters(request: ClaimRequest): boolean {
    const verdict = isLocationAllowed(request);
    if (!verdict.allowed) {
        logger.warn(`Skipping code [${request.code}]: ${verdict.reason}`);
        showToast({ text: `NitroSniper skipped ${request.code}: ${verdict.reason}`, variant: "critical" });
        return false;
    }
    return true;
}

export type ListKind = "blacklist" | "whitelist";
export type LocationKind = "server" | "channel" | "dm";

const settingKeys: Record<ListKind, Record<LocationKind, string>> = {
    blacklist: {
        server: "blacklistServerIds",
        channel: "blacklistChannelIds",
        dm: "blacklistDmIds"
    },
    whitelist: {
        server: "whitelistServerIds",
        dm: "whitelistDmIds",
        channel: "whitelistChannelIds"
    }
};

function getList(list: ListKind, kind: LocationKind): string[] {
    const raw = (settings.store as any)[settingKeys[list][kind]] as string | undefined ?? "";
    return raw.split(/[\s,;]+/).map(s => s.trim()).filter(Boolean);
}

function saveList(list: ListKind, kind: LocationKind, ids: string[]) {
    (settings.store as any)[settingKeys[list][kind]] = ids.join(", ");
}

export function isListed(list: ListKind, kind: LocationKind, id: string): boolean {
    return getList(list, kind).includes(id);
}

export function toggleListed(list: ListKind, kind: LocationKind, id: string): boolean {
    const ids = getList(list, kind);
    const idx = ids.indexOf(id);
    if (idx !== -1) {
        ids.splice(idx, 1);
        saveList(list, kind, ids);
        return false;
    }
    ids.push(id);
    saveList(list, kind, ids);
    return true;
}
