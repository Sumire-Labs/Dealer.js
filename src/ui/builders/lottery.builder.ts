import {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { CasinoTheme } from '../themes/casino.theme.js';
import { formatChips } from '../../utils/formatters.js';
import { configService } from '../../config/config.service.js';
import { S } from '../../config/setting-defs.js';
import type { LotteryRound, LotteryTicket } from '@prisma/client';

export type LotteryTab = 'current' | 'history';

export interface LotteryViewData {
  userId: string;
  round: LotteryRound;
  userTickets: LotteryTicket[];
  totalTickets: number;
  tab: LotteryTab;
  // History tab
  recentRounds?: (LotteryRound & { _count: { tickets: number } })[];
}

export function buildLotteryView(data: LotteryViewData): ContainerBuilder {
  const { userId, round, userTickets, totalTickets, tab } = data;

  const container = new ContainerBuilder()
    .setAccentColor(CasinoTheme.colors.purple)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(CasinoTheme.prefixes.lottery),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    );

  if (tab === 'current') {
    // Jackpot and countdown
    const drawTimestamp = Math.floor(round.drawAt.getTime() / 1000);
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `💰 **ジャックポット**: ${formatChips(round.jackpot)}\n` +
        `⏰ 次回抽選: <t:${drawTimestamp}:R> | 🎫 ${totalTickets}枚`,
      ),
    );

    container.addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    );

    // User's tickets
    if (userTickets.length > 0) {
      const ticketLines = userTickets.map(
        t => `🎫 [${t.numbers.join('] [')}]`,
      );
      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `あなたのチケット (${userTickets.length}/${configService.getNumber(S.lotteryMaxTickets)}):\n${ticketLines.join('\n')}`,
        ),
      );
    } else {
      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent('まだチケットを購入していません。'),
      );
    }

    container.addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    );

    // Action buttons
    const canBuy = userTickets.length < configService.getNumber(S.lotteryMaxTickets);
    container.addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`lottery:buy:${userId}`)
          .setLabel(`🎫 番号選択 (${formatChips(configService.getBigInt(S.lotteryTicketPrice))})`)
          .setStyle(ButtonStyle.Primary)
          .setDisabled(!canBuy),
        new ButtonBuilder()
          .setCustomId(`lottery:quick_buy:${userId}`)
          .setLabel(`🎲 ランダム購入`)
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(!canBuy),
      ),
    );
  } else {
    // History tab
    const recentRounds = data.recentRounds ?? [];
    if (recentRounds.length === 0) {
      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent('まだ抽選履歴がありません。'),
      );
    } else {
      const lines = recentRounds.map(r => {
        const numbers = r.winningNumbers.length > 0
          ? `[${r.winningNumbers.join('] [')}]`
          : '???';
        const drawnDate = r.drawnAt
          ? `<t:${Math.floor(r.drawnAt.getTime() / 1000)}:d>`
          : '-';
        return `#${r.roundNumber} | ${drawnDate} | ${numbers} | 💰${formatChips(r.jackpot)} | 🎫${r._count.tickets}枚`;
      });
      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(lines.join('\n')),
      );
    }
  }

  container.addSeparatorComponents(
    new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
  );

  // Tab buttons
  container.addActionRowComponents(
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`lottery:tab_current:${userId}`)
        .setLabel('🎟️ 現在')
        .setStyle(tab === 'current' ? ButtonStyle.Primary : ButtonStyle.Secondary)
        .setDisabled(tab === 'current'),
      new ButtonBuilder()
        .setCustomId(`lottery:tab_history:${userId}`)
        .setLabel('📜 履歴')
        .setStyle(tab === 'history' ? ButtonStyle.Primary : ButtonStyle.Secondary)
        .setDisabled(tab === 'history'),
    ),
  );

  return container;
}
