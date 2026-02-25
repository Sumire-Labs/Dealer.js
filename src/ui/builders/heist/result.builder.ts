import {ContainerBuilder, SeparatorBuilder, SeparatorSpacingSize, TextDisplayBuilder,} from 'discord.js';
import {CasinoTheme} from '../../themes/casino.theme.js';
import {formatChips} from '../../../utils/formatters.js';
import {HEIST_TARGET_MAP, type HeistTarget} from '../../../config/heist.js';
import type {PhaseResult} from '../../../games/heist/heist.engine.js';

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
