/*
NitroSniper settings UI. Rounded, quiet, matches Discord's own surfaces.
*/

import { Flex } from "@components/Flex";
import { Heading } from "@components/Heading";
import { Paragraph } from "@components/Paragraph";
import { Span } from "@components/Span";
import { React, TextInput, useState } from "@webpack/common";

import { toggleListed, type ListKind, type LocationKind } from "../filters";
import { settings } from "../settings";

const surface: React.CSSProperties = {
    borderRadius: "12px",
    backgroundColor: "var(--background-secondary)",
    border: "1px solid var(--background-modifier-accent)"
};

const chipStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    padding: "3px 10px",
    borderRadius: "8px",
    backgroundColor: "var(--background-secondary-alt)",
    border: "1px solid var(--background-modifier-accent)",
    fontSize: "12px",
    fontFamily: "var(--font-code)",
    color: "var(--text-default)"
};

const removeStyle: React.CSSProperties = {
    cursor: "pointer",
    color: "var(--text-muted)",
    fontWeight: 600,
    lineHeight: 1,
    background: "none",
    border: "none",
    padding: 0,
    fontSize: "13px"
};

function settingKeyFor(list: ListKind, kind: LocationKind) {
    if (list === "blacklist") {
        if (kind === "server") return "blacklistServerIds";
        if (kind === "channel") return "blacklistChannelIds";
        return "blacklistDmIds";
    }
    if (kind === "server") return "whitelistServerIds";
    if (kind === "channel") return "whitelistChannelIds";
    return "whitelistDmIds";
}

export function ListEditor({ list, kind, title, hint }: { list: ListKind; kind: LocationKind; title: string; hint: string; }) {
    const settingKey = settingKeyFor(list, kind);
    const { [settingKey]: raw } = settings.use([settingKey]);
    const ids = (raw ?? "").split(/[\s,;]+/).map(s => s.trim()).filter(Boolean);

    return (
        <div style={{ ...surface, padding: "12px 14px", display: "flex", flexDirection: "column", gap: "8px" }}>
            <Flex flexDirection="row" justifyContent="space-between" alignItems="center">
                <Span size="md" weight="medium" color="text-strong">{title}</Span>
                {ids.length > 0 && (
                    <Span size="sm" color="text-subtle">{ids.length} ID{ids.length === 1 ? "" : "s"}</Span>
                )}
            </Flex>
            <Paragraph size="sm" color="text-subtle" style={{ margin: 0 }}>{hint}</Paragraph>
            <TextInput
                value={raw ?? ""}
                onChange={(v: string) => { (settings.store as any)[settingKey] = v; }}
                placeholder={list === "blacklist" ? "Paste IDs to block here" : "Paste IDs to allow here"}
            />
            {ids.length > 0 && (
                <Flex flexDirection="row" gap="6px" flexWrap="wrap">
                    {ids.map(id => (
                        <span key={id} style={chipStyle}>
                            {id}
                            <button
                                style={removeStyle}
                                onClick={() => toggleListed(list, kind, id)}
                                aria-label={`Remove ${id}`}
                            >
                                x
                            </button>
                        </span>
                    ))}
                </Flex>
            )}
        </div>
    );
}

const chevronStyle = (open: boolean): React.CSSProperties => ({
    color: "var(--text-muted)",
    fontSize: "11px",
    transform: open ? "rotate(180deg)" : "none",
    transition: "transform 0.15s ease"
});

export function Section({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean; }) {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <div
                style={{
                    ...surface,
                    margin: 0,
                    cursor: "pointer",
                    userSelect: "none",
                    padding: "10px 14px",
                    backgroundColor: open ? "var(--background-secondary)" : "transparent"
                }}
                onClick={() => setOpen(!open)}
                role="button"
                tabIndex={0}
                onKeyDown={e => e.key === "Enter" && setOpen(!open)}
            >
                <Flex flexDirection="row" justifyContent="space-between" alignItems="center">
                    <Heading tag="h5" style={{ margin: 0 }}>{title}</Heading>
                    <span style={chevronStyle(open)}>▼</span>
                </Flex>
            </div>
            {open && <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>{children}</div>}
        </div>
    );
}
