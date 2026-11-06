/*
Made with ❤️ by neoarz & rico
I am not responsible for any damage caused by this plugin; use at your own risk
Vencord does not endorse/support this plugin (Works with Equicord as well)
dm @neoarz if u need help or have any questions
https://github.com/neoarz/NitroSniper
*/

import { definePluginSettings } from "@api/Settings";
import { Button } from "@components/Button";
import { Flex } from "@components/Flex";
import { FormSwitch } from "@components/FormSwitch";
import { Heading } from "@components/Heading";
import { Paragraph } from "@components/Paragraph";
import { Span } from "@components/Span";
import { OptionType } from "@utils/types";
import { showToast, useState } from "@webpack/common";

import { TokenManager } from "./components/TokenManager";
import { ListEditor, Section } from "./components/SettingsSections";
import { gatewayManager } from "./gateway";
import { getStats, hitRate, resetStats, statsSummary, topAccounts } from "./stats";
import { RedeemStrategy, SniperToken } from "./types";
import { sendTestWebhook } from "./webhook";

function getToastErrorMessage(error: unknown) {
    return error instanceof Error
        ? error.message
        : "Failed to send test webhook.";
}

function TestWebhookButton() {
    const { webhookUrl } = settings.use(["webhookUrl"]);
    const disabled = webhookUrl.trim().length === 0;

    return (
        <Button
            disabled={disabled}
            onClick={() => {
                void sendTestWebhook(webhookUrl)
                    .then(() => {
                        showToast("Test webhook sent successfully.", "success");
                    })
                    .catch((error: unknown) => {
                        showToast(getToastErrorMessage(error), "failure");
                    });
            }}
        >
            Send Test Webhook
        </Button>
    );
}

function BlacklistSection() {
    return (
        <Section title="Blacklists">
            <Paragraph size="sm" color="text-subtle" style={{ margin: 0 }}>
                Right-click any server, channel, DM or group DM → "Sniper: Blacklist / Whitelist", or paste IDs below.
            </Paragraph>
            <ListEditor list="blacklist" kind="server" title="Servers" hint="Never claim in these servers." />
            <ListEditor list="blacklist" kind="channel" title="Channels" hint="Never claim in these channels." />
            <ListEditor list="blacklist" kind="dm" title="DMs & Groups" hint="User IDs or DM channel IDs. Never claim here." />
        </Section>
    );
}

function WhitelistSection() {
    return (
        <Section title="Whitelists" defaultOpen={false}>
            <Paragraph size="sm" color="text-subtle" style={{ margin: 0 }}>
                If any whitelist has entries, claiming is restricted to whitelisted locations only. Blacklist always wins.
            </Paragraph>
            <ListEditor list="whitelist" kind="server" title="Servers" hint="Only claim in these servers." />
            <ListEditor list="whitelist" kind="channel" title="Channels" hint="Only claim in these channels." />
            <ListEditor list="whitelist" kind="dm" title="DMs & Groups" hint="User IDs or DM channel IDs." />
        </Section>
    );
}

function CaptchaSection() {
    const { captchaPrevention, captchaWatcher, captchaAutoReload } = settings.use(["captchaPrevention", "captchaWatcher", "captchaAutoReload"]);
    return (
        <Section title="Captcha Prevention" defaultOpen={false}>
            <FormSwitch
                title="Prevention engine"
                description="Back off after captcha signals. Never blocks fresh claims by default."
                value={captchaPrevention}
                onChange={v => settings.store.captchaPrevention = v}
                hideBorder
            />
            <Flex flexDirection="row" gap="16px" flexWrap="wrap">
                <span style={{ minWidth: 140 }}>
                    <FormSwitch
                        title="Captcha watcher"
                        value={captchaWatcher}
                        onChange={v => settings.store.captchaWatcher = v}
                        hideBorder
                    />
                </span>
                <span style={{ minWidth: 140 }}>
                    <FormSwitch
                        title="Auto-reload"
                        value={captchaAutoReload}
                        onChange={v => settings.store.captchaAutoReload = v}
                        hideBorder
                    />
                </span>
            </Flex>
        </Section>
    );
}

function StatsSection() {
    const { claimStats } = settings.use(["claimStats"]);
    const stats = getStats({ claimStats });
    const rate = hitRate(stats);
    const accounts = topAccounts(stats);
    const [, forceUpdate] = useState(0);

    return (
        <Section title="Claim Stats" defaultOpen>
            <Flex flexDirection="row" gap="16px" flexWrap="wrap" justifyContent="space-between" alignItems="center">
                <Heading tag="h5" style={{ margin: 0 }}>{statsSummary(stats)}</Heading>
                {rate != null && <Span size="md" color="text-default">{rate}% hit rate</Span>}
            </Flex>
            {accounts.length > 0 && (
                <Flex flexDirection="column" gap="4px">
                    {accounts.map(({ account, wins }) => (
                        <Flex key={account} flexDirection="row" justifyContent="space-between" alignItems="center">
                            <Span size="sm" color="text-default">{account}</Span>
                            <Span size="sm" color="text-subtle">{wins} win{wins === 1 ? "" : "s"}</Span>
                        </Flex>
                    ))}
                </Flex>
            )}
            {stats.lastClaimAt > 0 && (
                <Span size="sm" color="text-subtle">
                    Last claim: {new Date(stats.lastClaimAt).toLocaleString()}
                </Span>
            )}
            <Button
                size="small"
                variant="dangerSecondary"
                onClick={() => {
                    resetStats(settings.store);
                    forceUpdate(n => n + 1);
                    showToast("Claim stats reset.", "message");
                }}
            >
                Reset Stats
            </Button>
        </Section>
    );
}

