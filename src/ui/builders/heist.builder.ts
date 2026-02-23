import {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from 'discord.js';
import { CasinoTheme } from '../themes/casino.theme.js';
import { formatChips } from '../../utils/formatters.js';
import { HEIST_MAX_PLAYERS } from '../../config/constants.js';
import {
  calculateSuccessRate,
  calculateMultiplierRange,
  calculateMaxEntryFee,
  type HeistCalcParams,
} from '../../games/heist/heist.engine.js';
import type { HeistSessionState } from '../../games/heist/heist.session.js';
import type { PhaseResult } from '../../games/heist/heist.engine.js';
import {
  HEIST_TARGETS,
  HEIST_RISKS,
  HEIST_APPROACHES,
  HEIST_TARGET_MAP,
  HEIST_RISK_MAP,
  HEIST_APPROACH_MAP,
  type HeistTarget,
  type HeistRiskLevel,
  type HeistApproach,
} from '../../config/heist.js';

// --- Selection Views (ephemeral) ---

export function buildHeistTargetSelectView(userId: string, amount: bigint): ContainerBuilder {
  const container = new ContainerBuilder()
    .setAccentColor(CasinoTheme.colors.red)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(CasinoTheme.prefixes.heist),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `💰 参加費: **${formatChips(amount)}**\n\n` +
        '**ターゲットを選択:**',
      ),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    );

  const targetLines = HEIST_TARGETS.map(t => {
    const rateSign = t.successRateModifier >= 0 ? '+' : '';
    return `${t.emoji} **${t.name}** — ${t.description}\n` +
      `　成功率: ${rateSign}${t.successRateModifier}% | 倍率: ${t.multiplierMin}x〜${t.multiplierMax}x | 上限: ${formatChips(t.maxEntryFee)}`;
  });

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(targetLines.join('\n\n')),
  );

  container.addSeparatorComponents(
    new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
  );

  const targetOptions = HEIST_TARGETS.map(t => {
    const rateSign = t.successRateModifier >= 0 ? '+' : '';
    return new StringSelectMenuOptionBuilder()
      .setLabel(`${t.emoji} ${t.name}`)
      .setDescription(`報酬 ${t.multiplierMin}x〜${t.multiplierMax}x | 成功率 ${rateSign}${t.successRateModifier}%`)
      .setValue(t.id);
  });

  container.addActionRowComponents(
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`heist_select:target:${userId}:${amount}`)
        .setPlaceholder('🎯 ターゲットを選択...')
        .addOptions(targetOptions),
    ),
  );

  return container;
}

export function buildHeistRiskSelectView(
  userId: string,
  amount: bigint,
  targetId: HeistTarget,
): ContainerBuilder {
  const target = HEIST_TARGET_MAP.get(targetId)!;

  const container = new ContainerBuilder()
    .setAccentColor(CasinoTheme.colors.red)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(CasinoTheme.prefixes.heist),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `${target.emoji} **${target.name}** | 💰 ${formatChips(amount)}\n\n` +
        '**リスクレベルを選択:**',
      ),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    );

  const riskLines = HEIST_RISKS.map(r => {
    const maxFee = calculateMaxEntryFee(targetId, r.id);
    const rateSign = r.successRateModifier >= 0 ? '+' : '';
    return `${r.emoji} **${r.name}** — ${r.description}\n` +
      `　成功率: ${rateSign}${r.successRateModifier}% | 倍率: x${r.multiplierScale} | 最大参加費: ${formatChips(maxFee)}`;
  });

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(riskLines.join('\n\n')),
  );

  container.addSeparatorComponents(
    new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
  );

  const riskOptions = HEIST_RISKS.map(r => {
    const maxFee = calculateMaxEntryFee(targetId, r.id);
    const rateSign = r.successRateModifier >= 0 ? '+' : '';
    return new StringSelectMenuOptionBuilder()
      .setLabel(`${r.emoji} ${r.name}`)
      .setDescription(`成功率 ${rateSign}${r.successRateModifier}% | 倍率 x${r.multiplierScale} | 上限 ${formatChips(maxFee)}`)
      .setValue(r.id);
  });

  container.addActionRowComponents(
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`heist_select:risk:${userId}:${amount}:${targetId}`)
        .setPlaceholder('⚡ リスクレベルを選択...')
        .addOptions(riskOptions),
    ),
  );

  return container;
}

