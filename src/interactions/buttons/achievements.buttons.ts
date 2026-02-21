import { type ButtonInteraction, MessageFlags } from 'discord.js';
import { registerButtonHandler } from '../handler.js';
import { findOrCreateUser } from '../../database/repositories/user.repository.js';
import { getUnlockedIds } from '../../database/repositories/achievement.repository.js';
import {
  buildAchievementsView,
  type AchievementTab,
} from '../../ui/builders/achievements.builder.js';

async function handleAchievementButton(interaction: ButtonInteraction): Promise<void> {
  const parts = interaction.customId.split(':');
  const action = parts[1];
  const ownerId = parts[2];

  if (interaction.user.id !== ownerId) {
    await interaction.reply({
      content: '`/achievements` で自分の実績を確認してください。',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const targetId = parts[3];

  if (action === 'tab') {
    const tab = parts[4] as AchievementTab;
    await showAchievements(interaction, ownerId, targetId, tab, 0);
    return;
  }

  if (action === 'page') {
    const tab = parts[4] as AchievementTab;
    const page = parseInt(parts[5]);
    await showAchievements(interaction, ownerId, targetId, tab, page);
    return;
  }
}

async function showAchievements(
  interaction: ButtonInteraction,
  userId: string,
  targetId: string,
  tab: AchievementTab,
  page: number,
): Promise<void> {
  await findOrCreateUser(targetId);
  const unlockedIds = await getUnlockedIds(targetId);

  // Try to get username from interaction client
  const targetUser = await interaction.client.users.fetch(targetId).catch(() => null);
  const username = targetUser?.displayName ?? 'Unknown';

  const view = buildAchievementsView(userId, targetId, username, unlockedIds, tab, page);

  await interaction.update({
    components: [view],
    flags: MessageFlags.IsComponentsV2,
  });
}

registerButtonHandler('ach', handleAchievementButton as never);
