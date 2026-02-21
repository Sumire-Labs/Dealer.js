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
import { HEIST_MAX_PLAYERS } from '../../config/constants.js';
import { calculateSuccessRate } from '../../games/heist/heist.engine.js';
import type { HeistSessionState } from '../../games/heist/heist.session.js';
import type { PhaseResult } from '../../games/heist/heist.engine.js';

export function buildHeistLobbyView(
  session: HeistSessionState,
  remainingSeconds: number,
): ContainerBuilder {
  const successRate = calculateSuccessRate(session.players.length);
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
        `💰 **参加費**: ${formatChips(session.entryFee)}\n` +
        `📊 **成功率**: ${successRate}% | ⏰ **残り**: ${remainingSeconds}秒`,
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

export function buildHeistResultView(
  success: boolean,
  phaseResults: PhaseResult[],
  players: { userId: string }[],
  entryFee: bigint,
  multiplier: number,
): ContainerBuilder {
  const title = success
    ? '🔫 ━━━ HEIST 成功！ ━━━ 🔫'
    : '🔫 ━━━ HEIST 失敗... ━━━ 🔫';

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
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `💸 **損失:**\n${lossLines.join('\n')}`,
      ),
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
