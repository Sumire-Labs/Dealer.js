import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ContainerBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    TextDisplayBuilder,
} from 'discord.js';
import {CasinoTheme} from '../../themes/casino.theme.js';
import type {WorkResult} from '../../../database/services/work.service.js';
import type {ScenarioChoice} from '../../../config/work-events.js';

export function buildMultiStepEventView(
  userId: string,
  result: WorkResult,
): ContainerBuilder {
  const scenario = result.scenario!;

  const container = new ContainerBuilder()
    .setAccentColor(CasinoTheme.colors.purple)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(CasinoTheme.prefixes.work),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `${result.jobEmoji} **${result.jobName}** — ${result.shiftLabel}シフト`,
      ),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`🎭 **イベント発生！**\n\n${scenario.prompt}`),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    );

  const choiceButtons = scenario.choices.map((choice: ScenarioChoice) =>
    new ButtonBuilder()
      .setCustomId(`work:choice:${userId}:${choice.id}`)
      .setLabel(`${choice.emoji} ${choice.label}`)
      .setStyle(ButtonStyle.Primary),
  );

  container.addActionRowComponents(
    new ActionRowBuilder<ButtonBuilder>().addComponents(...choiceButtons),
  );

  return container;
}
