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
import type { DailyMission } from '@prisma/client';
import { MISSION_MAP, type MissionDifficulty } from '../../config/missions.js';
import { configService } from '../../config/config.service.js';
import { S } from '../../config/setting-defs.js';

export type DailyTab = 'bonus' | 'missions';

const DIFFICULTY_LABEL: Record<MissionDifficulty, string> = {
  easy: '🟢 Easy',
  medium: '🟡 Medium',
  hard: '🔴 Hard',
};

function buildTabRow(userId: string, activeTab: DailyTab): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`daily:tab_bonus:${userId}`)
      .setLabel('🎁 ボーナス')
      .setStyle(activeTab === 'bonus' ? ButtonStyle.Primary : ButtonStyle.Secondary)
      .setDisabled(activeTab === 'bonus'),
    new ButtonBuilder()
      .setCustomId(`daily:tab_missions:${userId}`)
      .setLabel('🎯 ミッション')
      .setStyle(activeTab === 'missions' ? ButtonStyle.Primary : ButtonStyle.Secondary)
      .setDisabled(activeTab === 'missions'),
    new ButtonBuilder()
      .setCustomId(`daily:mission_help:${userId}`)
      .setLabel('❓ ヘルプ')
      .setStyle(ButtonStyle.Secondary),
  );
}

// --- Bonus tab ---

export function buildDailyBonusClaimed(
  amount: bigint,
  streak: number,
  newBalance: bigint,
  userId: string,
): ContainerBuilder {
  return new ContainerBuilder()
    .setAccentColor(CasinoTheme.colors.gold)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(CasinoTheme.prefixes.daily),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `✅ **${formatChips(amount)}** を受け取りました！\n🔥 連続ログイン: **${streak}日目**\n💰 残高: **${formatChips(newBalance)}**`,
      ),
    )
    .addActionRowComponents(buildTabRow(userId, 'bonus'));
}

export function buildDailyBonusAlreadyClaimed(
  nextClaimAt: number,
  balance: bigint,
  userId: string,
): ContainerBuilder {
  const nextClaimUnix = Math.floor(nextClaimAt / 1000);

  return new ContainerBuilder()
    .setAccentColor(CasinoTheme.colors.red)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(CasinoTheme.prefixes.daily),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `⏰ 本日のボーナスは受取済みです！\n次回: <t:${nextClaimUnix}:R>\n💰 残高: **${formatChips(balance)}**`,
      ),
    )
    .addActionRowComponents(buildTabRow(userId, 'bonus'));
}

export function buildDailyBonusUnclaimed(
  balance: bigint,
  userId: string,
): ContainerBuilder {
  return new ContainerBuilder()
    .setAccentColor(CasinoTheme.colors.gold)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(CasinoTheme.prefixes.daily),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `今日のボーナスを受け取れます！\n💰 残高: **${formatChips(balance)}**`,
      ),
    )
    .addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`daily:claim:${userId}`)
          .setLabel('✅ 受け取る')
          .setStyle(ButtonStyle.Success),
      ),
    )
    .addActionRowComponents(buildTabRow(userId, 'bonus'));
}

// --- Missions tab ---

export function buildDailyMissionsView(
  missions: DailyMission[],
  balance: bigint,
  userId: string,
): ContainerBuilder {
  const date = missions[0]?.date ?? new Date().toISOString().slice(0, 10);

  const missionLines = missions.map(m => {
    const def = MISSION_MAP.get(m.missionKey);
    const name = def?.name ?? m.missionKey;
    const reward = formatChips(m.reward);

    if (m.completed) {
      return `✅ ${name} [${m.target}/${m.target}] — ${reward} ✔️`;
    }
    const icon = m.progress > 0 ? '🔶' : '🔴';
    return `${icon} ${name} [${m.progress}/${m.target}] — ${reward}`;
  });

  const completedCount = missions.filter(m => m.completed).length;
  const totalCount = missions.length;

  let content = `📅 ${date} のミッション\n`;
  content += '────────────────\n';
  content += missionLines.join('\n');
  content += '\n────────────────\n';
  content += `🏆 コンプリートボーナス: ${formatChips(configService.getBigInt(S.missionCompleteBonus))} [${completedCount}/${totalCount}]`;
  if (completedCount === totalCount) {
    content += ' ✔️';
  }
  content += `\n💰 残高: **${formatChips(balance)}**`;

  return new ContainerBuilder()
    .setAccentColor(CasinoTheme.colors.purple)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(CasinoTheme.prefixes.missions),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(content),
    )
    .addActionRowComponents(buildTabRow(userId, 'missions'));
}

// --- Mission help view ---

export function buildDailyMissionsHelpView(
  missions: DailyMission[],
  balance: bigint,
  userId: string,
): ContainerBuilder {
  const missionLines = missions.map(m => {
    const def = MISSION_MAP.get(m.missionKey);
    const name = def?.name ?? m.missionKey;
    const description = def?.description ?? '';
    const difficulty = def?.difficulty ?? 'easy';
    const label = DIFFICULTY_LABEL[difficulty];
    return `${label}　**${name}**\n　　${description}`;
  });

  let content = missionLines.join('\n\n');
  content += `\n────────────────\n💰 残高: **${formatChips(balance)}**`;

  return new ContainerBuilder()
    .setAccentColor(CasinoTheme.colors.purple)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent('📖 ミッションガイド'),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(content),
    )
    .addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`daily:tab_missions:${userId}`)
          .setLabel('🔙 戻る')
          .setStyle(ButtonStyle.Secondary),
      ),
    );
}
