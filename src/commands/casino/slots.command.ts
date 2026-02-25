import {type ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder,} from 'discord.js';
import {registerCommand} from '../registry.js';
import {configService} from '../../config/config.service.js';
import {S} from '../../config/setting-defs.js';
import {findOrCreateUser, getTodayStats} from '../../database/repositories/user.repository.js';
import {processGameResult} from '../../database/services/economy.service.js';
import {spin} from '../../games/slots/slots.engine.js';
import {buildSlotsSpinningView} from '../../ui/builders/slots.builder.js';
import {playSlotsAnimation} from '../../ui/animations/slots.animation.js';
import {formatChips} from '../../utils/formatters.js';
import {setSessionBet as setSlotsBet} from '../../interactions/buttons/slots.buttons.js';
import {buildAchievementNotification} from '../../database/services/achievement.service.js';

const data = new SlashCommandBuilder()
    .setName('slots')
    .setDescription('ダイヤモンドカジノのスロットマシンで遊ぶ')
    .addIntegerOption(option =>
        option
            .setName('bet')
            .setDescription('ベット額')
            .setRequired(false)
            .setMinValue(Number(S.minBet.defaultValue)),
    )
    .toJSON();

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const userId = interaction.user.id;
    const betInput = interaction.options.getInteger('bet');
    const bet = betInput ? BigInt(betInput) : configService.getBigInt(S.minBet);

    const minBet = configService.getBigInt(S.minBet);
    const maxBet = configService.getBigInt(S.maxSlots);
    if (bet < minBet) {
        await interaction.reply({
            content: `最低ベットは${formatChips(minBet)}です。`,
            flags: MessageFlags.Ephemeral,
        });
        return;
    }
    if (maxBet > 0n && bet > maxBet) {
        await interaction.reply({
            content: `ベット上限は${formatChips(maxBet)}です。`,
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    const user = await findOrCreateUser(userId);
    if (user.chips < bet) {
        await interaction.reply({
            content: `チップが不足しています！ 残高: ${formatChips(user.chips)}`,
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    // Store session bet for button interactions
    setSlotsBet(userId, bet);

    // Show spinning placeholder and defer
    const spinPlaceholder = buildSlotsSpinningView(['🔄', '🔄', '🔄']);
    await interaction.reply({
        components: [spinPlaceholder],
        flags: MessageFlags.IsComponentsV2,
    });

    // Run the game
    const result = spin();
    const gameResult = await processGameResult(userId, 'SLOTS', bet, result.paytable.multiplier, {
        multiplier: result.paytable.multiplier,
    });

    // Get today's stats
    const todayStats = await getTodayStats(userId);

    // Play animation
    await playSlotsAnimation(
        interaction,
        result,
        bet,
        gameResult.payout,
        gameResult.newBalance,
        userId,
        todayStats,
    );

    // Achievement notification
    if (gameResult.newlyUnlocked.length > 0) {
        await interaction.followUp({
            content: buildAchievementNotification(gameResult.newlyUnlocked),
            flags: MessageFlags.Ephemeral,
        });
    }
}

registerCommand({data, execute: execute as never});
