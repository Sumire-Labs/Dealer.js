import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  TextDisplayBuilder,
} from 'discord.js';
import {CasinoTheme} from '../../themes/casino.theme.js';
import {formatTimeDelta} from '../../../utils/formatters.js';
import {SHIFTS, type ShiftType} from '../../../config/jobs.js';
import {configService} from '../../../config/config.service.js';
import {S} from '../../../config/setting-defs.js';
import {buildCooldownKey, getRemainingCooldown} from '../../../utils/cooldown.js';
import type {SpecialShiftDefinition} from '../../../config/special-shifts.js';

export interface ShiftSelectViewData {
    userId: string;
    jobId: string;
    jobName: string;
    jobEmoji: string;
    isPromoted?: boolean;
    specialShifts?: SpecialShiftDefinition[];
}

function getShiftCooldown(type: ShiftType): number {
    const map: Record<ShiftType, () => number> = {
        short: () => configService.getNumber(S.workShortCD),
        normal: () => configService.getNumber(S.workNormalCD),
        long: () => configService.getNumber(S.workLongCD),
    };
    return map[type]();
}

export function buildShiftSelectView(data: ShiftSelectViewData): ContainerBuilder {
    const {userId, jobId, jobName, jobEmoji, specialShifts} = data;

    const container = new ContainerBuilder()
        .setAccentColor(CasinoTheme.colors.gold)
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(CasinoTheme.prefixes.work),
        )
        .addSeparatorComponents(
            new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
        )
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `${jobEmoji} **${jobName}** で働く${data.isPromoted ? ' ⭐' : ''}`,
            ),
        )
        .addSeparatorComponents(
            new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
        );

    // Normal shift buttons with cooldown check
    const shiftButtons = SHIFTS.map(shift => {
        const remaining = getRemainingCooldown(buildCooldownKey(userId, shift.cooldownKey));
        const isDisabled = remaining > 0;
        const cooldownMs = getShiftCooldown(shift.type);
        const label = isDisabled
            ? `${shift.emoji} ${shift.label} (${formatTimeDelta(remaining)})`
            : `${shift.emoji} ${shift.label} (${formatTimeDelta(cooldownMs)})`;

        return new ButtonBuilder()
            .setCustomId(`work:shift:${userId}:${jobId}:${shift.type}`)
            .setLabel(label)
            .setStyle(isDisabled ? ButtonStyle.Secondary : ButtonStyle.Primary)
            .setDisabled(isDisabled);
    });

    container.addActionRowComponents(
        new ActionRowBuilder<ButtonBuilder>().addComponents(...shiftButtons),
    );

    // Special shift buttons
    if (specialShifts && specialShifts.length > 0) {
        const specialButtons = specialShifts.map(ss =>
            new ButtonBuilder()
                .setCustomId(`work:special:${userId}:${jobId}:${ss.type}`)
                .setLabel(`${ss.emoji} ${ss.name} (${ss.payMultiplier}x報酬)`)
                .setStyle(ButtonStyle.Danger),
        );

        container.addActionRowComponents(
            new ActionRowBuilder<ButtonBuilder>().addComponents(...specialButtons),
        );
    }

    return container;
}
