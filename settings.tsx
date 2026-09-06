/*
Made with ❤️ by neoarz
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

