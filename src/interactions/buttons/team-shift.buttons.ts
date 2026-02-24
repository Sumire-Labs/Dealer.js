import { type ButtonInteraction } from 'discord.js';
import { registerButtonHandler } from '../handler.js';
import { handleCreate, handleJoin, handleCancel } from './team-shift/lobby-handlers.js';
import { handleStart, handleJob } from './team-shift/game-handlers.js';

// Re-export externally referenced function
export { startTeamLobbyCountdown } from './team-shift/countdown.js';

async function handleTeamButton(interaction: ButtonInteraction): Promise<void> {
  const parts = interaction.customId.split(':');
  const action = parts[1];
  const userId = interaction.user.id;

  switch (action) {
    case 'create': return handleCreate(interaction, userId, parts);
    case 'join': return handleJoin(interaction, userId, parts);
    case 'cancel': return handleCancel(interaction, userId, parts);
    case 'start': return handleStart(interaction, userId, parts);
    case 'job': return handleJob(interaction, userId, parts);
  }
}

registerButtonHandler('team', handleTeamButton as never);
