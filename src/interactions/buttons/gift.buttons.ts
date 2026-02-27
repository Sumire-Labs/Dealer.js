import {
  ActionRowBuilder,
  type ButtonInteraction,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import {registerButtonHandler} from '../handler.js';
import {getRemainingGifts, sendGiftChips, sendGiftItem,} from '../../database/services/gift.service.js';
import {getUserInventorySummary} from '../../database/services/shop.service.js';
import {
  buildGiftConfirmView,
  buildGiftItemSelectView,
  buildGiftResultView,
  buildGiftTypeSelectView,
} from '../../ui/builders/gift.builder.js';
import {buildAchievementNotification} from '../../database/services/achievement.service.js';

const giftItemPage = new Map<string, number>();

function setGiftPage(key: string, value: number): void {
    if (giftItemPage.size > 10_000) giftItemPage.clear();
    giftItemPage.set(key, value);
}

async function handleGiftButton(interaction: ButtonInteraction): Promise<void> {
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

    switch (action) {
        case 'type_item': {
            const receiverId = parts[3];
            const summary = await getUserInventorySummary(senderId);
            setGiftPage(senderId, 0);
            const view = buildGiftItemSelectView(senderId, receiverId, summary.inventory, 0);
            await interaction.update({components: [view], flags: MessageFlags.IsComponentsV2});
            break;
        }

        case 'type_chips': {
            const receiverId = parts[3];
            // Show modal for chip amount input
            const modal = new ModalBuilder()
                .setCustomId(`gift_modal:chips_input:${senderId}:${receiverId}`)
                .setTitle('チップを送る')
                .addComponents(
                    new ActionRowBuilder<TextInputBuilder>().addComponents(
                        new TextInputBuilder()
                            .setCustomId('amount')
                            .setLabel('送金額')
                            .setPlaceholder('例: 10000, 10k, 1m')
                            .setStyle(TextInputStyle.Short)
                            .setRequired(true),
                    ),
                );
            await interaction.showModal(modal);
            break;
        }

        case 'select_item': {
            const receiverId = parts[3];
            const itemId = parts[4];
            const receiver = await interaction.client.users.fetch(receiverId).catch(() => null);
            const receiverName = receiver?.displayName ?? receiverId;
            const view = buildGiftConfirmView(senderId, receiverId, receiverName, {itemId});
            await interaction.update({components: [view], flags: MessageFlags.IsComponentsV2});
            break;
        }

        case 'confirm': {
            const receiverId = parts[3];
            const giftType = parts[4]; // 'item' or 'chips'
            const giftValue = parts[5]; // itemId or amount string

            const receiver = await interaction.client.users.fetch(receiverId).catch(() => null);
            const receiverName = receiver?.displayName ?? receiverId;

            if (giftType === 'item') {
                const result = await sendGiftItem(senderId, receiverId, giftValue);
                if (!result.success) {
                    await interaction.reply({
                        content: result.error ?? 'ギフト送信に失敗しました。',
                        flags: MessageFlags.Ephemeral,
                    });
                    return;
                }
                const view = buildGiftResultView(senderId, receiverName, {itemId: giftValue});
                await interaction.update({components: [view], flags: MessageFlags.IsComponentsV2});

                if (result.newlyUnlocked && result.newlyUnlocked.length > 0) {
                    await interaction.followUp({
                        content: buildAchievementNotification(result.newlyUnlocked),
                        flags: MessageFlags.Ephemeral,
                    });
                }
            } else if (giftType === 'chips') {
                const amount = BigInt(giftValue);
                const result = await sendGiftChips(senderId, receiverId, amount);
                if (!result.success) {
                    await interaction.reply({
                        content: result.error ?? 'ギフト送信に失敗しました。',
                        flags: MessageFlags.Ephemeral,
                    });
                    return;
                }
                const view = buildGiftResultView(senderId, receiverName, {
                    chips: result.netAmount,
                    fee: result.fee,
                });
                await interaction.update({components: [view], flags: MessageFlags.IsComponentsV2});

                if (result.newlyUnlocked && result.newlyUnlocked.length > 0) {
                    await interaction.followUp({
                        content: buildAchievementNotification(result.newlyUnlocked),
                        flags: MessageFlags.Ephemeral,
                    });
                }
            }
            break;
        }

        case 'cancel': {
            const {ContainerBuilder, TextDisplayBuilder} = await import('discord.js');
            const cancelView = new ContainerBuilder().addTextDisplayComponents(
                new TextDisplayBuilder().setContent('❌ ギフトをキャンセルしました。'),
            );
            await interaction.update({
                components: [cancelView],
                flags: MessageFlags.IsComponentsV2,
            });
            break;
        }

        case 'back': {
            const receiverId = parts[3];
            const remaining = await getRemainingGifts(senderId);
            const receiver = await interaction.client.users.fetch(receiverId).catch(() => null);
            const receiverName = receiver?.displayName ?? receiverId;
            const view = buildGiftTypeSelectView(senderId, receiverId, receiverName, remaining);
            await interaction.update({components: [view], flags: MessageFlags.IsComponentsV2});
            break;
        }

        case 'item_prev': {
            const receiverId = parts[3];
            const currentPage = giftItemPage.get(senderId) ?? 0;
            const newPage = Math.max(0, currentPage - 1);
            setGiftPage(senderId, newPage);
            const summary = await getUserInventorySummary(senderId);
            const view = buildGiftItemSelectView(senderId, receiverId, summary.inventory, newPage);
            await interaction.update({components: [view], flags: MessageFlags.IsComponentsV2});
            break;
        }

        case 'item_next': {
            const receiverId = parts[3];
            const currentPage = giftItemPage.get(senderId) ?? 0;
            const newPage = currentPage + 1;
            setGiftPage(senderId, newPage);
            const summary = await getUserInventorySummary(senderId);
            const view = buildGiftItemSelectView(senderId, receiverId, summary.inventory, newPage);
            await interaction.update({components: [view], flags: MessageFlags.IsComponentsV2});
            break;
        }
    }
}

registerButtonHandler('gift', handleGiftButton as never);
