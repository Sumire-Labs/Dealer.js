import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextDisplayBuilder,
} from 'discord.js';
import {CasinoTheme} from '../themes/casino.theme.js';
import {formatChips} from '../../utils/formatters.js';
import {BUSINESS_TYPES, getBusinessLevel,} from '../../config/business.js';
import {configService} from '../../config/config.service.js';
import {S} from '../../config/setting-defs.js';
import type {BusinessDashboardData, CollectResult} from '../../database/services/business.service.js';

const BIZ_PREFIX = '🏢 ━━━ BUSINESS ━━━ 🏢';

export function buildBusinessDashboardView(data: BusinessDashboardData, userId: string): ContainerBuilder {
    const container = new ContainerBuilder()
        .setAccentColor(CasinoTheme.colors.gold)
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(BIZ_PREFIX),
        )
        .addSeparatorComponents(
            new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
        );

    if (!data.unlocked) {
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `🔒 **ビジネスはワーク Lv.${configService.getNumber(S.businessUnlockLevel)} で解放されます**\n現在のレベル: Lv.${data.workLevel}`,
            ),
        );
        return container;
    }

    if (!data.hasBusiness || !data.business) {
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                '💼 **ビジネスを始めましょう！**\nビジネスを購入してパッシブ収入を得ましょう。',
            ),
        );
        container.addSeparatorComponents(
            new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
        );

        const shopLines = BUSINESS_TYPES.map(bt => {
            const lv1 = bt.levels[0];
            return `${bt.emoji} **${bt.name}** — ${formatChips(bt.purchaseCost)}\n　収入: ${formatChips(lv1.incomePerHour)}/h`;
        });

        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(shopLines.join('\n\n')),
        );
        container.addSeparatorComponents(
            new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
        );

        // Buy SelectMenu
        const buyOptions = BUSINESS_TYPES.map(bt => {
            const lv1 = bt.levels[0];
            return new StringSelectMenuOptionBuilder()
                .setLabel(`${bt.emoji} ${bt.name}`)
                .setDescription(`💰${formatChips(bt.purchaseCost)} | 収入 ${formatChips(lv1.incomePerHour)}/h`)
                .setValue(bt.id);
        });

        container.addActionRowComponents(
            new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId(`biz_select:buy:${userId}`)
                    .setPlaceholder('🏢 ビジネスを選択...')
                    .addOptions(buyOptions),
            ),
        );

        return container;
    }

    const biz = data.business;
    const nextLevel = getBusinessLevel(biz.type.id, biz.level + 1);
    const maxLevel = biz.level >= biz.type.maxLevel;

    // Business info
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `${biz.type.emoji} **${biz.type.name}** Lv.${biz.level}/${biz.type.maxLevel}\n${biz.levelDef.description}`,
        ),
    );
    container.addSeparatorComponents(
        new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    );

    // Income info
    const accumulatedText = biz.accumulatedIncome > 0n
        ? `📦 蓄積中: **${formatChips(biz.accumulatedIncome)}**`
        : '📦 蓄積中: $0';
    const employeeBonusText = biz.employees.length > 0
        ? `\n👥 従業員ボーナス: +${biz.employeeBonus}%`
        : '';

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `💰 収入: **${formatChips(biz.levelDef.incomePerHour)}/h**${employeeBonusText}\n${accumulatedText}\n📊 累計収入: ${formatChips(biz.totalEarned)}`,
        ),
    );
    container.addSeparatorComponents(
        new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    );

    // Employees
    if (biz.employees.length > 0) {
        const empLines = biz.employees.map(e => `👤 <@${e.userId}>`);
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `**従業員 (${biz.employees.length}/${configService.getNumber(S.businessEmployeeMax)}):**\n${empLines.join('\n')}`,
            ),
        );
        container.addSeparatorComponents(
            new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
        );
    }

    // Action buttons
    const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId(`biz:collect:${userId}`)
            .setLabel('💰 収入回収')
            .setStyle(ButtonStyle.Success)
            .setDisabled(biz.accumulatedIncome <= 0n),
        new ButtonBuilder()
            .setCustomId(`biz:upgrade:${userId}`)
            .setLabel(maxLevel ? '🔒 最大レベル' : `⬆️ Lv.UP (${formatChips(nextLevel!.upgradeCost)})`)
            .setStyle(maxLevel ? ButtonStyle.Secondary : ButtonStyle.Primary)
            .setDisabled(maxLevel),
    );

    const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId(`biz:employees:${userId}`)
            .setLabel(`👥 従業員管理 (${biz.employees.length}/${configService.getNumber(S.businessEmployeeMax)})`)
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(`biz:sell:${userId}`)
            .setLabel('売却')
            .setStyle(ButtonStyle.Danger),
    );

    container.addActionRowComponents(row1);
    container.addActionRowComponents(row2);

    return container;
}