export const settings = definePluginSettings({
    tokenManager: {
        type: OptionType.COMPONENT,
        description: "Configure secondary account tokens.",
        component: TokenManager
    },
    tokens: {
        type: OptionType.CUSTOM,
        default: [] as SniperToken[],
        description: "Stored list of alt account tokens.",
        onChange(newTokens: SniperToken[]) {
            gatewayManager.syncTokens(newTokens);
        }
    },

    redeemStrategy: {
        type: OptionType.SELECT,
        description: "Which account redeems the gift code.",
        options: [
            { label: "Current Account First, then Alts", value: RedeemStrategy.CURRENT_FIRST, default: true },
            { label: "Alts First, then Current Account", value: RedeemStrategy.ALTS_FIRST },
            { label: "Alts Only", value: RedeemStrategy.ALTS_ONLY },
            { label: "Race (All Accounts Simultaneously)", value: RedeemStrategy.RACE },
            { label: "Current Account Only (Alts Only Listen)", value: RedeemStrategy.CURRENT_ONLY }
        ]
    },
    ignoreOwnGiftLinks: {
        type: OptionType.BOOLEAN,
        description: "Skip gift links sent by you.",
        default: false,
        restartNeeded: false
    },

    blacklistSection: {
        type: OptionType.COMPONENT,
        component: BlacklistSection
    },
    whitelistSection: {
        type: OptionType.COMPONENT,
        component: WhitelistSection
    },
    captchaSection: {
        type: OptionType.COMPONENT,
        component: CaptchaSection
    },
    statsSection: {
        type: OptionType.COMPONENT,
        component: StatsSection
    },

    claimStats: {
        type: OptionType.CUSTOM,
        description: "Lifetime claim statistics.",
        default: null,
        restartNeeded: false,
        hidden: true
    },

    blacklistServerIds: {
        type: OptionType.STRING,
        description: "Never claim in these servers.",
        default: "",
        restartNeeded: false,
        hidden: true
    },
    blacklistChannelIds: {
        type: OptionType.STRING,
        description: "Never claim in these channels.",
        default: "",
        restartNeeded: false,
        hidden: true
    },
    blacklistDmIds: {
        type: OptionType.STRING,
        description: "Never claim in these DMs.",
        default: "",
        restartNeeded: false,
        hidden: true
    },
    whitelistServerIds: {
        type: OptionType.STRING,
        description: "Only claim in these servers.",
        default: "",
        restartNeeded: false,
        hidden: true
    },
    whitelistChannelIds: {
        type: OptionType.STRING,
        description: "Only claim in these channels.",
        default: "",
        restartNeeded: false,
        hidden: true
    },
    whitelistDmIds: {
        type: OptionType.STRING,
        description: "Only claim in these DMs.",
        default: "",
        restartNeeded: false,
        hidden: true
    },

    captchaPrevention: {
        type: OptionType.BOOLEAN,
        description: "Captcha prevention engine.",
        default: true,
        restartNeeded: false,
        hidden: true
    },
    stealthMinDelayMs: {
        type: OptionType.NUMBER,
        description: "Minimum humanized delay before claiming (ms).",
        default: 0,
        restartNeeded: false,
        hidden: true
    },
    stealthMaxDelayMs: {
        type: OptionType.NUMBER,
        description: "Maximum humanized delay before claiming (ms).",
        default: 0,
        restartNeeded: false,
        hidden: true
    },
    claimCooldownSeconds: {
        type: OptionType.NUMBER,
        description: "Minimum seconds between two claim attempts.",
        default: 0,
        restartNeeded: false,
        hidden: true
    },
    maxClaimsPerHour: {
        type: OptionType.NUMBER,
        description: "Max claim attempts per hour (0 = unlimited).",
        default: 0,
        restartNeeded: false,
        hidden: true
    },
    maxClaimsPerDay: {
        type: OptionType.NUMBER,
        description: "Max claim attempts per day (0 = unlimited).",
        default: 0,
        restartNeeded: false,
        hidden: true
    },
    captchaBackoffMinutes: {
        type: OptionType.NUMBER,
        description: "Minutes to stop claiming after a captcha signal.",
        default: 30,
        restartNeeded: false,
        hidden: true
    },
    preValidateCodes: {
        type: OptionType.BOOLEAN,
        description: "Resolve codes before redeeming.",
        default: false,
        restartNeeded: false,
        hidden: true
    },
    captchaWatcher: {
        type: OptionType.BOOLEAN,
        description: "Watch for stuck captcha challenges.",
        default: true,
        restartNeeded: false,
        hidden: true
    },
    captchaAutoReload: {
        type: OptionType.BOOLEAN,
        description: "Reload Discord when a captcha is stuck.",
        default: false,
        restartNeeded: false,
        hidden: true
    },
    captchaStuckSeconds: {
        type: OptionType.NUMBER,
        description: "Seconds before a captcha counts as stuck.",
        default: 10,
        restartNeeded: false,
        hidden: true
    },

    webhookUrl: {
        type: OptionType.STRING,
        description: "Discord webhook URL for claim notifications. Empty = off.",
        default: "",
        restartNeeded: false
    },
    testWebhook: {
        type: OptionType.COMPONENT,
        component: TestWebhookButton
    }
});
