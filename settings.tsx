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
import { showToast, useEffect, useState } from "@webpack/common";

import { TokenManager } from "./components/TokenManager";
import { ListEditor, Section } from "./components/SettingsSections";
import { gatewayManager } from "./gateway";
import { getStats, hitRate, resetStats, statsSummary, subscribeStats, topAccounts } from "./stats";
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
                        showToast({ text: "Test message sent.", variant: "success" });
                    })
                    .catch((error: unknown) => {
                        showToast({ text: getToastErrorMessage(error), variant: "critical" });
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
                Right-click a server, channel, or DM and pick Sniper to block it, or paste IDs below.
            </Paragraph>
            <ListEditor list="blacklist" kind="server" title="Servers" hint="Skip codes posted in these servers." />
            <ListEditor list="blacklist" kind="channel" title="Channels" hint="Skip codes posted in these channels." />
            <ListEditor list="blacklist" kind="dm" title="DMs & Groups" hint="User IDs or DM channel IDs to skip." />
        </Section>
    );
}

function WhitelistSection() {
    return (
        <Section title="Whitelists" defaultOpen={false}>
            <Paragraph size="sm" color="text-subtle" style={{ margin: 0 }}>
                Add an ID here and the sniper only claims in those spots. Blacklisted places stay blocked either way. Empty whitelists mean claim everywhere.
            </Paragraph>
            <ListEditor list="whitelist" kind="server" title="Servers" hint="Only claim in these servers." />
            <ListEditor list="whitelist" kind="channel" title="Channels" hint="Only claim in these channels." />
            <ListEditor list="whitelist" kind="dm" title="DMs & Groups" hint="User IDs or DM channel IDs to allow." />
        </Section>
    );
}

function StatsSection() {
    const [, forceUpdate] = useState(0);
    useEffect(() => subscribeStats(() => forceUpdate(n => n + 1)), []);

    const stats = getStats();
    const rate = hitRate(stats);
    const accounts = topAccounts(stats);

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
                    resetStats();
                    showToast({ text: "Stats cleared.", variant: "default" });
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
        description: "Alt account tokens.",
        component: TokenManager
    },
    tokens: {
        type: OptionType.CUSTOM,
        default: [] as SniperToken[],
        description: "Token list.",
        onChange(newTokens: SniperToken[]) {
            gatewayManager.syncTokens(newTokens);
        }
    },

    redeemStrategy: {
        type: OptionType.SELECT,
        description: "Pick which account claims the code.",
        options: [
            { label: "Main account first, alts as backup", value: RedeemStrategy.CURRENT_FIRST, default: true },
            { label: "Alts first, main account as backup", value: RedeemStrategy.ALTS_FIRST },
            { label: "Alts only", value: RedeemStrategy.ALTS_ONLY },
            { label: "Everyone at once", value: RedeemStrategy.RACE },
            { label: "Main account only, alts just listen", value: RedeemStrategy.CURRENT_ONLY }
        ]
    },
    ignoreOwnGiftLinks: {
        type: OptionType.BOOLEAN,
        description: "Ignore links you post yourself.",
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
    statsSection: {
        type: OptionType.COMPONENT,
        component: StatsSection
    },

    blacklistServerIds: {
        type: OptionType.STRING,
        description: "Servers to skip.",
        default: "",
        restartNeeded: false,
        hidden: true
    },
    blacklistChannelIds: {
        type: OptionType.STRING,
        description: "Channels to skip.",
        default: "",
        restartNeeded: false,
        hidden: true
    },
    blacklistDmIds: {
        type: OptionType.STRING,
        description: "DMs to skip.",
        default: "",
        restartNeeded: false,
        hidden: true
    },
    whitelistServerIds: {
        type: OptionType.STRING,
        description: "Servers to allow.",
        default: "",
        restartNeeded: false,
        hidden: true
    },
    whitelistChannelIds: {
        type: OptionType.STRING,
        description: "Channels to allow.",
        default: "",
        restartNeeded: false,
        hidden: true
    },
    whitelistDmIds: {
        type: OptionType.STRING,
        description: "DMs to allow.",
        default: "",
        restartNeeded: false,
        hidden: true
    },

    webhookUrl: {
        type: OptionType.STRING,
        description: "Webhook URL for claim pings. Leave empty to turn off.",
        default: "",
        restartNeeded: false
    },
    testWebhook: {
        type: OptionType.COMPONENT,
        component: TestWebhookButton
    }
});
