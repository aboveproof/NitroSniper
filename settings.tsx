/*
Made with ❤️ by neoarz & rico
I am not responsible for any damage caused by this plugin; use at your own risk
Vencord does not endorse/support this plugin (Works with Equicord as well)
dm @neoarz if u need help or have any questions
https://github.com/neoarz/NitroSniper
*/

import { definePluginSettings } from "@api/Settings";
import { OptionType } from "@utils/types";
import { Button, showToast, Toasts } from "@webpack/common";

import { TokenManager } from "./components/TokenManager";
import { gatewayManager } from "./gateway";
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
                        showToast("Test webhook sent successfully.", Toasts.Type.SUCCESS);
                    })
                    .catch((error: unknown) => {
                        showToast(getToastErrorMessage(error), Toasts.Type.FAILURE);
                    });
            }}
        >
            Send Test Webhook
        </Button>
    );
}

export const settings = definePluginSettings({
    tokenManager: {
        type: OptionType.COMPONENT,
        description: "Configure secondary account tokens. Enabled tokens will always listen in real time for gift links via Discord Gateway, and can be used to claim Nitro.",
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
        description: "Choose how to prioritize which account redeems the gift code.",
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
        description: "Do not redeem Nitro gift links from messages sent by you.",
        default: false,
        restartNeeded: false
    },
    captchaPrevention: {
        type: OptionType.BOOLEAN,
        description: "Humanize claim timing, enforce velocity budgets, and back off after captcha signals. Strongly reduces the risk engine flagging your claims.",
        default: true,
        restartNeeded: false
    },
    stealthMinDelayMs: {
        type: OptionType.NUMBER,
        description: "Minimum humanized delay before claiming (ms). 0 = claim instantly.",
        default: 0,
        restartNeeded: false
    },
    stealthMaxDelayMs: {
        type: OptionType.NUMBER,
        description: "Maximum humanized delay before claiming (ms). 0 = claim instantly.",
        default: 0,
        restartNeeded: false
    },
    claimCooldownSeconds: {
        type: OptionType.NUMBER,
        description: "Minimum seconds between two claim attempts. 0 = no cooldown.",
        default: 0,
        restartNeeded: false
    },
    maxClaimsPerHour: {
        type: OptionType.NUMBER,
        description: "Max claim attempts per hour (0 = unlimited).",
        default: 0,
        restartNeeded: false
    },
    maxClaimsPerDay: {
        type: OptionType.NUMBER,
        description: "Max claim attempts per day (0 = unlimited).",
        default: 0,
        restartNeeded: false
    },
    captchaBackoffMinutes: {
        type: OptionType.NUMBER,
        description: "Minutes to stop claiming after a captcha/risk signal is detected (stacks per signal). Only engages after an actual captcha.",
        default: 30,
        restartNeeded: false
    },
    preValidateCodes: {
        type: OptionType.BOOLEAN,
        description: "Resolve codes through the read-only endpoint first (adds one round trip). Off = maximum claim speed.",
        default: false,
        restartNeeded: false
    },
    captchaWatcher: {
        type: OptionType.BOOLEAN,
        description: "Watch for captcha challenges stuck on screen and fire alerts/backoff.",
        default: true,
        restartNeeded: false
    },
    captchaAutoReload: {
        type: OptionType.BOOLEAN,
        description: "Reload Discord when a captcha stays on screen for too long.",
        default: false,
        restartNeeded: false
    },
    captchaStuckSeconds: {
        type: OptionType.NUMBER,
        description: "Seconds a captcha must be visible before alerting/reloading.",
        default: 10,
        restartNeeded: false
    },
    webhookUrl: {
        type: OptionType.STRING,
        description: "Discord webhook URL to notify after each redeem attempt. Leave empty to disable.",
        default: "",
        restartNeeded: false
    },
    testWebhook: {
        type: OptionType.COMPONENT,
        description: "Send a test message to the configured webhook.",
        component: TestWebhookButton
    }
});

