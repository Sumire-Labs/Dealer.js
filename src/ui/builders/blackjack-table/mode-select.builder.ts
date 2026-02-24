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

export function buildModeSelectView(userId: string, bet: bigint): ContainerBuilder {
  return new ContainerBuilder()
    .setAccentColor(CasinoTheme.colors.darkGreen)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(CasinoTheme.prefixes.blackjack),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `💰 BET: ${formatChips(bet)}\nモードを選択してください:`,
      ),
    )
    .addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`bj:solo:${userId}:${bet}`)
          .setLabel('🃏 ソロ')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`bj:table:${userId}:${bet}`)
          .setLabel('🎪 テーブル（マルチ）')
          .setStyle(ButtonStyle.Success),
      ),
    );
}