export function buildBusinessCollectView(result: CollectResult, userId: string): ContainerBuilder {
    const container = new ContainerBuilder()
        .setAccentColor(result.event?.multiplier === 0 ? CasinoTheme.colors.red : CasinoTheme.colors.gold)
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(BIZ_PREFIX),
        )
        .addSeparatorComponents(
            new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
        );

    if (result.event) {
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `${result.event.emoji} **経営イベント: ${result.event.name}**\n報酬倍率: **${result.event.multiplier}x**`,
            ),
        );
        container.addSeparatorComponents(
            new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
        );
    }

    const lines: string[] = [
        `💰 基本収入: ${formatChips(result.income!)}`,
    ];
    if (result.employeeBonus && result.employeeBonus > 0n) {
        lines.push(`👥 従業員ボーナス: +${formatChips(result.employeeBonus)}`);
    }
    if (result.event && result.event.multiplier !== 1.0) {
        lines.push(`${result.event.emoji} イベント効果: ×${result.event.multiplier}`);
    }
    lines.push(`\n📊 **最終収入: ${formatChips(result.finalIncome!)}**`);
    if (result.employeeSalaries && result.employeeSalaries > 0n) {
        lines.push(`💸 従業員給料支払い: ${formatChips(result.employeeSalaries)}`);
    }
    lines.push(`💰 残高: **${formatChips(result.newBalance!)}**`);

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(lines.join('\n')),
    );
    container.addSeparatorComponents(
        new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    );

    container.addActionRowComponents(
        new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setCustomId(`biz:back:${userId}`)
                .setLabel('🏢 ダッシュボードに戻る')
                .setStyle(ButtonStyle.Primary),
        ),
    );

    return container;
}

export function buildBusinessUpgradeConfirmView(
    userId: string,
    businessName: string,
    businessEmoji: string,
    currentLevel: number,
    nextLevelDesc: string,
    upgradeCost: bigint,
    newIncomePerHour: bigint,
): ContainerBuilder {
    const container = new ContainerBuilder()
        .setAccentColor(CasinoTheme.colors.purple)
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(BIZ_PREFIX),
        )
        .addSeparatorComponents(
            new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
        )
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `${businessEmoji} **${businessName}** レベルアップ確認\n\nLv.${currentLevel} → Lv.${currentLevel + 1}\n📝 ${nextLevelDesc}\n💰 費用: **${formatChips(upgradeCost)}**\n📈 新収入: **${formatChips(newIncomePerHour)}/h**`,
            ),
        )
        .addSeparatorComponents(
            new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
        );

    container.addActionRowComponents(
        new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setCustomId(`biz:upgrade_confirm:${userId}`)
                .setLabel('⬆️ レベルアップする')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId(`biz:back:${userId}`)
                .setLabel('キャンセル')
                .setStyle(ButtonStyle.Secondary),
        ),
    );

    return container;
}

export function buildBusinessSellConfirmView(
    userId: string,
    businessName: string,
    businessEmoji: string,
    currentLevel: number,
    totalInvested: bigint,
    refundAmount: bigint,
    employeeCount: number,
): ContainerBuilder {
    const container = new ContainerBuilder()
        .setAccentColor(CasinoTheme.colors.red)
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(BIZ_PREFIX),
        )
        .addSeparatorComponents(
            new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
        )
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `⚠️ **${businessEmoji} ${businessName} Lv.${currentLevel} を売却しますか？**\n\n`
                + `💰 総投資額: **${formatChips(totalInvested)}**\n`
                + `💸 返金額 (30%): **${formatChips(refundAmount)}**`
                + (employeeCount > 0 ? `\n👥 従業員 ${employeeCount}人 → **全員解雇**` : '')
                + `\n\n⚠️ この操作は取り消せません。`,
            ),
        )
        .addSeparatorComponents(
            new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
        );

    container.addActionRowComponents(
        new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setCustomId(`biz:sell_confirm:${userId}`)
                .setLabel('売却する')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId(`biz:back:${userId}`)
                .setLabel('キャンセル')
                .setStyle(ButtonStyle.Secondary),
        ),
    );

    return container;
}

export function buildBusinessEmployeeView(
    userId: string,
    employees: { userId: string; hiredAt: Date }[],
): ContainerBuilder {
    const container = new ContainerBuilder()
        .setAccentColor(CasinoTheme.colors.gold)
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(BIZ_PREFIX),
        )
        .addSeparatorComponents(
            new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
        )
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `**👥 従業員管理** (${employees.length}/${configService.getNumber(S.businessEmployeeMax)})\n\n従業員ボーナス: オーナー収入 **+${configService.getNumber(S.businessOwnerBonus)}%/人**\n従業員給料: 収入の **${configService.getNumber(S.businessSalaryRate)}%**`,
            ),
        )
        .addSeparatorComponents(
            new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
        );

    if (employees.length > 0) {
        const empLines = employees.map(e => `👤 <@${e.userId}>`);
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(empLines.join('\n')),
        );
        container.addSeparatorComponents(
            new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
        );

        // Fire buttons
        const fireButtons = employees.map(e =>
            new ButtonBuilder()
                .setCustomId(`biz:fire:${userId}:${e.userId}`)
                .setLabel(`解雇`)
                .setStyle(ButtonStyle.Danger),
        );

        container.addActionRowComponents(
            new ActionRowBuilder<ButtonBuilder>().addComponents(...fireButtons),
        );
    } else {
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent('従業員がいません。'),
        );
    }

    container.addSeparatorComponents(
        new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    );

    const actionButtons: ButtonBuilder[] = [];
    if (employees.length < configService.getNumber(S.businessEmployeeMax)) {
        actionButtons.push(
            new ButtonBuilder()
                .setCustomId(`biz:hire:${userId}`)
                .setLabel('👤 従業員を雇う')
                .setStyle(ButtonStyle.Primary),
        );
    }
    actionButtons.push(
        new ButtonBuilder()
            .setCustomId(`biz:back:${userId}`)
            .setLabel('🏢 戻る')
            .setStyle(ButtonStyle.Secondary),
    );

    container.addActionRowComponents(
        new ActionRowBuilder<ButtonBuilder>().addComponents(...actionButtons),
    );

    return container;
}
