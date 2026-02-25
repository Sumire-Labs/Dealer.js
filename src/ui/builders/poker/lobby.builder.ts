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
import type {PokerSessionState} from '../../../games/poker/poker.session.js';

export function buildPokerLobbyView(
  session: PokerSessionState,
  remainingSeconds: number,
): ContainerBuilder {
  const playerList = session.players.length > 0
    ? session.players.map((p, i) =>
      `> **${i + 1}.** ${p.displayName}  —  ${formatChips(p.stack)}`,
    ).join('\n')
    : '> *参加者を待っています...*';

  return new ContainerBuilder()
    .setAccentColor(CasinoTheme.colors.darkGreen)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(CasinoTheme.prefixes.poker),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        '**Texas Hold\'em**\n`バイイン` $2,000 ~ $100,000  |  `SB / BB` $100 / $200',
      ),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `**参加者 (${session.players.length} / 6)**\n${playerList}`,
      ),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `⏰ 締切まで **${remainingSeconds}** 秒`,
      ),
    )
    .addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`poker:join:${session.id}`)
          .setLabel('🎮 参加')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`poker:start:${session.id}:${session.ownerId}`)
          .setLabel('▶️ ゲーム開始')
          .setStyle(ButtonStyle.Success),
      ),
    );
}
