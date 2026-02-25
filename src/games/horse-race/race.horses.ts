import {HORSE_RACE_CONFIG} from '../../config/games.js';
import {configService} from '../../config/config.service.js';
import {secureRandomInt} from '../../utils/random.js';

export interface Horse {
    index: number;
    name: string;
    stars: number;
    odds: number;
    winChance: number;
}

const STAR_DISPLAY = ['⭐', '⭐⭐', '⭐⭐⭐', '⭐⭐⭐⭐', '⭐⭐⭐⭐⭐'];

export function generateHorses(): Horse[] {
    const horseNames = configService.getHorseNames();
    const usedNames = new Set<number>();
    const horses: Horse[] = [];

    for (let i = 0; i < HORSE_RACE_CONFIG.horses.length; i++) {
        const config = HORSE_RACE_CONFIG.horses[i];
        let nameIndex: number;
        do {
            nameIndex = secureRandomInt(0, horseNames.length - 1);
        } while (usedNames.has(nameIndex));
        usedNames.add(nameIndex);

        horses.push({
            index: i,
            name: horseNames[nameIndex],
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
