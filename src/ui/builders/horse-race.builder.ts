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
import type { Horse } from '../../games/horse-race/race.horses.js';
import type { RaceBetEntry, PayoutEntry } from '../../games/horse-race/race.betting.js';
import { formatHorseInfo, numberEmoji } from '../../games/horse-race/race.horses.js';
import { getTotalPool } from '../../games/horse-race/race.betting.js';

export function buildBettingView(
  sessionId: string,
  horses: Horse[],
  bets: RaceBetEntry[],
  remainingSeconds: number,
): ContainerBuilder {
  const horseList = horses.map(h => formatHorseInfo(h)).join('\n');
  const pool = getTotalPool(bets);

  const container = new ContainerBuilder()
    .setAccentColor(CasinoTheme.colors.purple)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(CasinoTheme.prefixes.race),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(horseList),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `Bettors: **${bets.length}** | Pool: **${formatChips(pool)}**\n⏰ Betting closes in: **${remainingSeconds}s**`,
      ),
    )
    .addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        ...horses.map(h =>
          new ButtonBuilder()
            .setCustomId(`race:bet:${sessionId}:${h.index}`)
            .setLabel(`${numberEmoji(h.index + 1)} x${h.odds}`)
            .setStyle(ButtonStyle.Primary),
        ),
      ),
    );

  return container;
}

export function buildRaceFrameView(
  horses: Horse[],
  positions: number[],
  trackLength: number,
): ContainerBuilder {
  const trackLines = horses.map((h, i) => {
    const pos = positions[i];
    const filled = pos;
    const empty = trackLength - pos;
    const track = '▫'.repeat(Math.max(0, empty)) + '🏇' + '▪'.repeat(Math.max(0, filled));
    return `${track} ${numberEmoji(h.index + 1)} ${h.name}`;
  }).join('\n');

  return new ContainerBuilder()
    .setAccentColor(CasinoTheme.colors.purple)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent('🏇 ━━━ **RACE IN PROGRESS** ━━━ 🏇'),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(trackLines),
    );
}

export function buildRaceResultView(
  horses: Horse[],
  placements: number[],
  _bets: RaceBetEntry[],
  payouts: PayoutEntry[],
): ContainerBuilder {
  const placementLines = placements.slice(0, 3).map((horseIdx, rank) => {
    const h = horses[horseIdx];
    const medals = ['🥇', '🥈', '🥉'];
    const ordinals = ['1st', '2nd', '3rd'];
    return `${medals[rank]} **${ordinals[rank]}**: ${h.name} (x${h.odds})`;
  }).join('\n');

  let payoutText: string;
  if (payouts.length > 0) {
    const payoutLines = payouts.map(p =>
      `<@${p.userId}> — Bet ${formatChips(p.betAmount)} → Won **${formatChips(p.payout)}**`,
    ).join('\n');
    payoutText = `**Winners:**\n${payoutLines}`;
  } else {
    payoutText = '*No winners this race.*';
  }

  return new ContainerBuilder()
    .setAccentColor(CasinoTheme.colors.gold)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent('🏆 ━━━ **RACE RESULTS** ━━━ 🏆'),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(placementLines),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(payoutText),
    );
}

export function buildRaceCancelledView(reason: string): ContainerBuilder {
  return new ContainerBuilder()
    .setAccentColor(CasinoTheme.colors.red)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(CasinoTheme.prefixes.race),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`❌ **Race Cancelled**\n${reason}`),
    );
}
