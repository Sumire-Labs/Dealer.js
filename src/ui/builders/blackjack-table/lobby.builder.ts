import {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { CasinoTheme } from '../../themes/casino.theme.js';
import { formatChips } from '../../../utils/formatters.js';
import { BJ_TABLE_MAX_PLAYERS, BJ_TABLE_MIN_PLAYERS } from '../../../config/constants.js';
import type { BlackjackTableSession } from '../../../games/blackjack/blackjack-table.session.js';

export function buildBjTableLobbyView(
  session: BlackjackTableSession,
  remainingSeconds: number,
): ContainerBuilder {
  const playerList = session.players.map((p) => {
    const hostTag = p.isHost ? ' (ホスト)' : '';
    return `🃏 <@${p.userId}>${hostTag}`;
  }).join('\n');

  const container = new ContainerBuilder()
    .setAccentColor(CasinoTheme.colors.darkGreen)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(CasinoTheme.prefixes.blackjackTable),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `マルチプレイヤー ブラックジャック\n💰 ベット: ${formatChips(session.bet)} | 👥 ${BJ_TABLE_MIN_PLAYERS}~${BJ_TABLE_MAX_PLAYERS}人`,
      ),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `参加者 (${session.players.length}/${BJ_TABLE_MAX_PLAYERS}):\n${playerList}`,
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
      .setCustomId(`bjt:join:${session.channelId}`)
      .setLabel(`🎮 参加 (${formatChips(session.bet)})`)
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`bjt:start:${session.channelId}:${session.hostId}`)
      .setLabel('▶️ ゲーム開始')
      .setStyle(ButtonStyle.Success),
  );

  container.addActionRowComponents(row);
  return container;
}
