/*
Compact settings UI for NitroSniper — sections instead of one endless scroll.
*/

import { Flex } from "@components/Flex";
import { FormSwitch } from "@components/FormSwitch";
import { Heading } from "@components/Heading";
import { Paragraph } from "@components/Paragraph";
import { Span } from "@components/Span";
import { React, TextInput, useState } from "@webpack/common";

import { toggleListed, type ListKind, type LocationKind } from "../filters";
import { settings } from "../settings";

const chipStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
    padding: "2px 8px",
    borderRadius: "12px",
    backgroundColor: "var(--background-secondary-alt)",
    fontSize: "12px",
    fontFamily: "monospace",
    color: "var(--text-default)"
};

const removeStyle: React.CSSProperties = {
    cursor: "pointer",
    color: "var(--text-muted)",
    fontWeight: 700,
    lineHeight: 1,
    background: "none",
    border: "none",
    padding: 0
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
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <Flex flexDirection="row" justifyContent="space-between" alignItems="center">
                <Span size="md" weight="medium" color="text-strong">{title}</Span>
                <Span size="sm" color="text-subtle">{ids.length} entrie{ids.length === 1 ? "" : "s"}</Span>
            </Flex>
            <Paragraph size="sm" color="text-subtle" style={{ margin: 0 }}>{hint}</Paragraph>
            <TextInput
                value={raw ?? ""}
                onChange={(v: string) => { (settings.store as any)[settingKey] = v; }}
                placeholder={list === "blacklist" ? "Never claim here" : "Only claim here"}
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
                                ×
                            </button>
                        </span>
                    ))}
                </Flex>
            )}
        </div>
    );
}

const sectionHeaderStyle: React.CSSProperties = {
    margin: 0,
    cursor: "pointer",
    userSelect: "none"
};

export function Section({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean; }) {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <div
                style={sectionHeaderStyle}
                onClick={() => setOpen(!open)}
                role="button"
                tabIndex={0}
                onKeyDown={e => e.key === "Enter" && setOpen(!open)}
            >
                <Flex flexDirection="row" justifyContent="space-between" alignItems="center">
                    <Heading tag="h5" style={{ margin: 0 }}>{title}</Heading>
                    <Span size="sm" color="text-muted">{open ? "▲" : "▼"}</Span>
                </Flex>
            </div>
            {open && <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>{children}</div>}
        </div>
    );
}
