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
import { JOBS } from '../../config/jobs.js';
import { TEAM_SHIFT_MAX_PLAYERS } from '../../config/constants.js';
import { configService } from '../../config/config.service.js';
import { S } from '../../config/setting-defs.js';
import type { TeamShiftSession } from '../../games/work/team-shift.session.js';
import type { WorkResult } from '../../database/services/work.service.js';
import type { TeamEvent } from '../../config/team-events.js';

const TEAM_PREFIX = '👥 ━━━ TEAM SHIFT ━━━ 👥';

export function buildTeamShiftTypeSelectView(userId: string): ContainerBuilder {
  const container = new ContainerBuilder()
    .setAccentColor(CasinoTheme.colors.purple)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(TEAM_PREFIX),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `👥 **チームシフト**\n2〜${TEAM_SHIFT_MAX_PLAYERS}人で協力ワーク！\n人数ボーナス: +${configService.getNumber(S.teamShiftBonus)}%/人\n\nシフトタイプを選択してください：`,
      ),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    );

  container.addActionRowComponents(
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`team:create:${userId}:short`)
        .setLabel('⚡ 短時間')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`team:create:${userId}:normal`)
        .setLabel('📋 通常')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`team:create:${userId}:long`)
        .setLabel('💪 長時間')
        .setStyle(ButtonStyle.Primary),
    ),
  );

  container.addActionRowComponents(
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`work:panel:${userId}`)
        .setLabel('💼 戻る')
        .setStyle(ButtonStyle.Secondary),
    ),
  );

  return container;
}

export function buildTeamShiftLobbyView(
  session: TeamShiftSession,
  remainingSec: number,
): ContainerBuilder {
  const playerList = session.players
    .map(p => `${p.isHost ? '👑' : '👤'} <@${p.userId}>`)
    .join('\n');

  const teamBonus = (session.players.length - 1) * configService.getNumber(S.teamShiftBonus);

  const container = new ContainerBuilder()
    .setAccentColor(CasinoTheme.colors.purple)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(TEAM_PREFIX),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `📋 **チームシフト募集中！**\nシフト: **${session.shiftType === 'short' ? '⚡ 短時間' : session.shiftType === 'normal' ? '📋 通常' : '💪 長時間'}**\n⏰ 残り: **${remainingSec}秒**`,
      ),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `**参加者 (${session.players.length}/${TEAM_SHIFT_MAX_PLAYERS}):**\n${playerList}\n\n💰 チームボーナス: +${teamBonus}%`,
      ),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    );

  const buttons: ButtonBuilder[] = [
    new ButtonBuilder()
      .setCustomId(`team:join:${session.channelId}`)
      .setLabel('👤 参加する')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(session.players.length >= TEAM_SHIFT_MAX_PLAYERS || session.status !== 'lobby'),
  ];

  if (session.players.length >= 2 && session.status === 'lobby') {
    buttons.push(
      new ButtonBuilder()
        .setCustomId(`team:start:${session.channelId}:${session.hostId}`)
        .setLabel('🚀 開始する')
        .setStyle(ButtonStyle.Success),
    );
  }

  buttons.push(
    new ButtonBuilder()
      .setCustomId(`team:cancel:${session.channelId}:${session.hostId}`)
      .setLabel('❌ 解散')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(session.status !== 'lobby'),
  );

  container.addActionRowComponents(
    new ActionRowBuilder<ButtonBuilder>().addComponents(...buttons),
  );

  return container;
}

export function buildTeamShiftJobSelectView(
  userId: string,
  channelId: string,
  workLevel: number,
): ContainerBuilder {
  const container = new ContainerBuilder()
    .setAccentColor(CasinoTheme.colors.gold)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`🎯 <@${userId}> ジョブを選択：`),
    );

  const availableJobs = JOBS.filter(j => j.requiredLevel <= workLevel);
  const buttons = availableJobs.map(job =>
    new ButtonBuilder()
      .setCustomId(`team:job:${userId}:${channelId}:${job.id}`)
      .setLabel(`${job.emoji} ${job.name}`)
      .setStyle(ButtonStyle.Secondary),
  );

  for (let i = 0; i < buttons.length; i += 5) {
    container.addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(...buttons.slice(i, i + 5)),
    );
  }

  return container;
}

export interface TeamShiftResultData {
  results: WorkResult[];
  teamSize: number;
  teamEvent?: TeamEvent;
  teamBonusPercent: number;
}

export function buildTeamShiftResultView(data: TeamShiftResultData): ContainerBuilder {
  const container = new ContainerBuilder()
    .setAccentColor(CasinoTheme.colors.gold)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(TEAM_PREFIX),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `👥 **チームシフト完了！** (${data.teamSize}人)\n💰 チームボーナス: **+${data.teamBonusPercent}%**`,
      ),
    );

  if (data.teamEvent) {
    container.addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    );
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `${data.teamEvent.emoji} **チームイベント: ${data.teamEvent.name}**\n${data.teamEvent.description}\n報酬倍率: **${data.teamEvent.payMultiplier}x**`,
      ),
    );
  }

  container.addSeparatorComponents(
    new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
  );

  const playerLines = data.results.map(r => {
    const eventEmoji = r.event?.emoji ?? '✅';
    return `${r.jobEmoji} **${r.jobName}** ${eventEmoji} ${r.event?.label ?? ''}\n　💰 ${formatChips(r.totalPay!)} | 📊 XP: +${r.xpGained}`;
  });

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `**個別結果:**\n${playerLines.join('\n\n')}`,
    ),
  );

  return container;
}
