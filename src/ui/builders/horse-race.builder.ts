import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ContainerBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    TextDisplayBuilder,
} from 'discord.js';
import {CasinoTheme} from '../themes/casino.theme.js';
import {formatChips} from '../../utils/formatters.js';
import type {Horse} from '../../games/horse-race/race.horses.js';
import {formatHorseInfo, numberEmoji} from '../../games/horse-race/race.horses.js';
import type {PayoutEntry, RaceBetEntry} from '../../games/horse-race/race.betting.js';
import {getTotalPool} from '../../games/horse-race/race.betting.js';

export function buildBettingView(
  sessionId: string,
  horses: Horse[],
  bets: RaceBetEntry[],
  remainingSeconds: number,
  ownerId: string,
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
        `参加者: **${bets.length}人** | プール: **${formatChips(pool)}**\n⏰ ベット締切まで: **${remainingSeconds}秒**`,
      ),
    )
    .addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        ...horses.map(h =>
          new ButtonBuilder()
            .setCustomId(`race:bet:${sessionId}:${h.index}`)
            .setLabel(h.name)
            .setStyle(ButtonStyle.Primary),
        ),
      ),
    )
    .addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`race:start_race:${sessionId}:${ownerId}`)
          .setLabel('🏁 レース開始')
          .setStyle(ButtonStyle.Danger),
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
      new TextDisplayBuilder().setContent('🏇 ━━━ **レース進行中** ━━━ 🏇'),
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
    const ordinals = ['1着', '2着', '3着'];
    return `${medals[rank]} **${ordinals[rank]}**: ${h.name} (x${h.odds})`;
  }).join('\n');

  let payoutText: string;
  if (payouts.length > 0) {
    const payoutLines = payouts.map(p =>
      `<@${p.userId}> — ベット ${formatChips(p.betAmount)} → 獲得 **${formatChips(p.payout)}**`,
    ).join('\n');
    payoutText = `**当選者:**\n${payoutLines}`;
  } else {
    payoutText = '*今回の当選者はいませんでした。*';
  }

  return new ContainerBuilder()
    .setAccentColor(CasinoTheme.colors.gold)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent('🏆 ━━━ **レース結果** ━━━ 🏆'),
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
      new TextDisplayBuilder().setContent(`❌ **レース中止**\n${reason}`),
    );
}
