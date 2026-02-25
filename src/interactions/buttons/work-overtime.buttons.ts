import {type ButtonInteraction, MessageFlags,} from 'discord.js';
import {
  buildOvertimeConfirmView,
  buildOvertimeResultView,
  buildOvertimeStopView,
} from '../../ui/builders/overtime.builder.js';
import {JOB_MAP} from '../../config/jobs.js';
import {PROMOTED_JOB_MAP} from '../../config/promoted-jobs.js';
import {OVERTIME_MULTIPLIERS,} from '../../config/constants.js';
import {configService} from '../../config/config.service.js';
import {S} from '../../config/setting-defs.js';
import {getOvertimeSession, removeOvertimeSession,} from '../../games/work/overtime.session.js';
import {calculateOvertimePay, rollOvertimeEvent} from '../../games/work/work.engine.js';
import {addChips, removeChips} from '../../database/services/economy.service.js';

export async function handleOvertimeAction(
    interaction: ButtonInteraction,
    action: string,
    parts: string[],
): Promise<void> {
    switch (action) {
        case 'overtime': {
            const ownerId = parts[2];

            if (interaction.user.id !== ownerId) {
                await interaction.reply({
                    content: '`/work` で自分のワークパネルを開いてください。',
                    flags: MessageFlags.Ephemeral,
                });
                return;
            }

            // Get or create overtime session from last work result
            let session = getOvertimeSession(ownerId);
            if (!session) {
                await interaction.reply({
                    content: '残業セッションが見つかりません。もう一度シフトを開始してください。',
                    flags: MessageFlags.Ephemeral,
                });
                return;
            }

            const round = session.currentRound;
            if (round >= configService.getNumber(S.overtimeMaxRounds)) {
                removeOvertimeSession(ownerId);
                await interaction.reply({
                    content: '残業は最大3回までです。',
                    flags: MessageFlags.Ephemeral,
                });
                return;
            }

            const riskPercent = Math.min(session.baseRiskRate + (round + 1) * configService.getNumber(S.overtimeRisk), 95);
            const multiplier = OVERTIME_MULTIPLIERS[round];

            const view = buildOvertimeConfirmView({
                userId: ownerId,
                jobName: (JOB_MAP.get(session.jobId) ?? PROMOTED_JOB_MAP.get(session.jobId))?.name ?? '不明',
                jobEmoji: (JOB_MAP.get(session.jobId) ?? PROMOTED_JOB_MAP.get(session.jobId))?.emoji ?? '💼',
                round,
                riskPercent,
                multiplier,
                accumulatedBonus: session.accumulatedBonus,
                baseShiftPay: session.baseShiftPay,
            });

            await interaction.update({
                components: [view],
                flags: MessageFlags.IsComponentsV2,
            });
            break;
        }

        case 'ot_go': {
            const ownerId = parts[2];

            if (interaction.user.id !== ownerId) {
                await interaction.reply({
                    content: '`/work` で自分のワークパネルを開いてください。',
                    flags: MessageFlags.Ephemeral,
                });
                return;
            }

            const session = getOvertimeSession(ownerId);
            if (!session) {
                await interaction.reply({
                    content: '残業セッションが見つかりません。',
                    flags: MessageFlags.Ephemeral,
                });
                return;
            }

            const round = session.currentRound;
            const event = rollOvertimeEvent(session.baseRiskRate, round);
            const roundBonus = calculateOvertimePay(session.baseShiftPay, round);
            const job = JOB_MAP.get(session.jobId) ?? PROMOTED_JOB_MAP.get(session.jobId);

            if (event.type === 'accident') {
                // Overtime failure — confiscate accumulated bonus
                const lostBonus = session.accumulatedBonus + roundBonus;
                let newBalance: bigint;
                if (session.accumulatedBonus > 0n) {
                    newBalance = await removeChips(ownerId, session.accumulatedBonus, 'WORK_EARN');
                } else {
                    const {getBalance} = await import('../../database/services/economy.service.js');
                    newBalance = await getBalance(ownerId);
                }
                removeOvertimeSession(ownerId);

                const view = buildOvertimeResultView({
                    userId: ownerId,
                    jobName: job?.name ?? '不明',
                    jobEmoji: job?.emoji ?? '💼',
                    success: false,
                    round,
                    roundBonus: 0n,
                    accumulatedBonus: 0n,
                    lostBonus,
                    newBalance,
                    canContinue: false,
                });

                await interaction.update({
                    components: [view],
                    flags: MessageFlags.IsComponentsV2,
                });
            } else {
                // Success — add bonus
                const newBalance = await addChips(ownerId, roundBonus, 'WORK_EARN');
                session.accumulatedBonus += roundBonus;
                session.currentRound += 1;

                const canContinue = session.currentRound < configService.getNumber(S.overtimeMaxRounds);
                if (!canContinue) {
                    removeOvertimeSession(ownerId);
                }

                const view = buildOvertimeResultView({
                    userId: ownerId,
                    jobName: job?.name ?? '不明',
                    jobEmoji: job?.emoji ?? '💼',
                    success: true,
                    round,
                    roundBonus,
                    accumulatedBonus: session.accumulatedBonus,
                    newBalance,
                    canContinue,
                });

                await interaction.update({
                    components: [view],
                    flags: MessageFlags.IsComponentsV2,
                });
            }
            break;
        }

        case 'ot_stop': {
            const ownerId = parts[2];

            if (interaction.user.id !== ownerId) {
                await interaction.reply({
                    content: '`/work` で自分のワークパネルを開いてください。',
                    flags: MessageFlags.Ephemeral,
                });
                return;
            }

            const session = getOvertimeSession(ownerId);
            const bonus = session?.accumulatedBonus ?? 0n;
            removeOvertimeSession(ownerId);

            const {getBalance} = await import('../../database/services/economy.service.js');
            const balance = await getBalance(ownerId);

            const view = buildOvertimeStopView(ownerId, bonus, balance);
            await interaction.update({
                components: [view],
                flags: MessageFlags.IsComponentsV2,
            });
            break;
        }
    }
}
