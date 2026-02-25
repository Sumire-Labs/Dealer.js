import {type ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder,} from 'discord.js';
import {registerCommand} from '../registry.js';
import {buildBankViewData} from '../../database/services/bank-view.service.js';
import {buildBankMainView} from '../../ui/builders/bank.builder.js';

const data = new SlashCommandBuilder()
  .setName('bank')
  .setDescription('銀行 — 口座・送金・借入・返済・定期預金')
  .toJSON();

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const viewData = await buildBankViewData(interaction.user.id);

  const view = buildBankMainView(viewData);

  await interaction.reply({
    components: [view],
    flags: MessageFlags.IsComponentsV2,
  });
}

registerCommand({ data, execute: execute as never });
