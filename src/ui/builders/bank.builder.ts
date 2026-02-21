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
import { formatChips, formatTimeDelta } from '../../utils/formatters.js';
import type { LoanSummary } from '../../database/services/loan.service.js';

export function buildBankMainView(
  userId: string,
  balance: bigint,
  summary: LoanSummary,
  penaltyRemainingMs: number,
): ContainerBuilder {
  const container = new ContainerBuilder()
    .setAccentColor(CasinoTheme.colors.gold)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(CasinoTheme.prefixes.bank),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`💰 残高: ${formatChips(balance)}`),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    );

  // Loan status section
  if (summary.loanCount > 0) {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `📋 ローン状況\n` +
        `　借入件数: ${summary.loanCount}件\n` +
        `　元金合計: ${formatChips(summary.totalPrincipal)}\n` +
        `　利息合計: ${formatChips(summary.totalInterest)}\n` +
        `　総返済額: ${formatChips(summary.totalOwed)}\n` +
        `　追加借入可能額: ${formatChips(summary.remainingCapacity)}`,
      ),
    );
  } else {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `📋 ローン状況\n` +
        `　借入なし\n` +
        `　借入可能額: ${formatChips(summary.remainingCapacity)}`,
      ),
    );
  }

  // Penalty warning
  if (penaltyRemainingMs > 0) {
    container.addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    );
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `⚠️ 破産ペナルティ中 — 報酬 -10%（残り ${formatTimeDelta(penaltyRemainingMs)}）`,
      ),
    );
  }

  container.addSeparatorComponents(
    new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
  );

  container.addActionRowComponents(
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`bank:borrow:${userId}`)
        .setLabel('💵 借入')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`bank:repay:${userId}`)
        .setLabel('💳 返済')
        .setStyle(ButtonStyle.Success)
        .setDisabled(summary.loanCount === 0),
      new ButtonBuilder()
        .setCustomId(`bank:bankrupt:${userId}`)
        .setLabel('💀 破産')
        .setStyle(ButtonStyle.Danger)
        .setDisabled(summary.loanCount === 0),
    ),
  );

  return container;
}

export function buildBankruptcyConfirmView(
  userId: string,
  totalOwed: bigint,
  currentBalance: bigint,
): ContainerBuilder {
  return new ContainerBuilder()
    .setAccentColor(CasinoTheme.colors.red)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent('⚠️ 破産申告の確認'),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `・全ローン（${formatChips(totalOwed)}）を帳消し\n` +
        `・全チップ（${formatChips(currentBalance)}）を没収\n` +
        `・${formatChips(2_500n)} を支給\n` +
        `・1時間のギャンブル報酬 -10% ペナルティ`,
      ),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    )
    .addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`bank:confirm_bankrupt:${userId}`)
          .setLabel('✅ 実行')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId(`bank:cancel:${userId}`)
          .setLabel('❌ キャンセル')
          .setStyle(ButtonStyle.Secondary),
      ),
    );
}
