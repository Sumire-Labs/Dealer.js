import { HORSE_RACE_CONFIG } from '../../config/games.js';
import { secureRandomInt } from '../../utils/random.js';

export interface Horse {
  index: number;
  name: string;
  stars: number;
  odds: number;
  winChance: number;
}

const HORSE_NAMES: string[] = [
  'Thunder Bolt', 'Lucky Strike', 'Dark Shadow', 'Golden Dream', 'Long Shot',
  'Silver Bullet', 'Night Rider', 'Blazing Sun', 'Iron Will', 'Wild Card',
  'Fast Eddie', 'Diamond Dust', 'Phantom Ace', 'Royal Flush', 'Neon Flash',
  'Storm Chaser', 'Velvet Thunder', 'Chrome Horse', 'Desert Eagle', 'Black Mamba',
  'Quick Silver', 'High Roller', 'Lucky Seven', 'Gold Rush', 'Turbo Charge',
  'Midnight Run', 'Star Gazer', 'Blaze Runner', 'Cash Money', 'Hot Streak',
];

const STAR_DISPLAY = ['⭐', '⭐⭐', '⭐⭐⭐', '⭐⭐⭐⭐', '⭐⭐⭐⭐⭐'];

export function generateHorses(): Horse[] {
  const usedNames = new Set<number>();
  const horses: Horse[] = [];

  for (let i = 0; i < HORSE_RACE_CONFIG.horses.length; i++) {
    const config = HORSE_RACE_CONFIG.horses[i];
    let nameIndex: number;
    do {
      nameIndex = secureRandomInt(0, HORSE_NAMES.length - 1);
    } while (usedNames.has(nameIndex));
    usedNames.add(nameIndex);

    horses.push({
      index: i,
      name: HORSE_NAMES[nameIndex],
      stars: config.stars,
      odds: config.baseOdds,
      winChance: config.winChance,
    });
  }

  return horses;
}

export function getStarDisplay(stars: number): string {
  return STAR_DISPLAY[stars - 1] ?? '⭐';
}

export function formatHorseInfo(horse: Horse): string {
  return `${numberEmoji(horse.index + 1)} **${horse.name}** ${getStarDisplay(horse.stars)} — x${horse.odds}`;
}

export function numberEmoji(n: number): string {
  const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣'];
  return emojis[n - 1] ?? `${n}.`;
}
