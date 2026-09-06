/*
Made with ❤️ by neoarz
I am not responsible for any damage caused by this plugin; use at your own risk
Vencord does not endorse/support this plugin (Works with Equicord as well)
dm @neoarz if u need help or have any questions
https://github.com/neoarz/NitroSniper
*/

import { SettingsStore } from "@api/Settings";
import { Button } from "@components/Button";
import { FormSwitch } from "@components/FormSwitch";
import { Heading } from "@components/Heading";
import { Paragraph } from "@components/Paragraph";
import { React, showToast, TextArea, TextInput, Toasts, useState } from "@webpack/common";

import { gatewayManager } from "../gateway";
import { getDefaultAvatarUrl, getUserIdFromToken, validateToken } from "../redeemer";
import { settings } from "../settings";
import { cleanTokens, type SniperToken } from "../types";

function maskToken(token: string): string {
    const trimmed = token.trim();
    if (trimmed.length <= 10) return "••••••••••••";
    return `${trimmed.slice(0, 6)}••••••••${trimmed.slice(-4)}`;
}

export function TokenManager() {
    const [tokenList, setTokenList] = useState<SniperToken[]>(() => {
        const stored: any[] = Array.isArray(settings.store.tokens) ? settings.store.tokens : [];
        const cleaned = cleanTokens(stored.map(t => {
            if (!t || typeof t !== "object") return null;
            const userId = t.userId || getUserIdFromToken(t.token) || undefined;
            const avatarUrl = t.avatarUrl || getDefaultAvatarUrl(userId);
            return {
                ...t,
                userId,
                avatarUrl
            };
        }));
        settings.store.tokens = cleaned;
        SettingsStore.markAsChanged();
        return cleaned;
    });

    const [newToken, setNewToken] = useState("");
    const [newLabel, setNewLabel] = useState("");
    const [bulkTokens, setBulkTokens] = useState("");
    const [isBulkMode, setIsBulkMode] = useState(false);
    const [visibleTokenIds, setVisibleTokenIds] = useState<Record<string, boolean>>({});
    const [validatingIds, setValidatingIds] = useState<Record<string, boolean>>({});
    const [isAdding, setIsAdding] = useState(false);

    const persistTokens = (tokens: SniperToken[]) => {
        const cleaned = cleanTokens(tokens);
        setTokenList(cleaned);
        settings.store.tokens = cleaned;
        gatewayManager.syncTokens(cleaned);
        SettingsStore.markAsChanged();
        return cleaned;
    };

    const toggleVisibility = (id: string) => {
        setVisibleTokenIds(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const handleAddToken = async () => {
        const raw = newToken.trim();
        if (!raw) {
            showToast("Please enter a valid token.", Toasts.Type.FAILURE);
            return;
        }

        // Check if token is already in the list
        if (tokenList.some((t: SniperToken) => t.token.trim() === raw)) {
            showToast("This token is already in your list.", Toasts.Type.FAILURE);
            return;
        }

        setIsAdding(true);
        try {
            const validation = await validateToken(raw);
            const fallbackId = validation.id || getUserIdFromToken(raw);
            const avatarUrl = validation.avatarUrl || getDefaultAvatarUrl(fallbackId);

            const tokenEntry: SniperToken = {
                id: crypto.randomUUID(),
                token: raw,
                label: newLabel.trim() || validation.username || "Alt Account",
                userId: fallbackId ?? undefined,
                username: validation.username,
                avatarUrl,
                enabled: true
            };

            persistTokens([...tokenList, tokenEntry]);
            setNewToken("");
            setNewLabel("");

            if (validation.valid) {
                showToast(`Token added for @${validation.username ?? "user"}!`, Toasts.Type.SUCCESS);
            } else {
                showToast("Token saved, but could not verify credentials.", Toasts.Type.MESSAGE);
            }
        } catch (error) {
            showToast(error instanceof Error ? error.message : "Failed to add token.", Toasts.Type.FAILURE);
        } finally {
            setIsAdding(false);
        }
    };

    const handleBulkAdd = async () => {
        const lines = bulkTokens.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        if (lines.length === 0) {
            showToast("No tokens found in input.", Toasts.Type.FAILURE);
            return;
        }

        const existingTokensSet = new Set(tokenList.map((t: SniperToken) => t.token.trim()));
        const newEntries: SniperToken[] = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (existingTokensSet.has(line)) continue;
            existingTokensSet.add(line);

            const userId = getUserIdFromToken(line);
            const avatarUrl = getDefaultAvatarUrl(userId);

            newEntries.push({
                id: crypto.randomUUID(),
                token: line,
                label: `Alt ${tokenList.length + newEntries.length + 1}`,
                userId: userId ?? undefined,
                avatarUrl,
                enabled: true
            });
        }

        if (newEntries.length === 0) {
            showToast("All provided tokens already exist in your list.", Toasts.Type.MESSAGE);
            return;
        }

        persistTokens([...tokenList, ...newEntries]);
        setBulkTokens("");
        setIsBulkMode(false);
        showToast(`Added ${newEntries.length} tokens.`, Toasts.Type.SUCCESS);
    };

    const handleToggleToken = (id: string, enabled: boolean) => {
        const updated = tokenList.map(t => t.id === id ? { ...t, enabled } : t);
        persistTokens(updated);
    };

    const handleRemoveToken = (targetItem: SniperToken, index: number) => {
        try {
            const currentList = tokenList.length > 0 ? tokenList : (Array.isArray(settings.store.tokens) ? settings.store.tokens : []);
            const updated = cleanTokens(currentList).filter((t, i) => {
                if (targetItem.id && t.id === targetItem.id) return false;
                if (targetItem.token && t.token === targetItem.token) return false;
                if (i === index) return false;
                return true;
            });

            persistTokens(updated);
            showToast("Token removed.", Toasts.Type.SUCCESS);
        } catch (error) {
            console.error("[NitroSniper] Error removing token:", error);
            showToast("Failed to remove token.", Toasts.Type.FAILURE);
        }
    };

    const handleVerifyToken = async (item: SniperToken) => {
        setValidatingIds(prev => ({ ...prev, [item.id]: true }));
        try {
            const res = await validateToken(item.token);
            if (res.valid) {
                const userId = res.id || item.userId || getUserIdFromToken(item.token);
                const avatarUrl = res.avatarUrl || getDefaultAvatarUrl(userId);
                const updated = tokenList.map(t => t.id === item.id ? {
                    ...t,
                    userId: userId ?? undefined,
                    username: res.username,
                    avatarUrl
                } : t);
                persistTokens(updated);
                showToast(`Token is valid (@${res.username ?? "user"})!`, Toasts.Type.SUCCESS);
            } else {
                showToast(`Validation failed: ${res.error ?? "Invalid token"}`, Toasts.Type.FAILURE);
            }
        } catch (err) {
            showToast("Validation failed: " + (err instanceof Error ? err.message : String(err)), Toasts.Type.FAILURE);
        } finally {
            setValidatingIds(prev => ({ ...prev, [item.id]: false }));
        }
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "8px" }}>
            <Paragraph style={{ color: "var(--text-muted)", fontSize: "14px" }}>
                Configured alt tokens will <strong>always listen for gift links in real time</strong> across all servers they are in via Discord Gateway, and can be used to redeem codes according to your chosen strategy.
            </Paragraph>

            {/* List of tokens */}
            {tokenList.length === 0 ? (
                <div style={{
                    padding: "16px",
                    borderRadius: "8px",
                    backgroundColor: "var(--background-secondary)",
                    border: "1px dashed var(--background-modifier-accent)",
                    textAlign: "center"
                }}>
                    <Paragraph style={{ color: "var(--text-muted)" }}>
                        No alt tokens configured. Add tokens below to monitor more servers and redeem to secondary accounts.
                    </Paragraph>
                </div>
            ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {tokenList.map((item: SniperToken, index: number) => {
                        const isVisible = visibleTokenIds[item.id] ?? false;
                        const isValidating = validatingIds[item.id] ?? false;
                        const avatarSrc = item.avatarUrl || getDefaultAvatarUrl(item.userId || getUserIdFromToken(item.token));

                        return (
                            <div
                                key={item.id || item.token || index}
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    padding: "10px 14px",
                                    borderRadius: "8px",
                                    backgroundColor: "var(--background-secondary)",
                                    gap: "12px"
                                }}
                            >
                                <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0, flex: 1 }}>
                                    <img
                                        src={avatarSrc}
                                        alt="avatar"
                                        onError={(e) => {
                                            const fallback = getDefaultAvatarUrl(item.userId || getUserIdFromToken(item.token));
                                            (e.currentTarget as HTMLImageElement).src = fallback;
                                        }}
                                        style={{
                                            width: "36px",
                                            height: "36px",
                                            borderRadius: "50%",
                                            flexShrink: 0,
                                            backgroundColor: "var(--background-secondary-alt)",
                                            objectFit: "cover"
                                        }}
                                    />

                                    <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                            <span style={{ fontWeight: 600, color: "var(--header-primary)", fontSize: "14px" }}>
                                                {item.label || item.username || "Alt Account"}
                                            </span>
                                            {item.username && item.label && item.label !== item.username && (
                                                <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                                                    (@{item.username})
                                                </span>
                                            )}
                                        </div>
                                        <span style={{
                                            fontFamily: "monospace",
                                            fontSize: "12px",
                                            color: "var(--text-muted)",
                                            overflow: "hidden",
                                            textOverflow: "ellipsis",
                                            whiteSpace: "nowrap"
                                        }}>
                                            {isVisible ? item.token : maskToken(item.token)}
                                        </span>
                                    </div>
                                </div>

                                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
                                    <Button
                                        size="small"
                                        variant="secondary"
                                        onClick={() => toggleVisibility(item.id)}
                                    >
                                        {isVisible ? "Hide" : "Show"}
                                    </Button>

                                    <Button
                                        size="small"
                                        variant="secondary"
                                        disabled={isValidating}
                                        onClick={() => handleVerifyToken(item)}
                                    >
                                        {isValidating ? "Checking..." : "Verify"}
                                    </Button>

                                    <Button
                                        size="small"
                                        variant="dangerSecondary"
                                        onClick={() => handleRemoveToken(item, index)}
                                    >
                                        Remove
                                    </Button>

                                    <FormSwitch
                                        title=""
                                        value={item.enabled}
                                        onChange={(val: boolean) => handleToggleToken(item.id, val)}
                                        hideBorder
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Add token section */}
            <div style={{
                marginTop: "8px",
                padding: "14px",
                borderRadius: "8px",
                backgroundColor: "var(--background-secondary-alt)",
                display: "flex",
                flexDirection: "column",
                gap: "10px"
            }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <Heading tag="h4" style={{ margin: 0, fontSize: "14px", fontWeight: 600 }}>
                        {isBulkMode ? "Bulk Add Tokens" : "Add Alt Token"}
                    </Heading>
                    <Button
                        size="small"
                        variant="link"
                        onClick={() => setIsBulkMode(!isBulkMode)}
                    >
                        {isBulkMode ? "Single Token Mode" : "Bulk Paste Mode"}
                    </Button>
                </div>

                {isBulkMode ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        <TextArea
                            value={bulkTokens}
                            onChange={(val: string) => setBulkTokens(val)}
                            placeholder="Paste tokens here, one per line..."
                            rows={4}
                        />
                        <Button
                            variant="primary"
                            onClick={handleBulkAdd}
                            disabled={!bulkTokens.trim()}
                        >
                            Import Tokens
                        </Button>
                    </div>
                ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        <div style={{ display: "flex", gap: "8px" }}>
                            <div style={{ flex: 2 }}>
                                <TextInput
                                    value={newToken}
                                    onChange={(val: string) => setNewToken(val)}
                                    placeholder="Paste user token..."
                                    type="password"
                                />
                            </div>
                            <div style={{ flex: 1 }}>
                                <TextInput
                                    value={newLabel}
                                    onChange={(val: string) => setNewLabel(val)}
                                    placeholder="Label (optional)"
                                />
                            </div>
                            <Button
                                variant="primary"
                                disabled={isAdding || !newToken.trim()}
                                onClick={handleAddToken}
                            >
                                {isAdding ? "Adding..." : "Add"}
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
