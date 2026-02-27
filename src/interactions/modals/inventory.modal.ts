import {ContainerBuilder, MessageFlags, type ModalSubmitInteraction, TextDisplayBuilder} from 'discord.js';
import {registerModalHandler} from '../handler.js';
import {openMysteryBoxBulk} from '../../database/services/shop.service.js';
import {getBalance} from '../../database/services/economy.service.js';
import {ITEM_MAP} from '../../config/shop.js';
import {buildBulkMysteryBoxResultView} from '../../ui/builders/daily-shop.builder.js';
import {buildAchievementNotification} from '../../database/services/achievement.service.js';

async function handleInventoryModal(interaction: ModalSubmitInteraction): Promise<void> {
    const parts = interaction.customId.split(':');
    const action = parts[1];
    const ownerId = parts[2];

    if (interaction.user.id !== ownerId) {
        await interaction.reply({
            content: 'これはあなたのインベントリではありません！',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    const userId = interaction.user.id;

    if (action === 'open_qty') {
        const boxId = parts[3];
        const box = ITEM_MAP.get(boxId);
        if (!box) {
            await interaction.reply({
                content: 'ボックスが見つかりません。',
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        const qtyStr = interaction.fields.getTextInputValue('quantity').trim();
        const quantity = parseInt(qtyStr);

        if (isNaN(quantity) || quantity < 1 || quantity > 10) {
            await interaction.reply({
                content: '1〜10の数量を入力してください。',
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        const loadingView = new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent('⏳ 開封中...'),
        );
        await interaction.reply({
            components: [loadingView],
            flags: MessageFlags.IsComponentsV2,
        });

        const result = await openMysteryBoxBulk(userId, boxId, quantity);

        if (result.boxesOpened === 0) {
            const errorView = new ContainerBuilder().addTextDisplayComponents(
                new TextDisplayBuilder().setContent(result.error ?? '❌ 開封に失敗しました。'),
            );
            await interaction.editReply({components: [errorView]});
            return;
        }

        // Get final balance if not set from chip results
        const finalBalance = result.finalBalance > 0n ? result.finalBalance : await getBalance(userId);

        const view = buildBulkMysteryBoxResultView(
            userId,
            box.name,
            result.boxesOpened,
            result.lootSummary,
            result.totalChipsAwarded,
            finalBalance,
        );
        await interaction.editReply({components: [view]});

        if (result.newlyUnlocked.length > 0) {
            await interaction.followUp({
                content: buildAchievementNotification(result.newlyUnlocked),
                flags: MessageFlags.Ephemeral,
            });
        }
    }
}

registerModalHandler('inv_modal', handleInventoryModal as never);
