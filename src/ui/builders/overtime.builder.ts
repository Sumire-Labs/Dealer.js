import {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { CasinoTheme } from '../themes/casino.theme.js';
import { formatChips } from '../../utils/formatters.js';
import { OVERTIME_MULTIPLIERS } from '../../config/constants.js';
import { configService } from '../../config/config.service.js';
import { S } from '../../config/setting-defs.js';

export interface OvertimeViewData {
  userId: string;
  jobName: string;
  jobEmoji: string;
  round: number; // 0-indexed
  riskPercent: number;
  multiplier: number;
  accumulatedBonus: bigint;
  baseShiftPay: bigint;
}

export function buildOvertimeConfirmView(data: OvertimeViewData): ContainerBuilder {
  const potentialBonus = BigInt(Math.round(Number(data.baseShiftPay) * (data.multiplier - 1)));

  const container = new ContainerBuilder()
    .setAccentColor(CasinoTheme.colors.purple)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent('⏰ ━━━ 残業 ━━━ ⏰'),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `${data.jobEmoji} **${data.jobName}** — 残業 ${data.round + 1}/${configService.getNumber(S.overtimeMaxRounds)}回目`,
      ),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `📊 **倍率:** ${data.multiplier}x\n⚠️ **事故リスク:** ${data.riskPercent}%\n💰 **獲得可能ボーナス:** ${formatChips(potentialBonus)}\n${data.accumulatedBonus > 0n ? `📦 **累計ボーナス:** ${formatChips(data.accumulatedBonus)}（失敗時に没収）` : ''}`,
      ),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    );

  container.addActionRowComponents(
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`work:ot_go:${data.userId}`)
        .setLabel(`⏰ 残業する (${data.multiplier}x)`)
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(`work:ot_stop:${data.userId}`)
        .setLabel('🏠 帰宅する')
        .setStyle(ButtonStyle.Secondary),
    ),
  );

  return container;
}

export interface OvertimeResultViewData {
  userId: string;
  jobName: string;
  jobEmoji: string;
  success: boolean;
  round: number;
  roundBonus: bigint;
  accumulatedBonus: bigint;
  lostBonus?: bigint;
  newBalance: bigint;
  canContinue: boolean;
}

export function buildOvertimeResultView(data: OvertimeResultViewData): ContainerBuilder {
  const color = data.success ? CasinoTheme.colors.gold : CasinoTheme.colors.red;

  const container = new ContainerBuilder()
    .setAccentColor(color)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent('⏰ ━━━ 残業結果 ━━━ ⏰'),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `${data.jobEmoji} **${data.jobName}** — 残業 ${data.round + 1}/${configService.getNumber(S.overtimeMaxRounds)}回目`,
      ),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    );

  if (data.success) {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `✨ **残業成功！**\n💰 ボーナス: +${formatChips(data.roundBonus)}\n📦 累計残業ボーナス: ${formatChips(data.accumulatedBonus)}\n💰 残高: **${formatChips(data.newBalance)}**`,
      ),
    );
  } else {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `💥 **事故発生！残業失敗...**\n❌ 残業ボーナス **${formatChips(data.lostBonus ?? 0n)}** 没収\n💰 残高: **${formatChips(data.newBalance)}**\n\n※ベースシフト給は保持されています`,
      ),
    );
  }

  container.addSeparatorComponents(
    new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
  );

  if (data.success && data.canContinue) {
    const nextRound = data.round + 1;
    const nextMultiplier = OVERTIME_MULTIPLIERS[nextRound] ?? 0;
    container.addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`work:overtime:${data.userId}`)
          .setLabel(`⏰ 次の残業 (${nextMultiplier}x)`)
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId(`work:ot_stop:${data.userId}`)
          .setLabel('🏠 帰宅する')
          .setStyle(ButtonStyle.Secondary),
      ),
    );
  } else {
    container.addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`work:panel:${data.userId}`)
          .setLabel('💼 ワークパネルに戻る')
          .setStyle(ButtonStyle.Primary),
      ),
    );
  }

  return container;
}

export function buildOvertimeStopView(
  userId: string,
  accumulatedBonus: bigint,
  newBalance: bigint,
): ContainerBuilder {
  const container = new ContainerBuilder()
    .setAccentColor(CasinoTheme.colors.darkGreen)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent('⏰ ━━━ 残業終了 ━━━ ⏰'),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `🏠 **お疲れ様でした！**\n📦 残業ボーナス合計: ${formatChips(accumulatedBonus)}\n💰 残高: **${formatChips(newBalance)}**`,
      ),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    );

  container.addActionRowComponents(
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`work:panel:${userId}`)
        .setLabel('💼 ワークパネルに戻る')
        .setStyle(ButtonStyle.Primary),
    ),
  );

  return container;
}
