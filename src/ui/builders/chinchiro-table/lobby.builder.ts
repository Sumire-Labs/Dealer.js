import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ContainerBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    TextDisplayBuilder,
} from 'discord.js';
import {CasinoTheme} from '../../themes/casino.theme.js';
import {formatChips} from '../../../utils/formatters.js';
import {CHINCHIRO_MAX_PLAYERS, CHINCHIRO_MIN_PLAYERS} from '../../../config/constants.js';
import type {ChinchiroTableSession} from '../../../games/chinchiro/chinchiro-table.session.js';

export function buildChinchiroLobbyView(
    session: ChinchiroTableSession,
    remainingSeconds: number,
): ContainerBuilder {
    const playerList = session.players.map((p) => {
        const hostTag = p.isHost ? ' (ホスト)' : '';
        return `🎲 <@${p.userId}>${hostTag}`;
    }).join('\n');

    const container = new ContainerBuilder()
        .setAccentColor(CasinoTheme.colors.darkGreen)
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(CasinoTheme.prefixes.chinchiroTable),
        )
        .addSeparatorComponents(
            new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
        )
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `マルチプレイヤー チンチロリン\n💰 ベット: ${formatChips(session.bet)} | 👥 ${CHINCHIRO_MIN_PLAYERS}~${CHINCHIRO_MAX_PLAYERS}人 | 🔄 全員1回親`,
            ),
        )
        .addSeparatorComponents(
            new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
        )
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `参加者 (${session.players.length}/${CHINCHIRO_MAX_PLAYERS}):\n${playerList}`,
            ),
        )
        .addSeparatorComponents(
            new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
        )
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`⏰ 残り: ${remainingSeconds}秒`),
        );

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId(`ct:join:${session.channelId}`)
            .setLabel(`🎮 参加 (${formatChips(session.bet)})`)
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId(`ct:start:${session.channelId}:${session.hostId}`)
            .setLabel('▶️ ゲーム開始')
            .setStyle(ButtonStyle.Success),
    );

    container.addActionRowComponents(row);
    return container;
}
