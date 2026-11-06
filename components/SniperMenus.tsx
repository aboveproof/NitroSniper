/*
Right-click Blacklist/Whitelist entries for NitroSniper.
Works on servers (guild-context), channels/threads (channel-context /
thread-context), DMs (user-context) and group DMs (gdm-context).
*/

import { findGroupChildrenByChildId, NavContextMenuPatchCallback } from "@api/ContextMenu";
import type { Channel, Guild } from "@vencord/discord-types";
import { Menu, showToast } from "@webpack/common";

import { isListed, toggleListed, type ListKind, type LocationKind } from "../filters";

interface ChannelContextProps {
    channel?: Channel;
    guild?: Guild;
}

interface GuildContextProps {
    guild?: Guild;
}

interface UserContextProps {
    channel?: Channel;
    user?: { id: string; };
}

function makeToggleItem(list: ListKind, kind: LocationKind, id: string, label: string) {
    const active = isListed(list, kind, id);
    return (
        <Menu.MenuCheckboxItem
            id={`nitrosniper-${list}-${kind}`}
            label={label}
            checked={active}
            action={() => {
                const nowActive = toggleListed(list, kind, id);
                showToast(nowActive ? `Added to ${list}` : `Removed from ${list}`, "message");
            }}
        />
    );
}

function createSniperSubMenu(kind: LocationKind, id: string, name: string) {
    const where = name ? ` (${name})` : "";
    return (
        <Menu.MenuItem
            id="nitrosniper-filters"
            label={`Sniper: Blacklist / Whitelist${where}`}
        >
            {makeToggleItem("blacklist", kind, id, "Blacklist")}
            {makeToggleItem("whitelist", kind, id, "Whitelist")}
        </Menu.MenuItem>
    );
}

function insertMenu(children: Array<React.ReactElement | null | undefined>, menu: React.ReactElement, anchorId: string) {
    const container = findGroupChildrenByChildId(anchorId, children);
    if (container) {
        const idx = container.findIndex(c => (c as any)?.props?.id === anchorId);
        container.splice(idx !== -1 ? idx : container.length, 0, menu);
    } else {
        children.push(<Menu.MenuGroup>{menu}</Menu.MenuGroup>);
    }
}

const ChannelContext: NavContextMenuPatchCallback = (children, props: ChannelContextProps) => {
    const channel = props.channel;
    if (!channel?.id) return;
    insertMenu(children, createSniperSubMenu("channel", channel.id, channel.name), "copy-channel-id");
};

const ThreadContext: NavContextMenuPatchCallback = (children, props: ChannelContextProps) => {
    const channel = props.channel;
    if (!channel?.id) return;
    insertMenu(children, createSniperSubMenu("channel", channel.id, channel.name), "copy-channel-id");
};

const GuildContext: NavContextMenuPatchCallback = (children, props: GuildContextProps) => {
    const guild = props.guild;
    if (!guild?.id) return;
    insertMenu(children, createSniperSubMenu("server", guild.id, guild.name), "copy-guild-id");
};

// user-context fires when right-clicking a DM in the sidebar or a user.
// Only treat it as a DM filter when we're inside an actual DM channel.
const UserContext: NavContextMenuPatchCallback = (children, props: UserContextProps) => {
    const channel = props.channel;
    if (!channel?.id) return;
    const isDm = channel.type === 1 /* DM */ || channel.type === 3 /* GROUP_DM */;
    if (!isDm) return;

    const kind: LocationKind = "dm";
    // For 1:1 DMs the channel id is stable; user id also works via filter check.
    // Use channel id so group DMs and 1:1 both land in the DM list.
    insertMenu(children, createSniperSubMenu(kind, channel.id, channel.name), "close-dm");
};

export const contextMenus = {
    "channel-context": ChannelContext,
    "thread-context": ThreadContext,
    "guild-context": GuildContext,
    "user-context": UserContext,
    "gdm-context": ChannelContext
};
