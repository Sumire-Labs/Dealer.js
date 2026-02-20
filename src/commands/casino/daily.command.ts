import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MessageFlags,
} from 'discord.js';
import { registerCommand } from '../registry.js';
import { claimDaily } from '../../database/services/daily.service.js';
import { CasinoTheme } from '../../ui/themes/casino.theme.js';
import { formatChips } from '../../utils/formatters.js';
import { formatTimeDelta } from '../../utils/formatters.js';

const data = new SlashCommandBuilder()
  .setName('daily')
  .setDescription('Claim your daily chip bonus')
  .toJSON();

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const result = await claimDaily(interaction.user.id);

  if (!result.success) {
    const remaining = formatTimeDelta(result.remainingCooldown!);
    const container = new ContainerBuilder()
      .setAccentColor(CasinoTheme.colors.red)
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(CasinoTheme.prefixes.daily),
      )
      .addSeparatorComponents(
        new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `⏰ You already claimed your daily bonus!\nCome back in **${remaining}**`,
        ),
      );

    await interaction.reply({
      components: [container],
      flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
    });
    return;
  }

  const isBroke = result.amount! > 2500n;
  const bonusNote = isBroke
    ? '\n💸 *Broke bonus! Extra chips to get you back in the game.*'
    : '';

  const container = new ContainerBuilder()
    .setAccentColor(CasinoTheme.colors.gold)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(CasinoTheme.prefixes.daily),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `✅ You received **${formatChips(result.amount!)}**!${bonusNote}\n\n💰 Balance: **${formatChips(result.newBalance!)}**`,
      ),
    );

  await interaction.reply({
    components: [container],
    flags: MessageFlags.IsComponentsV2,
  });
}

registerCommand({ data, execute: execute as never });
