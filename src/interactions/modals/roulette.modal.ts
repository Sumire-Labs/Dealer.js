import {
  type ModalSubmitInteraction,
  MessageFlags,
} from 'discord.js';
import { registerModalHandler } from '../handler.js';
import { findOrCreateUser, getTodayStats } from '../../database/repositories/user.repository.js';
import { processGameResult } from '../../database/services/economy.service.js';
import {
  spinRoulette,
  evaluateBet,
} from '../../games/roulette/roulette.engine.js';
import {
  type RouletteBet,
  type InsideBetType,
  validateSplit,
  validateStreet,
  validateCorner,
  validateSixLine,
  getNumberEmoji,
} from '../../config/roulette.js';
import { rouletteSessionManager } from '../buttons/roulette.buttons.js';
import { buildRouletteSpinningView } from '../../ui/builders/roulette.builder.js';
import { playRouletteAnimation } from '../../ui/animations/roulette.animation.js';
import { formatChips } from '../../utils/formatters.js';
import { buildAchievementNotification } from '../../database/services/achievement.service.js';
import { buildMissionNotification } from '../../database/services/mission.service.js';
import { configService } from '../../config/config.service.js';
import { S } from '../../config/setting-defs.js';

async function handleRouletteModal(interaction: ModalSubmitInteraction): Promise<void> {
  const parts = interaction.customId.split(':');
  const betType = parts[1] as InsideBetType;
  const ownerId = parts[2];

  if (interaction.user.id !== ownerId) {
    await interaction.reply({
      content: 'これはあなたのルーレットではありません！',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const userId = interaction.user.id;
  const input = interaction.fields.getTextInputValue('numbers').trim();
  const bet = rouletteSessionManager.get(userId) ?? configService.getBigInt(S.minBet);

  // Parse and validate numbers based on bet type
  let rouletteBet: RouletteBet | null = null;
  let betLabel: string;

  switch (betType) {
    case 'straight': {
      const n = parseInt(input);
      if (isNaN(n) || n < 0 || n > 36) {
        await interaction.reply({
          content: '0〜36の番号を入力してください。',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      rouletteBet = { type: 'straight', numbers: [n] };
      betLabel = `ストレート ${getNumberEmoji(n)}`;
      break;
    }

    case 'split': {
      const nums = input.split(',').map(s => parseInt(s.trim()));
      if (nums.length !== 2 || nums.some(n => isNaN(n))) {
        await interaction.reply({
          content: '隣接する2つの番号をカンマ区切りで入力してください。（例: 14,15）',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      if (!validateSplit(nums[0], nums[1])) {
        await interaction.reply({
          content: `${nums[0]} と ${nums[1]} は隣接していません。水平（同じ行で差1）または垂直（差3）の番号を選んでください。`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      rouletteBet = { type: 'split', numbers: nums };
      betLabel = `スプリット ${nums.map(getNumberEmoji).join('/')}`;
      break;
    }

    case 'street': {
      const n = parseInt(input);
      const covered = validateStreet(n);
      if (!covered) {
        await interaction.reply({
          content: '行の先頭番号を入力してください。（1, 4, 7, 10, ... 34）',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      rouletteBet = { type: 'street', numbers: covered };
      betLabel = `ストリート ${covered.join(',')}`;
      break;
    }

    case 'corner': {
      const n = parseInt(input);
      const covered = validateCorner(n);
      if (!covered) {
        await interaction.reply({
          content: '左上の番号を入力してください。列1or2の番号（1〜32、3の倍数以外）',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      rouletteBet = { type: 'corner', numbers: covered };
      betLabel = `コーナー ${covered.join(',')}`;
      break;
    }

    case 'sixline': {
      const n = parseInt(input);
      const covered = validateSixLine(n);
      if (!covered) {
        await interaction.reply({
          content: '行の先頭番号を入力してください。（1, 4, 7, ... 31）',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      rouletteBet = { type: 'sixline', numbers: covered };
      betLabel = `シックスライン ${covered[0]}〜${covered[5]}`;
      break;
    }

    default:
      await interaction.reply({
        content: '無効なベットタイプです。',
        flags: MessageFlags.Ephemeral,
      });
      return;
  }

  // Check max bet (defense against config change during session)
  const maxBet = configService.getBigInt(S.maxRoulette);
  if (maxBet > 0n && bet > maxBet) {
    await interaction.reply({
      content: `ベット上限は${formatChips(maxBet)}です。ベット額を下げてください。`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Check balance
  const user = await findOrCreateUser(userId);
  if (user.chips < bet) {
    await interaction.reply({
      content: `チップが不足しています！ 残高: ${formatChips(user.chips)}`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Show spinning start
  const spinView = buildRouletteSpinningView([0, 17, 32]);
  await interaction.reply({
    components: [spinView],
    flags: MessageFlags.IsComponentsV2,
  });

  // Spin
  const result = spinRoulette();
  const multiplier = evaluateBet(result, rouletteBet);
  const won = multiplier > 0;

  // Process game result
  const gameResult = await processGameResult(
    userId,
    'ROULETTE',
    bet,
    multiplier,
    {
      betType: rouletteBet.type,
      numbers: rouletteBet.numbers,
      resultNumber: result.number,
      resultColor: result.color,
      isRouletteStraightWin: rouletteBet.type === 'straight' && won,
    },
  );

  const todayStats = await getTodayStats(userId);

  // Play animation + show result
  await playRouletteAnimation(
    interaction,
    result,
    betLabel,
    won,
    bet,
    gameResult.payout,
    gameResult.net,
    gameResult.newBalance,
    userId,
    todayStats,
  );

  // Achievement notification
  if (gameResult.newlyUnlocked.length > 0) {
    await interaction.followUp({
      content: buildAchievementNotification(gameResult.newlyUnlocked),
      flags: MessageFlags.Ephemeral,
    });
  }

  // Mission notification
  if (gameResult.missionsCompleted.length > 0) {
    await interaction.followUp({
      content: buildMissionNotification(gameResult.missionsCompleted),
      flags: MessageFlags.Ephemeral,
    });
  }
}

registerModalHandler('roulette_modal', handleRouletteModal as never);
