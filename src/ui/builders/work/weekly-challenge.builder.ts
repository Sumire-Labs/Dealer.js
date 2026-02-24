import {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { CasinoTheme } from '../../themes/casino.theme.js';
import { formatChips } from '../../../utils/formatters.js';

export interface WeeklyChallengeViewData {
  userId: string;
  challenges: { name: string; emoji: string; progress: number; target: number; completed: boolean; reward: bigint }[];
  allCompleted: boolean;
  allCompletedBonus: bigint;
}

function buildProgressBar(current: number, target: number): string {
  const ratio = Math.min(current / target, 1);
  const filled = Math.round(ratio * 8);
  const empty = 8 - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}

export function buildWeeklyChallengeView(data: WeeklyChallengeViewData): ContainerBuilder {
  const container = new ContainerBuilder()
    .setAccentColor(CasinoTheme.colors.gold)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(CasinoTheme.prefixes.weeklyChallenges),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    );

  if (data.challenges.length === 0) {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent('今週のチャレンジはまだ割り当てられていません。'),
    );
  } else {
    const lines = data.challenges.map(c => {
      const icon = c.completed ? '✅' : '⬜';
      const bar = buildProgressBar(c.progress, c.target);
      return `${icon} **${c.name}**\n${bar} ${c.progress}/${c.target}　報酬: ${formatChips(c.reward)}`;
    });

    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(lines.join('\n\n')),
    );

    if (data.allCompleted) {
      container.addSeparatorComponents(
        new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
      );
      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `🎉 **全チャレンジ達成！** ボーナス: ${formatChips(data.allCompletedBonus)}`,
        ),
      );
    }
  }

  container.addSeparatorComponents(
    new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
  );

  container.addActionRowComponents(
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`work:panel:${data.userId}`)
        .setLabel('💼 戻る')
        .setStyle(ButtonStyle.Secondary),
    ),
  );

  return container;
}
