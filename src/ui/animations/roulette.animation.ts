import type {ChatInputCommandInteraction, MessageComponentInteraction, ModalSubmitInteraction} from 'discord.js';
import {MessageFlags} from 'discord.js';
import {ROULETTE_CONFIG} from '../../config/games.js';
import {getAnimationNumbers, type RouletteResult} from '../../games/roulette/roulette.engine.js';
import {buildRouletteResultView, buildRouletteSpinningView} from '../builders/roulette.builder.js';
import type {TodayStats} from '../../database/repositories/user.repository.js';

export async function playRouletteAnimation(
    interaction: ChatInputCommandInteraction | MessageComponentInteraction | ModalSubmitInteraction,
    result: RouletteResult,
    betLabel: string,
    won: boolean,
    bet: bigint,
    payout: bigint,
    net: bigint,
    newBalance: bigint,
    userId: string,
    todayStats?: TodayStats,
): Promise<void> {
    const {animationFrames, animationInterval, resultDelay} = ROULETTE_CONFIG;

    // Spinning frames
    for (let i = 0; i < animationFrames; i++) {
        const frameNumbers = getAnimationNumbers(3);
        const spinView = buildRouletteSpinningView(frameNumbers);
        await interaction.editReply({
            components: [spinView],
            flags: MessageFlags.IsComponentsV2,
        });
        await sleep(animationInterval);
    }

    // Brief pause before result
    await sleep(resultDelay);

    // Final result
    const resultView = buildRouletteResultView(
        result.number,
        betLabel,
        won,
        bet,
        payout,
        net,
        newBalance,
        userId,
        todayStats,
    );
    await interaction.editReply({
        components: [resultView],
        flags: MessageFlags.IsComponentsV2,
    });
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}