export function buildHeistApproachSelectView(
  userId: string,
  amount: bigint,
  targetId: HeistTarget,
  riskId: HeistRiskLevel,
): ContainerBuilder {
  const target = HEIST_TARGET_MAP.get(targetId)!;
  const risk = HEIST_RISK_MAP.get(riskId)!;

  const container = new ContainerBuilder()
    .setAccentColor(CasinoTheme.colors.red)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(CasinoTheme.prefixes.heist),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `${target.emoji} **${target.name}** | ${risk.emoji} ${risk.name} | 💰 ${formatChips(amount)}\n\n` +
        '**アプローチを選択:**',
      ),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    );

  const approachLines = HEIST_APPROACHES.map(a => {
    const rateSign = a.successRateModifier >= 0 ? '+' : '';
    return `${a.emoji} **${a.name}** — ${a.description}\n` +
      `　成功率: ${rateSign}${a.successRateModifier}% | 倍率: x${a.multiplierScale}`;
  });

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(approachLines.join('\n\n')),
  );

  container.addSeparatorComponents(
    new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
  );

  // Approach SelectMenu (Group)
  const groupOptions = HEIST_APPROACHES.map(a => {
    const rateSign = a.successRateModifier >= 0 ? '+' : '';
    return new StringSelectMenuOptionBuilder()
      .setLabel(`${a.emoji} ${a.name} (グループ)`)
      .setDescription(`成功率 ${rateSign}${a.successRateModifier}% | 倍率 x${a.multiplierScale}`)
      .setValue(`group:${a.id}`);
  });

  // Approach SelectMenu (Solo)
  const soloOptions = HEIST_APPROACHES.map(a => {
    const rateSign = a.successRateModifier >= 0 ? '+' : '';
    return new StringSelectMenuOptionBuilder()
      .setLabel(`${a.emoji} ${a.name} (ソロ)`)
      .setDescription(`成功率 ${rateSign}${a.successRateModifier}% | 倍率 x${a.multiplierScale}`)
      .setValue(`solo:${a.id}`);
  });

  container.addActionRowComponents(
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`heist_select:approach:${userId}:${amount}:${targetId}:${riskId}`)
        .setPlaceholder('🔫 アプローチを選択...')
        .addOptions([...groupOptions, ...soloOptions]),
    ),
  );

  return container;
}

// --- Confirmation View ---

export function buildHeistConfirmView(
  userId: string,
  amount: bigint,
  targetId: HeistTarget,
  riskId: HeistRiskLevel,
  approachId: HeistApproach,
  isSolo: boolean,
): ContainerBuilder {
  const target = HEIST_TARGET_MAP.get(targetId)!;
  const risk = HEIST_RISK_MAP.get(riskId)!;
  const approach = HEIST_APPROACH_MAP.get(approachId)!;

  const params: HeistCalcParams = {
    playerCount: 1,
    target: targetId,
    riskLevel: riskId,
    approach: approachId,
    isSolo,
  };
  const successRate = calculateSuccessRate(params);
  const { min, max } = calculateMultiplierRange(params);
  const minReturn = BigInt(Math.round(Number(amount) * min));
  const maxReturn = BigInt(Math.round(Number(amount) * max));
  const mode = isSolo ? 'solo' : 'group';

  const container = new ContainerBuilder()
    .setAccentColor(CasinoTheme.colors.red)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(CasinoTheme.prefixes.heist),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent('**📋 最終確認**'),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `${target.emoji} **ターゲット**: ${target.name}\n` +
        `${risk.emoji} **リスク**: ${risk.name}\n` +
        `${approach.emoji} **アプローチ**: ${approach.name}\n` +
        `👤 **モード**: ${isSolo ? 'ソロ' : 'グループ'}\n` +
        `💰 **参加費**: ${formatChips(amount)}\n` +
        `📊 **成功率**: ${successRate}%\n` +
        `💎 **倍率**: ${min}x〜${max}x\n` +
        `💵 **推定リターン**: ${formatChips(minReturn)}〜${formatChips(maxReturn)}\n` +
        `📝 **フェーズ数**: ${target.phases.length}`,
      ),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    )
    .addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`heist:confirm:${userId}:${amount}:${targetId}:${riskId}:${approachId}:${mode}`)
          .setLabel('🔫 決行')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId(`heist:back:${userId}:${amount}:${targetId}:${riskId}`)
          .setLabel('↩ 戻る')
          .setStyle(ButtonStyle.Secondary),
      ),
    );

  return container;
}

// --- Lobby View ---

