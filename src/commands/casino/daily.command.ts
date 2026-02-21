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

const data = new SlashCommandBuilder()
  .setName('daily')
  .setDescription('デイリーチップボーナスを受け取る')
  .toJSON();

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const result = await claimDaily(interaction.user.id);

  if (!result.success) {
    const nextClaimUnix = Math.floor(result.nextClaimAt! / 1000);
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
          `⏰ 本日のボーナスは受取済みです！\n次回: <t:${nextClaimUnix}:R>`,
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
    ? '\n💸 *救済ボーナス！ 復帰用の追加チップです。*'
    : '';

  const streakLine = `\n🔥 連続ログイン: **${result.streak}日目**`;

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
        `✅ **${formatChips(result.amount!)}** を受け取りました！${bonusNote}${streakLine}\n\n💰 残高: **${formatChips(result.newBalance!)}**`,
      ),
    );

  await interaction.reply({
    components: [container],
    flags: MessageFlags.IsComponentsV2,
  });
}

registerCommand({ data, execute: execute as never });
