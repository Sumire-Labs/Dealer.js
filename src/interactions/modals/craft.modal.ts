import {ContainerBuilder, MessageFlags, type ModalSubmitInteraction, TextDisplayBuilder} from 'discord.js';
import {registerModalHandler} from '../handler.js';
import {craftItemBulk} from '../../database/services/shop.service.js';
import {CRAFT_RECIPES} from '../../config/crafting.js';
import {buildBulkCraftResultView} from '../../ui/builders/craft.builder.js';
import {buildAchievementNotification} from '../../database/services/achievement.service.js';

async function handleCraftModal(interaction: ModalSubmitInteraction): Promise<void> {
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

    const userId = interaction.user.id;

    if (action === 'craft_qty') {
        const recipeId = parts[3];
        const recipe = CRAFT_RECIPES.find(r => r.id === recipeId);
        if (!recipe) {
            await interaction.reply({
                content: 'レシピが見つかりません。',
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
            new TextDisplayBuilder().setContent('⏳ 合成中...'),
        );
        await interaction.reply({
            components: [loadingView],
            flags: MessageFlags.IsComponentsV2,
        });

        const result = await craftItemBulk(userId, recipeId, quantity);

        if (result.crafted === 0) {
            const errorView = new ContainerBuilder().addTextDisplayComponents(
                new TextDisplayBuilder().setContent(result.error ?? '❌ 合成に失敗しました。'),
            );
            await interaction.editReply({components: [errorView]});
            return;
        }

        const entries = result.results.map(r => ({
            recipeName: recipe.name,
            resultEmoji: r.resultItem.emoji,
            resultName: r.resultItem.name,
        }));

        const view = buildBulkCraftResultView(
            userId,
            recipe.name,
            entries,
            result.failedAtIndex,
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

registerModalHandler('craft_modal', handleCraftModal as never);