export function buildHeistLobbyView(
  session: HeistSessionState,
  remainingSeconds: number,
): ContainerBuilder {
  const params: HeistCalcParams = {
    playerCount: session.players.length,
    target: session.target,
    riskLevel: session.riskLevel,
    approach: session.approach,
    isSolo: session.isSolo,
  };
  const successRate = calculateSuccessRate(params);
  const { min, max } = calculateMultiplierRange(params);

  const target = HEIST_TARGET_MAP.get(session.target)!;
  const risk = HEIST_RISK_MAP.get(session.riskLevel)!;
  const approach = HEIST_APPROACH_MAP.get(session.approach)!;

  const playerList = session.players
    .map(p => `🔫 <@${p.userId}>${p.isHost ? ' (主催者)' : ''}`)
    .join('\n');

  const container = new ContainerBuilder()
    .setAccentColor(CasinoTheme.colors.red)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(CasinoTheme.prefixes.heist),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `${target.emoji} **${target.name}** | ${risk.emoji} ${risk.name} | ${approach.emoji} ${approach.name}\n` +
        `💰 **参加費**: ${formatChips(session.entryFee)}\n` +
        `📊 **成功率**: ${successRate}% | 💎 **倍率**: ${min}x〜${max}x\n` +
        `⏰ **残り**: ${remainingSeconds}秒`,
      ),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `**参加者 (${session.players.length}/${HEIST_MAX_PLAYERS}):**\n${playerList}`,
      ),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    )
    .addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`heist:join:${session.channelId}`)
          .setLabel(`🔫 参加 (${formatChips(session.entryFee)})`)
          .setStyle(ButtonStyle.Danger)
          .setDisabled(session.players.length >= HEIST_MAX_PLAYERS),
        new ButtonBuilder()
          .setCustomId(`heist:start:${session.channelId}:${session.hostId}`)
          .setLabel('🚀 開始')
          .setStyle(ButtonStyle.Primary),
      ),
    );

  return container;
}

// --- Phase Animation View ---

export function buildHeistPhaseView(
  completedPhases: PhaseResult[],
  currentPhase?: { emoji: string; name: string },
): ContainerBuilder {
  const container = new ContainerBuilder()
    .setAccentColor(CasinoTheme.colors.red)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(CasinoTheme.prefixes.heist),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    );

  const lines: string[] = [];
  for (const phase of completedPhases) {
    const icon = phase.success ? '✅' : '❌';
    lines.push(`${phase.emoji} **${phase.name}** ${icon} ${phase.description}`);
  }

  if (currentPhase) {
    lines.push(`${currentPhase.emoji} **${currentPhase.name}** ⏳ 進行中...`);
  }

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(lines.join('\n')),
  );

  return container;
}

// --- Result View ---

export function buildHeistResultView(
  success: boolean,
  phaseResults: PhaseResult[],
  players: { userId: string }[],
  entryFee: bigint,
  multiplier: number,
  targetId: HeistTarget,
  arrested: boolean,
): ContainerBuilder {
  const target = HEIST_TARGET_MAP.get(targetId)!;
  const title = success
    ? `🔫 ━━━ ${target.emoji} ${target.name} HEIST 成功！ ━━━ 🔫`
    : `🔫 ━━━ ${target.emoji} ${target.name} HEIST 失敗... ━━━ 🔫`;

  const container = new ContainerBuilder()
    .setAccentColor(success ? CasinoTheme.colors.gold : CasinoTheme.colors.red)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(title),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    );

  // Phase results
  const phaseLines = phaseResults.map(p => {
    const icon = p.success ? '✅' : '❌';
    return `${p.emoji} **${p.name}** ${icon} ${p.description}`;
  });
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(phaseLines.join('\n')),
  );

  container.addSeparatorComponents(
    new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
  );

  if (success) {
    const payout = BigInt(Math.round(Number(entryFee) * multiplier));
    const payoutLines = players.map(
      p => `<@${p.userId}>: ${formatChips(entryFee)} → ${formatChips(payout)}`,
    );
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `💰 **配当 (x${multiplier}):**\n${payoutLines.join('\n')}`,
      ),
    );
  } else {
    const lossLines = players.map(
      p => `<@${p.userId}>: -${formatChips(entryFee)}`,
    );
    let failText = `💸 **損失:**\n${lossLines.join('\n')}`;
    if (arrested) {
      failText += '\n\n🔒 **全員逮捕！** 刑務所に送られました。\n`/prison` で状況を確認できます。';
    }
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(failText),
    );
  }

  return container;
}

export function buildHeistCancelledView(reason: string): ContainerBuilder {
  return new ContainerBuilder()
    .setAccentColor(CasinoTheme.colors.silver)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(CasinoTheme.prefixes.heist),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`❌ ${reason}`),
    );
}
