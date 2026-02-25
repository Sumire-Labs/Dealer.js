import {MessageFlags, type ModalSubmitInteraction,} from 'discord.js';
import {registerModalHandler} from '../handler.js';
import {configService} from '../../config/config.service.js';
import {S} from '../../config/setting-defs.js';
import {findOrCreateUser} from '../../database/repositories/user.repository.js';
import {removeChips} from '../../database/services/economy.service.js';
import {addBetToSession, getActiveSession,} from '../../games/horse-race/race.session.js';
import {formatChips} from '../../utils/formatters.js';

async function handleBetAmountModal(interaction: ModalSubmitInteraction): Promise<void> {
    // customId format: racebet:<channelId>:<horseIndex>
    const parts = interaction.customId.split(':');
    const channelId = parts[1];
    const horseIndex = parseInt(parts[2]);

    const session = getActiveSession(channelId);
    if (!session || session.status !== 'betting') {
        await interaction.reply({
            content: 'このレースのベット受付は終了しています。',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    // Validate horseIndex bounds
    if (isNaN(horseIndex) || horseIndex < 0 || horseIndex >= session.horses.length) {
        await interaction.reply({
            content: '無効な馬の選択です。',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    // Parse and validate bet amount
    const amountStr = interaction.fields.getTextInputValue('bet_amount').trim();
    const parsed = parseInt(amountStr);
    if (isNaN(parsed) || parsed <= 0) {
        await interaction.reply({
            content: '有効な数値を入力してください。',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    const amount = BigInt(parsed);
    const minBet = configService.getBigInt(S.minBet);
    const maxBet = configService.getBigInt(S.maxHorseRace);
    if (amount < minBet) {
        await interaction.reply({
            content: `最低ベットは${formatChips(minBet)}です。`,
            flags: MessageFlags.Ephemeral,
        });
        return;
    }
    if (maxBet > 0n && amount > maxBet) {
        await interaction.reply({
            content: `ベット上限は${formatChips(maxBet)}です。`,
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    const user = await findOrCreateUser(interaction.user.id);
    if (user.chips < amount) {
        await interaction.reply({
            content: `チップが不足しています！ 残高: ${formatChips(user.chips)}`,
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    // Deduct chips FIRST, then register bet
    await removeChips(interaction.user.id, amount, 'LOSS', 'HORSE_RACE');

    const added = addBetToSession(channelId, {
        userId: interaction.user.id,
        horseIndex,
        amount,
    });

    if (!added) {
        // Refund — session already had a bet from this user
        const {addChips} = await import('../../database/services/economy.service.js');
        await addChips(interaction.user.id, amount, 'WIN', 'HORSE_RACE');
        await interaction.reply({
            content: 'このレースには既にベット済みです！',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    const horse = session.horses[horseIndex];
    await interaction.reply({
        content: `✅ ベット完了！ **${horse.name}** に **${formatChips(amount)}**（x${horse.odds}）`,
        flags: MessageFlags.Ephemeral,
    });
}

registerModalHandler('racebet', handleBetAmountModal as never);
