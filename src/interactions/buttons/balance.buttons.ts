import { type ButtonInteraction, MessageFlags } from 'discord.js';
import { registerButtonHandler } from '../handler.js';
import { findOrCreateUser } from '../../database/repositories/user.repository.js';
import { getUserRank } from '../../database/repositories/leaderboard.repository.js';
import { buildBalanceView, type BalanceTab } from '../../ui/builders/balance.builder.js';

async function handleBalanceButton(interaction: ButtonInteraction): Promise<void> {
  const parts = interaction.customId.split(':');
  const tab = parts[1] as BalanceTab;
  const ownerId = parts[2];
  const targetId = parts[3];

  if (interaction.user.id !== ownerId) {
    await interaction.reply({
      content: 'これはあなたのパネルではありません！ `/balance` で確認してください。',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const targetUser = await interaction.client.users.fetch(targetId);
  const dbUser = await findOrCreateUser(targetId);
  const rank = await getUserRank(targetId);

  const container = buildBalanceView({
    userId: ownerId,
    targetId,
    username: targetUser.displayName,
    chips: dbUser.chips,
    bankBalance: dbUser.bankBalance,
    totalWon: dbUser.totalWon,
    totalLost: dbUser.totalLost,
    totalGames: dbUser.totalGames,
    rank,
    isSelf: ownerId === targetId,
  }, tab);

  await interaction.update({
    components: [container],
    flags: MessageFlags.IsComponentsV2,
  });
}

registerButtonHandler('bal', handleBalanceButton as never);
