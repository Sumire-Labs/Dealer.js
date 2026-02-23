import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  MessageFlags,
} from 'discord.js';
import { registerCommand } from '../registry.js';
import { getJailSession, getJailbreakCooldownRemaining } from '../../games/prison/prison.session.js';
import { buildPrisonView, buildFreeView } from '../../ui/builders/prison.builder.js';

const data = new SlashCommandBuilder()
  .setName('prison')
  .setDescription('刑務所の状況を確認する')
  .toJSON();

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const userId = interaction.user.id;
  const session = getJailSession(userId);

  if (!session) {
    const view = buildFreeView();
    await interaction.reply({
      components: [view],
      flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
    });
    return;
  }

  const jailbreakCd = getJailbreakCooldownRemaining(userId);
  const view = buildPrisonView(session, jailbreakCd);
  await interaction.reply({
    components: [view],
    flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
  });
}

registerCommand({ data, execute: execute as never });
