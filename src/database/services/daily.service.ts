import { DAILY_BONUS, DAILY_BONUS_BROKE, DAILY_COOLDOWN_MS } from '../../config/constants.js';
import { findOrCreateUser, updateLastDaily } from '../repositories/user.repository.js';
import { addChips } from './economy.service.js';

export interface DailyResult {
  success: boolean;
  amount?: bigint;
  newBalance?: bigint;
  remainingCooldown?: number;
}

export async function claimDaily(userId: string): Promise<DailyResult> {
  const user = await findOrCreateUser(userId);

  if (user.lastDaily) {
    const elapsed = Date.now() - user.lastDaily.getTime();
    if (elapsed < DAILY_COOLDOWN_MS) {
      return {
        success: false,
        remainingCooldown: DAILY_COOLDOWN_MS - elapsed,
      };
    }
  }

  const isBroke = user.chips === 0n;
  const amount = isBroke ? DAILY_BONUS_BROKE : DAILY_BONUS;

  const newBalance = await addChips(userId, amount, 'DAILY');
  await updateLastDaily(userId);

  return {
    success: true,
    amount,
    newBalance,
  };
}
