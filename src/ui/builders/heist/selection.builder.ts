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
import {CasinoTheme} from '../../themes/casino.theme.js';
import {formatChips} from '../../../utils/formatters.js';
import {
  calculateMaxEntryFee,
  calculateMultiplierRange,
  calculateSuccessRate,
  type HeistCalcParams,
} from '../../../games/heist/heist.engine.js';
import {
  HEIST_APPROACH_MAP,
  HEIST_APPROACHES,
  HEIST_RISK_MAP,
  HEIST_RISKS,
  HEIST_TARGET_MAP,
  HEIST_TARGETS,
  type HeistApproach,
  type HeistRiskLevel,
  type HeistTarget,
} from '../../../config/heist.js';

export function buildHeistTargetSelectView(userId: string, amount: bigint): ContainerBuilder {
    const container = new ContainerBuilder()
        .setAccentColor(CasinoTheme.colors.red)
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(CasinoTheme.prefixes.heist),
        )
        .addSeparatorComponents(
            new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
        )
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `💰 参加費: **${formatChips(amount)}**\n\n` +
                '**ターゲットを選択:**',
            ),
        )
        .addSeparatorComponents(
            new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
        );

    const targetLines = HEIST_TARGETS.map(t => {
        const rateSign = t.successRateModifier >= 0 ? '+' : '';
        return `${t.emoji} **${t.name}** — ${t.description}\n` +
            `　成功率: ${rateSign}${t.successRateModifier}% | 倍率: ${t.multiplierMin}x〜${t.multiplierMax}x | 上限: ${formatChips(t.maxEntryFee)}`;
    });

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(targetLines.join('\n\n')),
    );

    container.addSeparatorComponents(
        new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    );

    const targetOptions = HEIST_TARGETS.map(t => {
        const rateSign = t.successRateModifier >= 0 ? '+' : '';
        return new StringSelectMenuOptionBuilder()
            .setLabel(`${t.emoji} ${t.name}`)
            .setDescription(`報酬 ${t.multiplierMin}x〜${t.multiplierMax}x | 成功率 ${rateSign}${t.successRateModifier}%`)
            .setValue(t.id);
    });

    container.addActionRowComponents(
        new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId(`heist_select:target:${userId}:${amount}`)
                .setPlaceholder('🎯 ターゲットを選択...')
                .addOptions(targetOptions),
        ),
    );

    return container;
}

export function buildHeistRiskSelectView(
    userId: string,
    amount: bigint,
    targetId: HeistTarget,
): ContainerBuilder {
    const target = HEIST_TARGET_MAP.get(targetId)!;

    const container = new ContainerBuilder()
        .setAccentColor(CasinoTheme.colors.red)
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(CasinoTheme.prefixes.heist),
        )
        .addSeparatorComponents(
            new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
        )
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `${target.emoji} **${target.name}** | 💰 ${formatChips(amount)}\n\n` +
                '**リスクレベルを選択:**',
            ),
        )
        .addSeparatorComponents(
            new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
        );

    const riskLines = HEIST_RISKS.map(r => {
        const maxFee = calculateMaxEntryFee(targetId, r.id);
        const rateSign = r.successRateModifier >= 0 ? '+' : '';
        return `${r.emoji} **${r.name}** — ${r.description}\n` +
            `　成功率: ${rateSign}${r.successRateModifier}% | 倍率: x${r.multiplierScale} | 最大参加費: ${formatChips(maxFee)}`;
    });

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(riskLines.join('\n\n')),
    );

    container.addSeparatorComponents(
        new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    );

    const riskOptions = HEIST_RISKS.map(r => {
        const maxFee = calculateMaxEntryFee(targetId, r.id);
        const rateSign = r.successRateModifier >= 0 ? '+' : '';
        return new StringSelectMenuOptionBuilder()
            .setLabel(`${r.emoji} ${r.name}`)
            .setDescription(`成功率 ${rateSign}${r.successRateModifier}% | 倍率 x${r.multiplierScale} | 上限 ${formatChips(maxFee)}`)
            .setValue(r.id);
    });

    container.addActionRowComponents(
        new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId(`heist_select:risk:${userId}:${amount}:${targetId}`)
                .setPlaceholder('⚡ リスクレベルを選択...')
                .addOptions(riskOptions),
        ),
    );

    return container;
}

