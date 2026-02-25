import {type ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder,} from 'discord.js';
import {registerCommand} from '../registry.js';
import {claimDaily, getNextResetTimestamp} from '../../database/services/daily.service.js';
import {buildDailyBonusAlreadyClaimed, buildDailyBonusClaimed,} from '../../ui/builders/daily.builder.js';
import {buildAchievementNotification} from '../../database/services/achievement.service.js';
import {buildMissionNotification} from '../../database/services/mission.service.js';
import {getBalance} from '../../database/services/economy.service.js';

const data = new SlashCommandBuilder()
  .setName('daily')
  .setDescription('デイリーチップボーナスを受け取る')
  .toJSON();

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const userId = interaction.user.id;
  const result = await claimDaily(userId);

  if (!result.success) {
    const balance = await getBalance(userId);
    const nextClaimAt = result.nextClaimAt ?? getNextResetTimestamp();
    const view = buildDailyBonusAlreadyClaimed(nextClaimAt, balance, userId);

    await interaction.reply({
      components: [view],
      flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
    });
    return;
  }

  const view = buildDailyBonusClaimed(
    result.amount!,
    result.streak!,
    result.newBalance!,
    userId,
  );

  await interaction.reply({
    components: [view],
    flags: MessageFlags.IsComponentsV2,
  });

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
}

registerCommand({ data, execute: execute as never });
