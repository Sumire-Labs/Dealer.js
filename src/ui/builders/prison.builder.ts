import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  TextDisplayBuilder,
} from 'discord.js';
import {CasinoTheme} from '../themes/casino.theme.js';
import {formatChips, formatTimeDelta} from '../../utils/formatters.js';
import type {PrisonSession} from '../../games/prison/prison.session.js';

export function buildPrisonView(
    session: PrisonSession,
    jailbreakCooldownRemaining: number,
    hasPrisonKey: boolean = false,
): ContainerBuilder {
    const remaining = Math.max(0, session.releaseAt - Date.now());
    const targetLine = session.heistTarget ? `\n📋 逮捕理由: **${session.heistTarget}** への強盗失敗` : '';

    const container = new ContainerBuilder()
        .setAccentColor(CasinoTheme.colors.red)
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(CasinoTheme.prefixes.prison),
        )
        .addSeparatorComponents(
            new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
        )
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `🔒 **あなたは収監中です！**${targetLine}\n\n` +
                `⏰ 残り刑期: **${formatTimeDelta(remaining)}**\n` +
                `💰 罰金額: **${formatChips(session.fineAmount)}**`,
            ),
        )
        .addSeparatorComponents(
            new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
        )
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                '**釈放方法:**\n' +
                `1. 💰 罰金を支払う (${formatChips(session.fineAmount)})\n` +
                '2. 🔓 脱獄に挑戦する (成功率30%)\n' +
                '3. 🔑 脱獄キーを使う（確実）\n' +
                '4. ⏰ 刑期満了まで待つ',
            ),
        )
        .addSeparatorComponents(
            new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
        );

    const jailbreakOnCooldown = jailbreakCooldownRemaining > 0;
    const jailbreakLabel = jailbreakOnCooldown
        ? `🔓 脱獄 (${formatTimeDelta(jailbreakCooldownRemaining)})`
        : '🔓 脱獄する';

    container.addActionRowComponents(
        new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setCustomId(`prison:pay:${session.userId}`)
                .setLabel(`💰 罰金を払う (${formatChips(session.fineAmount)})`)
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(`prison:jailbreak:${session.userId}`)
                .setLabel(jailbreakLabel)
                .setStyle(ButtonStyle.Danger)
                .setDisabled(jailbreakOnCooldown),
            new ButtonBuilder()
                .setCustomId(`prison:use_key:${session.userId}`)
                .setLabel('🔑 脱獄キーを使う')
                .setStyle(ButtonStyle.Success)
                .setDisabled(!hasPrisonKey),
        ),
    );

    return container;
}

export function buildJailbreakResultView(
    success: boolean,
    session: PrisonSession | undefined,
): ContainerBuilder {
    if (success) {
        return new ContainerBuilder()
            .setAccentColor(CasinoTheme.colors.darkGreen)
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(CasinoTheme.prefixes.prison),
            )
            .addSeparatorComponents(
                new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
            )
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    '🔓 **脱獄成功！**\n\n' +
                    '鉄格子を突破し、見事に脱出しました！\n' +
                    '罰金の支払いも不要です。自由をお楽しみください！',
                ),
            );
    }

    const remaining = session ? Math.max(0, session.releaseAt - Date.now()) : 0;

    return new ContainerBuilder()
        .setAccentColor(CasinoTheme.colors.red)
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(CasinoTheme.prefixes.prison),
        )
        .addSeparatorComponents(
            new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
        )
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                '❌ **脱獄失敗...**\n\n' +
                '看守に見つかってしまいました！\n' +
                `刑期が延長されました: **${formatTimeDelta(remaining)}**`,
            ),
        );
}

export function buildReleasedView(): ContainerBuilder {
    return new ContainerBuilder()
        .setAccentColor(CasinoTheme.colors.darkGreen)
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(CasinoTheme.prefixes.prison),
        )
        .addSeparatorComponents(
            new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
        )
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                '💰 **罰金支払い完了！**\n\n' +
                '釈放されました。今後は気をつけてください！',
            ),
        );
}

export function buildFreeView(): ContainerBuilder {
    return new ContainerBuilder()
        .setAccentColor(CasinoTheme.colors.darkGreen)
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(CasinoTheme.prefixes.prison),
        )
        .addSeparatorComponents(
            new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
        )
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                '✅ **あなたは自由です！**\n\n' +
                '現在、収監されていません。',
            ),
        );
}
