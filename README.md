<div align="center">

# NitroSniper

A Vencord/Equicord plugin to auto snipe nitro gift codes, with multi user token support.

[![GitHub License](https://img.shields.io/github/license/aboveproof/NitroSniper?color=%236e738d)](https://github.com/aboveproof/NitroSniper/blob/main/LICENSE)
[![Status](https://img.shields.io/badge/Status-Working-73b369)](#)
[![Requires](https://img.shields.io/badge/Requires-Vencord%20%2F%20Equicord-5865f2)](https://docs.vencord.dev/installing/)

</div>

| ![Demo of plugin](assets/snipes.png) |
| :---: |
| This isn't even the full screenshot. See [here](assets/full.png) |

## Features

| Feature | What it does |
| --- | --- |
| Auto snipe | Claims gift codes the moment they're posted |
| Multi token | Alt accounts listen and claim through their own gateway connections |
| Redeem strategies | Current account first, alts first, alts only, race, or current only |
| Blacklists / whitelists | Right-click any server, channel, or DM to block or allow it |
| Duplicate protection | The same code posted ten times gets claimed once |
| Claim stats | Lifetime tally with hit rate, per-account wins, last claim time |
| Webhook notifications | Claim and failure embeds sent to your webhook |

## Installation

1. Install [Vencord](https://docs.vencord.dev/installing/) or [Equicord](https://github.com/Equicord/Equicord)
2. Clone this repo into the `src/userplugins` folder of your client mod
3. Build and inject, then enable NitroSniper in settings

## Usage

The plugin runs the moment it's enabled. It watches every channel your accounts can see, and claims any nitro gift link posted in them.

**Tokens:** Settings → NitroSniper → Token Manager. Paste alt tokens one at a time or in bulk. Enabled tokens listen in real time and can claim codes depending on your chosen strategy.

**Blocking locations:** Right-click a server, channel, thread, DM, or group DM and pick Sniper: Blacklist / Whitelist. Blacklists always win over whitelists. All whitelists empty means claim everywhere.

**Webhooks:** Paste a Discord webhook URL in settings to get an embed on every attempt, including a running claim tally in the footer.

> [!CAUTION]
> **Use at your own risk**
>
> This plugin is against Discord's Terms of Service and can get you banned. In addition to that, Vencord does not in any way endorse this plugin. This is usermade and you will have to follow [Vencord's Installation Method](https://docs.vencord.dev/installing/) to build and install this plugin.

## Credits

- [neoarz](https://github.com/neoarz) — original creator of the NitroSniper Equicord plugin
- [Vencord](https://github.com/vencord/vencord)
- [Equicord](https://github.com/Equicord/Equicord) (The fork im currently using)
- [Discord](https://discord.com) for putting captcha on token based sniping inspiring me to make this :D

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details

## Support

Make a github issue if you find any bugs or have any questions or preferably dm me on discord `neoarz`.
<br>
<sub>If you find this project useful, consider leaving a star, would mean alot!! ❤️</sub>
