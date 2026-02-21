import { HORSE_RACE_CONFIG } from '../../config/games.js';
import { weightedRandom, secureRandomInt } from '../../utils/random.js';
import type { Horse } from './race.horses.js';

export interface RaceFrame {
  positions: number[]; // position for each horse (0..trackLength)
}

export interface RaceResult {
  placements: number[]; // horse indices in finish order
  frames: RaceFrame[];
}

export function simulateRace(horses: Horse[]): RaceResult {
  const { trackLength, animationFrames } = HORSE_RACE_CONFIG;
  const positions = horses.map(() => 0);
  const frames: RaceFrame[] = [{ positions: [...positions] }];

  // Determine winner by weighted random based on winChance
  const winnerIndex = weightedRandom(
    horses.map(h => ({ value: h.index, weight: Math.round(h.winChance * 1000) })),
  );

  const baseSpeed = Math.ceil(trackLength / animationFrames);

  // Simulate frames
  for (let frame = 0; frame < animationFrames; frame++) {
    const isLastFrame = frame === animationFrames - 1;

    for (let i = 0; i < horses.length; i++) {
      if (isLastFrame) {
        if (i === winnerIndex) {
          // Winner crosses finish line
          positions[i] = trackLength;
        } else {
          // Others land close but don't finish
          const maxPos = trackLength - 1;
          positions[i] = Math.min(positions[i] + secureRandomInt(1, 2), maxPos);
        }
      } else {
        // Normal progression: winner gets a small boost
        const isWinner = i === winnerIndex;
        const bonus = isWinner ? 1 : 0;
        const variance = secureRandomInt(0, 1);
        const advance = Math.max(1, baseSpeed + bonus + variance);
        // Don't let anyone finish early
        positions[i] = Math.min(positions[i] + advance, trackLength - 2);
      }
    }

    frames.push({ positions: [...positions] });
  }

  // Determine placements: winner first, then sort others by final position desc
  const placements = [winnerIndex];
  const remaining = horses
    .map(h => h.index)
    .filter(i => i !== winnerIndex)
    .sort((a, b) => positions[b] - positions[a]);
  placements.push(...remaining);

  return { placements, frames };
}
