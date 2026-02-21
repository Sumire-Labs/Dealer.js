import type { Message } from 'discord.js';
import { MessageFlags } from 'discord.js';
import { HEIST_CONFIG } from '../../config/games.js';
import { buildHeistPhaseView } from '../builders/heist.builder.js';
import type { PhaseResult } from '../../games/heist/heist.engine.js';

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function playHeistAnimation(
  message: Message,
  phaseResults: PhaseResult[],
): Promise<void> {
  const { animationInterval, phases, phaseEmoji, phaseNames } = HEIST_CONFIG;
  const completedPhases: PhaseResult[] = [];

  for (let i = 0; i < phaseResults.length; i++) {
    // Show current phase as "in progress"
    const currentPhaseIndex = phases.indexOf(phaseResults[i].phase as typeof phases[number]);
    const currentPhase = currentPhaseIndex >= 0 ? {
      emoji: phaseEmoji[currentPhaseIndex],
      name: phaseNames[currentPhaseIndex],
    } : undefined;

    const progressView = buildHeistPhaseView(completedPhases, currentPhase);
    await message.edit({
      components: [progressView],
      flags: MessageFlags.IsComponentsV2,
    });

    await sleep(animationInterval);

    // Mark phase as completed
    completedPhases.push(phaseResults[i]);

    // If this phase failed, show it and stop
    if (!phaseResults[i].success) {
      const failView = buildHeistPhaseView(completedPhases);
      await message.edit({
        components: [failView],
        flags: MessageFlags.IsComponentsV2,
      });
      await sleep(animationInterval);
      break;
    }
  }
}
