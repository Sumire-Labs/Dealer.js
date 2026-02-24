import {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { formatChips, formatTimeDelta } from '../../../utils/formatters.js';
import type { BankViewData } from './types.js';

export function buildAccountTab(container: ContainerBuilder, data: BankViewData): void {
  const { userId, walletBalance, bankBalance, estimatedInterest } = data;

  // Balances
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `💰 ウォレット: ${formatChips(walletBalance)}\n` +
      `🏦 口座残高: ${formatChips(bankBalance)}`,
    ),
  );

  container.addSeparatorComponents(
    new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
  );

  // Interest info
  const rateDisplay = data.baseInterestRate === data.effectiveInterestRate
    ? `${data.baseInterestRate}%`
    : `${data.effectiveInterestRate}% (基本${data.baseInterestRate}%+ボーナス)`;
  let interestInfo = `📈 利息情報\n　日利: ${rateDisplay}`;
  if (data.hasInterestBooster) {
    interestInfo += `\n　📈 利息ブースター適用中 (x2)`;
  }
  interestInfo += '\n';
  if (estimatedInterest > 0n) {
    interestInfo += `　次回利息: ${formatChips(estimatedInterest)}（24時間ごと）`;
  } else {
    interestInfo += `　最低残高 $100 以上で利息が発生します`;
  }
  if (data.lastInterestAt) {
    const elapsed = Date.now() - data.lastInterestAt.getTime();
    const remaining = 24 * 60 * 60 * 1000 - elapsed;
    if (remaining > 0) {
      interestInfo += `\n　次回まで: ${formatTimeDelta(remaining)}`;
    } else {
      interestInfo += `\n　次回: まもなく付与`;
    }
  }

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(interestInfo),
  );

  container.addSeparatorComponents(
    new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
  );

  // Row 1: main actions
  container.addActionRowComponents(
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`bank:deposit:${userId}`)
        .setLabel('💰 入金')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`bank:withdraw:${userId}`)
        .setLabel('💵 出金')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`bank:transfer:${userId}`)
        .setLabel('📤 送金')
        .setStyle(ButtonStyle.Secondary),
    ),
  );

  // Row 2: quick actions + fixed deposit
  container.addActionRowComponents(
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`bank:quick_deposit_all:${userId}`)
        .setLabel('⏬ 全額入金')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`bank:quick_withdraw_all:${userId}`)
        .setLabel('⏫ 全額出金')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`bank:quick_deposit_half:${userId}`)
        .setLabel('↕ 半額入金')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`bank:tab_fixed:${userId}`)
        .setLabel('📌 定期預金')
        .setStyle(ButtonStyle.Secondary),
    ),
  );
}
