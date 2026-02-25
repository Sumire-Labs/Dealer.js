import {type ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder,} from 'discord.js';
import {registerCommand} from '../registry.js';
import {getJailbreakCooldownRemaining, getJailSession} from '../../games/prison/prison.session.js';
import {buildFreeView, buildPrisonView} from '../../ui/builders/prison.builder.js';
import {hasInventoryItem} from '../../database/services/shop.service.js';

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
  const hasKey = await hasInventoryItem(userId, 'PRISON_KEY');
  const view = buildPrisonView(session, jailbreakCd, hasKey);
  await interaction.reply({
    components: [view],
    flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
  });
}

registerCommand({ data, execute: execute as never });
