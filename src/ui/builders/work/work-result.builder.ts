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
import type { WorkResult } from '../../../database/services/work.service.js';
import { getMasteryTier } from '../../../config/work-mastery.js';

export function buildWorkResultView(result: WorkResult, userId: string): ContainerBuilder {
  const container = new ContainerBuilder()
    .setAccentColor(
      result.event!.type === 'accident'
        ? CasinoTheme.colors.red
        : result.event!.type === 'great_success'
          ? CasinoTheme.colors.gold
          : CasinoTheme.colors.darkGreen,
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(CasinoTheme.prefixes.work),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `${result.jobEmoji} **${result.jobName}** — ${result.shiftLabel}シフト${result.specialShiftName ? ` (${result.specialShiftName})` : ''}${result.isPromoted ? ' ⭐' : ''}`,
      ),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    );

  // Event result
  const eventLine = `${result.event!.emoji} **${result.event!.label}**`;
  const flavorLine = result.flavorText ? `\n「${result.flavorText}」` : '';
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(eventLine + flavorLine),
  );

  container.addSeparatorComponents(
    new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
  );

  // Pay breakdown
  const payLines: string[] = [];
  if (result.event!.type === 'accident') {
    payLines.push('💰 基本給: $0 (事故による減給)');
  } else {
    payLines.push(`💰 基本給: ${formatChips(result.shiftPay!)}`);
  }
  if (result.tipAmount && result.tipAmount > 0n) {
    payLines.push(`💵 チップ: ${formatChips(result.tipAmount)}`);
  }
  if (result.masteryBonus && result.masteryBonus > 0n) {
    payLines.push(`${result.masteryTier?.emoji ?? '🥉'} 熟練度ボーナス: +${formatChips(result.masteryBonus)}`);
  }
  if (result.toolBonus && result.toolBonus > 0n) {
    payLines.push(`🔧 ツールボーナス: +${formatChips(result.toolBonus)}`);
  }
  if (result.streakBonus && result.streakBonus > 0) {
    payLines.push(`🔥 連勤ボーナス (${result.streak}日): +${result.streakBonus}%`);
  }

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(payLines.join('\n')),
  );

  container.addSeparatorComponents(
    new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
  );

  // Summary
  const levelUpLine = result.newLevel! > result.oldLevel!
    ? `\n🎉 **レベルアップ！** Lv.${result.oldLevel} → Lv.${result.newLevel}`
    : '';
  const xpText = result.xpForNextLevel !== null
    ? `${result.newXp}/${result.xpForNextLevel}`
    : `${result.newXp} (MAX)`;

  // Mastery progress
  let masteryLine = '';
  if (result.masteryTier) {
    masteryLine = `\n${result.masteryTier.emoji} 熟練度: ${result.masteryTier.name} (${result.masteryShiftsCompleted}回)`;
    if (result.masteryLeveledUp) {
      masteryLine += `\n🎊 **熟練度UP！** ${getMasteryTier(result.oldMasteryLevel!).name} → ${result.masteryTier.name}`;
    }
  }

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `📊 報酬: **${formatChips(result.totalPay!)}** | XP: +${result.xpGained}\n📈 Lv.${result.newLevel} → XP: ${xpText}\n💰 残高: **${formatChips(result.newBalance!)}**${levelUpLine}${masteryLine}`,
    ),
  );

  container.addSeparatorComponents(
    new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
  );

  // Work again + overtime buttons
  const actionButtons: ButtonBuilder[] = [
    new ButtonBuilder()
      .setCustomId(`work:panel:${userId}:${result.jobId}`)
      .setLabel('💼 もう一度働く')
      .setStyle(ButtonStyle.Primary),
  ];

  if (result.overtimeAvailable) {
    actionButtons.push(
      new ButtonBuilder()
        .setCustomId(`work:overtime:${userId}`)
        .setLabel('⏰ 残業する')
        .setStyle(ButtonStyle.Danger),
    );
  }

  container.addActionRowComponents(
    new ActionRowBuilder<ButtonBuilder>().addComponents(...actionButtons),
  );

  return container;
}
