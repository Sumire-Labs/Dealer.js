import {type ButtonInteraction, MessageFlags} from 'discord.js';
import {registerButtonHandler} from '../handler.js';
import {findOrCreateUser, getTodayStats} from '../../database/repositories/user.repository.js';
import {getUserRank} from '../../database/repositories/leaderboard.repository.js';
import {type BalanceTab, buildBalanceView} from '../../ui/builders/balance.builder.js';
import {buildProfileView} from '../../ui/builders/profile.builder.js';
import {getActiveBuffs, getInventory} from '../../database/repositories/shop.repository.js';

async function handleBalanceButton(interaction: ButtonInteraction): Promise<void> {
    const parts = interaction.customId.split(':');
    const tab = parts[1] as BalanceTab;
    const ownerId = parts[2];
    const targetId = parts[3];

    if (interaction.user.id !== ownerId) {
        await interaction.reply({
            content: 'これはあなたのパネルではありません！ `/balance` で確認してください。',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    const targetUser = await interaction.client.users.fetch(targetId);
    const dbUser = await findOrCreateUser(targetId);

    // Profile tab
    if (tab === 'profile') {
        const [activeBuffs, inventory] = await Promise.all([
            getActiveBuffs(targetId),
            getInventory(targetId),
        ]);
        const inventoryCount = inventory.filter(i => i.quantity > 0).length;

        const container = buildProfileView(
            ownerId,
            targetId,
            targetUser.displayName,
            dbUser.activeTitle,
            dbUser.activeBadge,
            activeBuffs,
            inventoryCount,
            ownerId === targetId,
        );
        await interaction.update({
            components: [container],
            flags: MessageFlags.IsComponentsV2,
        });
        return;
    }

    // Balance / Stats tabs
    const rank = await getUserRank(targetId, 'chips');

    // Fetch today's stats for the stats tab
    const todayStats = tab === 'stats' ? await getTodayStats(targetId) : undefined;

    const container = buildBalanceView({
        userId: ownerId,
        targetId,
        username: targetUser.displayName,
        chips: dbUser.chips,
        bankBalance: dbUser.bankBalance,
        totalWon: dbUser.totalWon,
        totalLost: dbUser.totalLost,
        totalGames: dbUser.totalGames,
        rank,
        isSelf: ownerId === targetId,
        todayStats,
    }, tab);

    await interaction.update({
        components: [container],
        flags: MessageFlags.IsComponentsV2,
    });
}

registerButtonHandler('bal', handleBalanceButton as never);
