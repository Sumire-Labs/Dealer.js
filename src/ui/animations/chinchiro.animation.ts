import type {ButtonInteraction, ChatInputCommandInteraction, MessageComponentInteraction} from 'discord.js';
import {MessageFlags} from 'discord.js';
import {CHINCHIRO_CONFIG} from '../../config/games.js';
import {diceToEmoji} from '../../games/chinchiro/chinchiro.engine.js';
import {buildChinchiroSoloRollingView} from '../builders/chinchiro-table.builder.js';
import {secureRandomInt} from '../../utils/random.js';

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function randomDiceEmoji(): string {
    return diceToEmoji(secureRandomInt(1, 6));
}

export async function playChinchiroAnimation(
    interaction: ChatInputCommandInteraction | MessageComponentInteraction | ButtonInteraction,
    finalDice: [number, number, number],
): Promise<void> {
    const {animationSpinFrames, animationSpinInterval, diceStopInterval} = CHINCHIRO_CONFIG;

    // Phase 1: all dice spinning
    for (let i = 0; i < animationSpinFrames; i++) {
        const view = buildChinchiroSoloRollingView([
            randomDiceEmoji(),
            randomDiceEmoji(),
            randomDiceEmoji(),
        ]);
        await interaction.editReply({
            components: [view],
            flags: MessageFlags.IsComponentsV2,
        });
        await sleep(animationSpinInterval);
    }

    // Phase 2: stop dice left to right
    // Stop die 1
    const stop1View = buildChinchiroSoloRollingView([
        diceToEmoji(finalDice[0]),
        randomDiceEmoji(),
        randomDiceEmoji(),
    ]);
    await interaction.editReply({
        components: [stop1View],
        flags: MessageFlags.IsComponentsV2,
    });
    await sleep(diceStopInterval);

    // Stop die 2
    const stop2View = buildChinchiroSoloRollingView([
        diceToEmoji(finalDice[0]),
        diceToEmoji(finalDice[1]),
        randomDiceEmoji(),
    ]);
    await interaction.editReply({
        components: [stop2View],
        flags: MessageFlags.IsComponentsV2,
    });
    await sleep(diceStopInterval);

    // Die 3 stops in the result view (caller handles final display)
}
