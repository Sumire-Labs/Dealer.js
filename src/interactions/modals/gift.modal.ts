import {MessageFlags, type ModalSubmitInteraction} from 'discord.js';
import {registerModalHandler} from '../handler.js';
import {buildGiftConfirmView} from '../../ui/builders/gift.builder.js';

async function handleGiftModal(interaction: ModalSubmitInteraction): Promise<void> {
    const parts = interaction.customId.split(':');
    const action = parts[1];
    const ownerId = parts[2];

    if (interaction.user.id !== ownerId) {
        await interaction.reply({
            content: 'これはあなたのパネルではありません！',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    const senderId = interaction.user.id;

    if (action === 'chips_input') {
        const receiverId = parts[3];
        const amountStr = interaction.fields.getTextInputValue('amount').trim().replace(/,/g, '');
        const amount = parseInt(amountStr);

        if (isNaN(amount) || amount < 1) {
            await interaction.reply({
                content: '有効な金額を入力してください。',
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        const receiver = await interaction.client.users.fetch(receiverId).catch(() => null);
        const receiverName = receiver?.displayName ?? receiverId;

        const view = buildGiftConfirmView(senderId, receiverId, receiverName, {chips: BigInt(amount)});
        await interaction.reply({
            components: [view],
            flags: MessageFlags.IsComponentsV2,
        });
    }
}

registerModalHandler('gift_modal', handleGiftModal as never);
