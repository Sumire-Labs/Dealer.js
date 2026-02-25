import {
  ActionRowBuilder,
  type ButtonInteraction,
  MessageFlags,
  type ModalActionRowComponentBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import {registerButtonHandler} from '../handler.js';
import {findOrCreateUser, resetUser} from '../../database/repositories/user.repository.js';
import {deleteBusiness, getBusiness} from '../../database/repositories/business.repository.js';
import {BUSINESS_TYPE_MAP} from '../../config/business.js';
import {prisma} from '../../database/client.js';
import {createTransaction} from '../../database/repositories/transaction.repository.js';
import {configService} from '../../config/config.service.js';
import {S} from '../../config/setting-defs.js';
import {formatChips} from '../../utils/formatters.js';
import {
  buildDebugResetConfirmView,
  buildDebugResultView,
  buildDebugTabView,
  type DebugTab,
  type DebugViewData,
} from '../../ui/builders/debug.builder.js';

// ─── Load data for debug views ───

export async function loadDebugViewData(targetId: string): Promise<DebugViewData> {
    const user = await findOrCreateUser(targetId);
    const business = await getBusiness(targetId);

    let businessData: DebugViewData['business'] = null;
    if (business) {
        const typeDef = BUSINESS_TYPE_MAP.get(business.type);
        businessData = {
            type: business.type,
            typeName: typeDef?.name ?? business.type,
            typeEmoji: typeDef?.emoji ?? '🏢',
            level: business.level,
            maxLevel: typeDef?.maxLevel ?? 5,
            totalEarned: business.totalEarned,
        };
    }

    return {
        targetId,
        economy: {
            chips: user.chips,
            bankBalance: user.bankBalance,
            totalWon: user.totalWon,
            totalLost: user.totalLost,
            totalGames: user.totalGames,
        },
        work: {
            workLevel: user.workLevel,
            workXp: user.workXp,
            workStreak: user.workStreak,
            dailyStreak: user.dailyStreak,
        },
        business: businessData,
    };
}

// ─── Permission check ───

function isAdmin(interaction: ButtonInteraction, adminId: string): boolean {
    return interaction.user.id === adminId;
}

// ─── Modal builders ───

function showNumberModal(
    interaction: ButtonInteraction,
    modalId: string,
    title: string,
    label: string,
    placeholder: string,
): Promise<void> {
    const modal = new ModalBuilder()
        .setCustomId(modalId)
        .setTitle(title);

    const input = new TextInputBuilder()
        .setCustomId('value')
        .setLabel(label)
        .setPlaceholder(placeholder)
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

    modal.addComponents(
        new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(input),
    );

    return interaction.showModal(modal);
}

// ─── Button handler ───

async function handleDebugButton(interaction: ButtonInteraction): Promise<void> {
    const parts = interaction.customId.split(':');
    const action = parts[1];
    const adminId = parts[2];
    const targetId = parts[3];

    if (!isAdmin(interaction, adminId)) {
        await interaction.reply({
            content: 'このパネルは操作できません。',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    // Tab switching
    if (action.startsWith('tab_')) {
        const tab = action.replace('tab_', '') as DebugTab;
        const data = await loadDebugViewData(targetId);
        const view = buildDebugTabView(data, adminId, tab);
        await interaction.update({
            components: [view],
            flags: MessageFlags.IsComponentsV2,
        });
        return;
    }

    switch (action) {
        // ── Economy modals ──
        case 'modal_give': {
            await showNumberModal(
                interaction,
                `debug_modal:give:${targetId}`,
                'チップ付与',
                '付与するチップ量',
                '例: 10000',
            );
            break;
        }

        case 'modal_set_chips': {
            await showNumberModal(
                interaction,
                `debug_modal:set_chips:${targetId}`,
                'チップ設定',
                '設定するチップ量',
                '例: 50000',
            );
            break;
        }

        case 'modal_set_bank': {
            await showNumberModal(
                interaction,
                `debug_modal:set_bank:${targetId}`,
                '銀行残高設定',
                '設定する銀行残高',
                '例: 100000',
            );
            break;
        }

        // ── Work modals ──
        case 'modal_set_level': {
            await showNumberModal(
                interaction,
                `debug_modal:set_level:${targetId}`,
                'レベル設定',
                'レベル (0-5)',
                '例: 3',
            );
            break;
        }

        case 'modal_set_xp': {
            await showNumberModal(
                interaction,
                `debug_modal:set_xp:${targetId}`,
                'XP設定',
                'XP値',
                '例: 100',
            );
            break;
        }

        case 'modal_set_work_streak': {
            await showNumberModal(
                interaction,
                `debug_modal:set_work_streak:${targetId}`,
                '労働連続設定',
                '連続回数',
                '例: 5',
            );
            break;
        }

        case 'modal_set_daily_streak': {
            await showNumberModal(
                interaction,
                `debug_modal:set_daily_streak:${targetId}`,
                'ログイン連続設定',
                '連続日数',
                '例: 7',
            );
            break;
        }

        // ── Business modals ──
        case 'modal_set_biz_level': {
            await showNumberModal(
                interaction,
                `debug_modal:set_biz_level:${targetId}`,
                'ビジネスレベル設定',
                'レベル (1-5)',
                '例: 3',
            );
            break;
        }

        // ── Business delete ──
        case 'delete_biz': {
            await deleteBusiness(targetId);
            const view = buildDebugResultView(
                adminId,
                targetId,
                'ビジネス削除完了',
                `<@${targetId}> のビジネスを削除しました。`,
                'business',
            );
            await interaction.update({
                components: [view],
                flags: MessageFlags.IsComponentsV2,
            });
            break;
        }

        // ── Reset actions ──
        case 'reset_confirm': {
            const view = buildDebugResetConfirmView(adminId, targetId);
            await interaction.update({
                components: [view],
                flags: MessageFlags.IsComponentsV2,
            });
            break;
        }

        case 'reset_execute': {
            await resetUser(targetId);
            await createTransaction({
                userId: targetId,
                type: 'ADMIN_RESET',
                amount: 0n,
                balanceAfter: configService.getBigInt(S.initialChips),
            });

            const view = buildDebugResultView(
                adminId,
                targetId,
                '完全リセット完了',
                `<@${targetId}> のデータを完全にリセットしました。\nチップを **${formatChips(configService.getBigInt(S.initialChips))}** に設定しました。`,
                'reset',
            );
            await interaction.update({
                components: [view],
                flags: MessageFlags.IsComponentsV2,
            });
            break;
        }

        case 'reset_stats': {
            await prisma.user.update({
                where: {id: targetId},
                data: {
                    totalWon: 0n,
                    totalLost: 0n,
                    totalGames: 0,
                },
            });

            const view = buildDebugResultView(
                adminId,
                targetId,
                '統計リセット完了',
                `<@${targetId}> の統計データ (勝利/敗北/ゲーム数) をリセットしました。`,
                'reset',
            );
            await interaction.update({
                components: [view],
                flags: MessageFlags.IsComponentsV2,
            });
            break;
        }

        case 'reset_work': {
            await prisma.user.update({
                where: {id: targetId},
                data: {
                    workLevel: 0,
                    workXp: 0,
                    workStreak: 0,
                    lastWorkAt: null,
                },
            });

            const view = buildDebugResultView(
                adminId,
                targetId,
                '労働リセット完了',
                `<@${targetId}> の労働データ (レベル/XP/連続) をリセットしました。`,
                'reset',
            );
            await interaction.update({
                components: [view],
                flags: MessageFlags.IsComponentsV2,
            });
            break;
        }
    }
}

registerButtonHandler('debug', handleDebugButton as never);
