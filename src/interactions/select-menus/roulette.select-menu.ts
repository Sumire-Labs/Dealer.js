import {
  type StringSelectMenuInteraction,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} from 'discord.js';
import { registerSelectMenuHandler } from '../handler.js';
import { findOrCreateUser } from '../../database/repositories/user.repository.js';
import {
  type OutsideBetType,
  type RouletteBet,
  getOutsideBetNumbers,
} from '../../config/roulette.js';
import { getSessionBet, executeRouletteSpin } from '../buttons/roulette.buttons.js';
import { formatChips } from '../../utils/formatters.js';

const OUTSIDE_BET_ACTIONS = new Set<string>([
  'red', 'black', 'even', 'odd', 'low', 'high', '1st12', '2nd12', '3rd12',
]);

const OUTSIDE_BET_LABELS: Record<string, string> = {
  red: '赤',
  black: '黒',
  even: '偶数',
  odd: '奇数',
  low: 'Low (1-18)',
  high: 'High (19-36)',
  '1st12': '1st12 (1-12)',
  '2nd12': '2nd12 (13-24)',
  '3rd12': '3rd12 (25-36)',
};

const INSIDE_BET_MODAL_CONFIG: Record<string, { title: string; label: string; placeholder: string }> = {
  straight: {
    title: 'ルーレット — ストレートベット',
    label: '番号 (0〜36)',
    placeholder: '例: 14',
  },
  split: {
    title: 'ルーレット — スプリットベット',
    label: '隣接する2つの番号（カンマ区切り）',
    placeholder: '例: 14,15',
  },
  street: {
    title: 'ルーレット — ストリートベット',
    label: '行の先頭番号 (1,4,7,...34)',
    placeholder: '例: 4 → 4,5,6',
  },
  corner: {
    title: 'ルーレット — コーナーベット',
    label: '左上の番号',
    placeholder: '例: 4 → 4,5,7,8',
  },
  sixline: {
    title: 'ルーレット — シックスラインベット',
    label: '行の先頭番号 (1,4,7,...31)',
    placeholder: '例: 4 → 4,5,6,7,8,9',
  },
};

async function handleRouletteSelectMenu(interaction: StringSelectMenuInteraction): Promise<void> {
  const parts = interaction.customId.split(':');
  const ownerId = parts[2];

  if (interaction.user.id !== ownerId) {
    await interaction.reply({
      content: 'これはあなたのルーレットではありません！ `/roulette` で遊んでください。',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const userId = interaction.user.id;
  const selected = interaction.values[0];

  // Inside bet → show modal
  if (selected in INSIDE_BET_MODAL_CONFIG) {
    const config = INSIDE_BET_MODAL_CONFIG[selected];
    const modal = new ModalBuilder()
      .setCustomId(`roulette_modal:${selected}:${userId}`)
      .setTitle(config.title)
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('numbers')
            .setLabel(config.label)
            .setStyle(TextInputStyle.Short)
            .setPlaceholder(config.placeholder)
            .setRequired(true),
        ),
      );
    await interaction.showModal(modal);
    return;
  }

  // Outside bet → spin immediately
  if (OUTSIDE_BET_ACTIONS.has(selected)) {
    const betType = selected as OutsideBetType;
    const bet = getSessionBet(userId);

    const user = await findOrCreateUser(userId);
    if (user.chips < bet) {
      await interaction.reply({
        content: `チップが不足しています！ 残高: ${formatChips(user.chips)}`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const rouletteBet: RouletteBet = {
      type: betType,
      numbers: getOutsideBetNumbers(betType),
    };

    await executeRouletteSpin(interaction, userId, bet, rouletteBet, OUTSIDE_BET_LABELS[selected]);
  }
}

registerSelectMenuHandler('roulette_select', handleRouletteSelectMenu as never);
