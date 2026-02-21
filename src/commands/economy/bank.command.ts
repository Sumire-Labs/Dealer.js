import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  MessageFlags,
} from 'discord.js';
import { registerCommand } from '../registry.js';
import { findOrCreateUser } from '../../database/repositories/user.repository.js';
import { getLoanSummary, getBankruptcyPenaltyRemaining } from '../../database/services/loan.service.js';
import { buildBankMainView } from '../../ui/builders/bank.builder.js';

const data = new SlashCommandBuilder()
  .setName('bank')
  .setDescription('銀行 — 借入・返済・自己破産')
  .toJSON();

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const userId = interaction.user.id;
  const user = await findOrCreateUser(userId);
  const summary = await getLoanSummary(userId);
  const penaltyRemaining = getBankruptcyPenaltyRemaining(user.bankruptAt);

  const view = buildBankMainView(userId, user.chips, summary, penaltyRemaining);

  await interaction.reply({
    components: [view],
    flags: MessageFlags.IsComponentsV2,
  });
}

registerCommand({ data, execute: execute as never });
