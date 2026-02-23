import { type ButtonInteraction, MessageFlags } from 'discord.js';
import { registerButtonHandler } from '../handler.js';
import { claimDaily } from '../../database/services/daily.service.js';
import { getBalance } from '../../database/services/economy.service.js';
import { getDailyMissions } from '../../database/services/mission.service.js';
import {
  buildDailyBonusClaimed,
  buildDailyBonusAlreadyClaimed,
  buildDailyBonusUnclaimed,
  buildDailyMissionsView,
} from '../../ui/builders/daily.builder.js';
import { buildAchievementNotification } from '../../database/services/achievement.service.js';
import { buildMissionNotification } from '../../database/services/mission.service.js';
import { getJstResetDate, getNextResetTimestamp } from '../../database/services/daily.service.js';
import { findOrCreateUser } from '../../database/repositories/user.repository.js';

async function handleDailyButton(interaction: ButtonInteraction): Promise<void> {
  const parts = interaction.customId.split(':');
  const action = parts[1];
  const ownerId = parts[2];

  if (interaction.user.id !== ownerId) {
    await interaction.reply({
      content: 'これはあなたのパネルではありません！ `/daily` で開いてください。',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const userId = interaction.user.id;

  switch (action) {
    case 'tab_bonus': {
      const user = await findOrCreateUser(userId);
      const todayKey = getJstResetDate(new Date());
      const lastKey = user.lastDaily ? getJstResetDate(user.lastDaily) : null;

      if (lastKey === todayKey) {
        const nextClaimAt = getNextResetTimestamp();
        const view = buildDailyBonusAlreadyClaimed(nextClaimAt, user.chips, userId);
        await interaction.update({ components: [view], flags: MessageFlags.IsComponentsV2 });
      } else {
        const view = buildDailyBonusUnclaimed(user.chips, userId);
        await interaction.update({ components: [view], flags: MessageFlags.IsComponentsV2 });
      }
      break;
    }

    case 'tab_missions': {
      const missions = await getDailyMissions(userId);
      const balance = await getBalance(userId);
      const view = buildDailyMissionsView(missions, balance, userId);
      await interaction.update({ components: [view], flags: MessageFlags.IsComponentsV2 });
      break;
    }

    case 'claim': {
      const result = await claimDaily(userId);

      if (!result.success) {
        const balance = await getBalance(userId);
        const nextClaimAt = result.nextClaimAt ?? getNextResetTimestamp();
        const view = buildDailyBonusAlreadyClaimed(nextClaimAt, balance, userId);
        await interaction.update({ components: [view], flags: MessageFlags.IsComponentsV2 });
        return;
      }

      const view = buildDailyBonusClaimed(
        result.amount!,
        result.streak!,
        result.newBalance!,
        userId,
      );
      await interaction.update({ components: [view], flags: MessageFlags.IsComponentsV2 });

      // Achievement notification
      if (result.newlyUnlocked && result.newlyUnlocked.length > 0) {
        await interaction.followUp({
          content: buildAchievementNotification(result.newlyUnlocked),
          flags: MessageFlags.Ephemeral,
        });
      }

      // Mission notification
      if (result.missionsCompleted && result.missionsCompleted.length > 0) {
        await interaction.followUp({
          content: buildMissionNotification(result.missionsCompleted),
          flags: MessageFlags.Ephemeral,
        });
      }
      break;
    }
  }
}

registerButtonHandler('daily', handleDailyButton as never);
