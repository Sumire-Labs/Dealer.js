import type {Message} from 'discord.js';
import {MessageFlags} from 'discord.js';
import {HORSE_RACE_CONFIG} from '../../config/games.js';
import type {Horse} from '../../games/horse-race/race.horses.js';
import type {RaceFrame} from '../../games/horse-race/race.engine.js';
import {buildRaceFrameView} from '../builders/horse-race.builder.js';

export async function playRaceAnimation(
    message: Message,
    horses: Horse[],
    frames: RaceFrame[],
): Promise<void> {
    const {animationInterval, trackLength} = HORSE_RACE_CONFIG;

    for (const frame of frames) {
        const view = buildRaceFrameView(horses, frame.positions, trackLength);
        await message.edit({
            components: [view],
            flags: MessageFlags.IsComponentsV2,
        });
        await sleep(animationInterval);
    }
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}
