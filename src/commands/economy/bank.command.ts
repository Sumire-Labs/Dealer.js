import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  MessageFlags,
} from 'discord.js';
import { registerCommand } from '../registry.js';
import { findOrCreateUser } from '../../database/repositories/user.repository.js';
import { getLoanSummary, getBankruptcyPenaltyRemaining } from '../../database/services/loan.service.js';
import { getBankAccountSummary } from '../../database/services/bank-account.service.js';
import { buildBankMainView } from '../../ui/builders/bank.builder.js';
import { configService } from '../../config/config.service.js';
import { S } from '../../config/setting-defs.js';

const data = new SlashCommandBuilder()
  .setName('bank')
  .setDescription('銀行 — 口座・送金・借入・返済')
  .toJSON();

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const userId = interaction.user.id;
  const user = await findOrCreateUser(userId);
  const loanSummary = await getLoanSummary(userId);
  const accountSummary = await getBankAccountSummary(userId);
  const penaltyRemaining = getBankruptcyPenaltyRemaining(user.bankruptAt);

  const view = buildBankMainView({
    userId,
    walletBalance: user.chips,
    bankBalance: accountSummary.bankBalance,
    loanSummary,
    penaltyRemainingMs: penaltyRemaining,
    lastInterestAt: accountSummary.lastInterestAt,
    estimatedInterest: accountSummary.estimatedInterest,
    baseInterestRate: configService.getBigInt(S.bankInterestRate),
  });

  await interaction.reply({
    components: [view],
    flags: MessageFlags.IsComponentsV2,
  });
}

registerCommand({ data, execute: execute as never });
