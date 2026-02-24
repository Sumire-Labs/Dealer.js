import {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { formatChips } from '../../../utils/formatters.js';
import { TRANSACTION_TYPE_EMOJI, TRANSACTION_TYPE_LABEL, formatTransactionDate, type BankViewData } from './types.js';

export function buildHistoryTab(container: ContainerBuilder, data: BankViewData): void {
  const { userId } = data;
  const transactions = data.recentTransactions ?? [];
  const page = data.transactionPage ?? 1;
  const totalPages = data.transactionTotalPages ?? 1;

  if (transactions.length === 0) {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent('📜 取引履歴\n\n　取引履歴がありません。'),
    );
  } else {
    let historyText = '📜 取引履歴\n';
    for (const tx of transactions) {
      const emoji = TRANSACTION_TYPE_EMOJI[tx.type] ?? '❓';
      const label = TRANSACTION_TYPE_LABEL[tx.type] ?? tx.type;
      const date = formatTransactionDate(tx.createdAt);
      const amountStr = tx.amount >= 0n ? `+${formatChips(tx.amount)}` : formatChips(tx.amount);
      historyText += `\n${date}　${emoji} ${label}　${amountStr}`;
    }

    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(historyText),
    );
  }

  container.addSeparatorComponents(
    new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
  );

  // Pagination
  container.addActionRowComponents(
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`bank:history_prev:${userId}`)
        .setLabel('◀')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page <= 1),
      new ButtonBuilder()
        .setCustomId(`bank:history_page_info:${userId}`)
        .setLabel(`${page}/${totalPages}`)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true),
      new ButtonBuilder()
        .setCustomId(`bank:history_next:${userId}`)
        .setLabel('▶')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page >= totalPages),
    ),
  );
}