export function buildHeistApproachSelectView(
    userId: string,
    amount: bigint,
    targetId: HeistTarget,
    riskId: HeistRiskLevel,
): ContainerBuilder {
    const target = HEIST_TARGET_MAP.get(targetId)!;
    const risk = HEIST_RISK_MAP.get(riskId)!;

    const container = new ContainerBuilder()
        .setAccentColor(CasinoTheme.colors.red)
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(CasinoTheme.prefixes.heist),
        )
        .addSeparatorComponents(
            new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
        )
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `${target.emoji} **${target.name}** | ${risk.emoji} ${risk.name} | 💰 ${formatChips(amount)}\n\n` +
                '**アプローチを選択:**',
            ),
        )
        .addSeparatorComponents(
            new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
        );

    const approachLines = HEIST_APPROACHES.map(a => {
        const rateSign = a.successRateModifier >= 0 ? '+' : '';
        return `${a.emoji} **${a.name}** — ${a.description}\n` +
            `　成功率: ${rateSign}${a.successRateModifier}% | 倍率: x${a.multiplierScale}`;
    });

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(approachLines.join('\n\n')),
    );

    container.addSeparatorComponents(
        new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    );

    // Approach SelectMenu (Group)
    const groupOptions = HEIST_APPROACHES.map(a => {
        const rateSign = a.successRateModifier >= 0 ? '+' : '';
        return new StringSelectMenuOptionBuilder()
            .setLabel(`${a.emoji} ${a.name} (グループ)`)
            .setDescription(`成功率 ${rateSign}${a.successRateModifier}% | 倍率 x${a.multiplierScale}`)
            .setValue(`group:${a.id}`);
    });

    // Approach SelectMenu (Solo)
    const soloOptions = HEIST_APPROACHES.map(a => {
        const rateSign = a.successRateModifier >= 0 ? '+' : '';
        return new StringSelectMenuOptionBuilder()
            .setLabel(`${a.emoji} ${a.name} (ソロ)`)
            .setDescription(`成功率 ${rateSign}${a.successRateModifier}% | 倍率 x${a.multiplierScale}`)
            .setValue(`solo:${a.id}`);
    });

    container.addActionRowComponents(
        new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId(`heist_select:approach:${userId}:${amount}:${targetId}:${riskId}`)
                .setPlaceholder('🔫 アプローチを選択...')
                .addOptions([...groupOptions, ...soloOptions]),
        ),
    );

    return container;
}

export function buildHeistConfirmView(
    userId: string,
    amount: bigint,
    targetId: HeistTarget,
    riskId: HeistRiskLevel,
    approachId: HeistApproach,
    isSolo: boolean,
): ContainerBuilder {
    const target = HEIST_TARGET_MAP.get(targetId)!;
    const risk = HEIST_RISK_MAP.get(riskId)!;
    const approach = HEIST_APPROACH_MAP.get(approachId)!;

    const params: HeistCalcParams = {
        playerCount: 1,
        target: targetId,
        riskLevel: riskId,
        approach: approachId,
        isSolo,
    };
    const successRate = calculateSuccessRate(params);
    const {min, max} = calculateMultiplierRange(params);
    const minReturn = BigInt(Math.round(Number(amount) * min));
    const maxReturn = BigInt(Math.round(Number(amount) * max));
    const mode = isSolo ? 'solo' : 'group';

    const container = new ContainerBuilder()
        .setAccentColor(CasinoTheme.colors.red)
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(CasinoTheme.prefixes.heist),
        )
        .addSeparatorComponents(
            new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
        )
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent('**📋 最終確認**'),
        )
        .addSeparatorComponents(
            new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
        )
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `${target.emoji} **ターゲット**: ${target.name}\n` +
                `${risk.emoji} **リスク**: ${risk.name}\n` +
                `${approach.emoji} **アプローチ**: ${approach.name}\n` +
                `👤 **モード**: ${isSolo ? 'ソロ' : 'グループ'}\n` +
                `💰 **参加費**: ${formatChips(amount)}\n` +
                `📊 **成功率**: ${successRate}%\n` +
                `💎 **倍率**: ${min}x〜${max}x\n` +
                `💵 **推定リターン**: ${formatChips(minReturn)}〜${formatChips(maxReturn)}\n` +
                `📝 **フェーズ数**: ${target.phases.length}`,
            ),
        )
        .addSeparatorComponents(
            new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
        )
        .addActionRowComponents(
            new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder()
                    .setCustomId(`heist:confirm:${userId}:${amount}:${targetId}:${riskId}:${approachId}:${mode}`)
                    .setLabel('🔫 決行')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId(`heist:back:${userId}:${amount}:${targetId}:${riskId}`)
                    .setLabel('↩ 戻る')
                    .setStyle(ButtonStyle.Secondary),
            ),
        );

    return container;
}
