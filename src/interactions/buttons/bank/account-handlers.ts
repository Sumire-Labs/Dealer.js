import {
    ActionRowBuilder,
    type ButtonInteraction,
    MessageFlags,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
} from 'discord.js';
import {findOrCreateUser} from '../../../database/repositories/user.repository.js';
import {depositChips, withdrawChips} from '../../../database/services/bank-account.service.js';
import {buildBankViewData} from '../../../database/services/bank-view.service.js';
import {buildBankMainView} from '../../../ui/builders/bank.builder.js';

export async function handleDeposit(interaction: ButtonInteraction): Promise<void> {
  const modal = new ModalBuilder()
    .setCustomId(`bank_modal:deposit`)
    .setTitle('入金')
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('amount')
          .setLabel('入金額（ウォレットから口座へ）')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('例: 10000')
          .setRequired(true),
      ),
    );
  await interaction.showModal(modal);
}

export async function handleWithdraw(interaction: ButtonInteraction): Promise<void> {
  const modal = new ModalBuilder()
    .setCustomId(`bank_modal:withdraw`)
    .setTitle('出金')
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('amount')
          .setLabel('出金額（口座からウォレットへ）')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('例: 10000')
          .setRequired(true),
      ),
    );
  await interaction.showModal(modal);
}

export async function handleTransfer(interaction: ButtonInteraction, userId: string): Promise<void> {
  const data = await buildBankViewData(userId);
  const view = buildBankMainView(data, 'transfer_select');
  await interaction.update({
    components: [view],
    flags: MessageFlags.IsComponentsV2,
  });
}

export async function handleQuickDepositAll(interaction: ButtonInteraction, userId: string): Promise<void> {
  const user = await findOrCreateUser(userId);
  if (user.chips <= 0n) {
    await interaction.reply({ content: 'ウォレットにチップがありません。', flags: MessageFlags.Ephemeral });
    return;
  }
  try {
    await depositChips(userId, user.chips);
  } catch (error) {
    await interaction.reply({ content: `入金に失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}`, flags: MessageFlags.Ephemeral });
    return;
  }
  const data = await buildBankViewData(userId);
  const view = buildBankMainView(data, 'account');
  await interaction.update({ components: [view], flags: MessageFlags.IsComponentsV2 });
}

export async function handleQuickWithdrawAll(interaction: ButtonInteraction, userId: string): Promise<void> {
  const user = await findOrCreateUser(userId);
  if (user.bankBalance <= 0n) {
    await interaction.reply({ content: '口座にチップがありません。', flags: MessageFlags.Ephemeral });
    return;
  }
  try {
    await withdrawChips(userId, user.bankBalance);
  } catch (error) {
    await interaction.reply({ content: `出金に失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}`, flags: MessageFlags.Ephemeral });
    return;
  }
  const data = await buildBankViewData(userId);
  const view = buildBankMainView(data, 'account');
  await interaction.update({ components: [view], flags: MessageFlags.IsComponentsV2 });
}

export async function handleQuickDepositHalf(interaction: ButtonInteraction, userId: string): Promise<void> {
  const user = await findOrCreateUser(userId);
  const half = user.chips / 2n;
  if (half <= 0n) {
    await interaction.reply({ content: 'ウォレットにチップが不足しています。', flags: MessageFlags.Ephemeral });
    return;
  }
  try {
    await depositChips(userId, half);
  } catch (error) {
    await interaction.reply({ content: `入金に失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}`, flags: MessageFlags.Ephemeral });
    return;
  }
  const data = await buildBankViewData(userId);
  const view = buildBankMainView(data, 'account');
  await interaction.update({ components: [view], flags: MessageFlags.IsComponentsV2 });
}
