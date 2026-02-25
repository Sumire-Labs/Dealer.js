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
import {formatChips} from '../../../utils/formatters.js';
import {HEIST_MAX_PLAYERS} from '../../../config/constants.js';
import {
    calculateMultiplierRange,
    calculateSuccessRate,
    type HeistCalcParams,
} from '../../../games/heist/heist.engine.js';
import type {HeistSessionState} from '../../../games/heist/heist.session.js';
import {HEIST_APPROACH_MAP, HEIST_RISK_MAP, HEIST_TARGET_MAP,} from '../../../config/heist.js';

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
