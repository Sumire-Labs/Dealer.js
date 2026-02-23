import { findOrCreateUser } from '../repositories/user.repository.js';
import {
  createBusiness,
  getBusiness,
  upgradeBusiness,
  updateLastCollected,
  addEmployee,
  removeEmployee,
  getEmploymentInfo,
} from '../repositories/business.repository.js';
import {
  BUSINESS_TYPE_MAP,
  getBusinessLevel,
  BUSINESS_EVENTS,
  type BusinessEvent,
  type BusinessTypeDefinition,
  type BusinessLevelDefinition,
} from '../../config/business.js';
import {
  BUSINESS_MAX_ACCUMULATION_MS,
} from '../../config/constants.js';
import { configService } from '../../config/config.service.js';
import { S } from '../../config/setting-defs.js';
import { addChips, removeChips } from './economy.service.js';
import { weightedRandom } from '../../utils/random.js';
import { secureRandomInt } from '../../utils/random.js';

export interface BusinessDashboardData {
  hasBusiness: boolean;
  workLevel: number;
  unlocked: boolean;
  business?: {
    type: BusinessTypeDefinition;
    level: number;
    levelDef: BusinessLevelDefinition;
    lastCollectedAt: Date;
    totalEarned: bigint;
    accumulatedIncome: bigint;
    employees: { userId: string; hiredAt: Date }[];
    employeeBonus: number;
  };
  chips: bigint;
}

function rollBusinessEvent(): BusinessEvent | undefined {
  const roll = secureRandomInt(1, 100);
  if (roll > configService.getNumber(S.businessEventChance)) return undefined;

  const items = BUSINESS_EVENTS.map(e => ({ value: e.id, weight: e.chance }));
  const eventId = weightedRandom(items);
  return BUSINESS_EVENTS.find(e => e.id === eventId);
}

export async function getBusinessDashboard(userId: string): Promise<BusinessDashboardData> {
  const user = await findOrCreateUser(userId);
  const unlocked = user.workLevel >= configService.getNumber(S.businessUnlockLevel);

  const business = await getBusiness(userId);

  if (!business) {
    return {
      hasBusiness: false,
      workLevel: user.workLevel,
      unlocked,
      chips: user.chips,
    };
  }

  const typeDef = BUSINESS_TYPE_MAP.get(business.type);
  if (!typeDef) {
    return { hasBusiness: false, workLevel: user.workLevel, unlocked, chips: user.chips };
  }

  const levelDef = getBusinessLevel(business.type, business.level);
  if (!levelDef) {
    return { hasBusiness: false, workLevel: user.workLevel, unlocked, chips: user.chips };
  }

  // Calculate accumulated income
  const now = Date.now();
  const elapsedMs = Math.min(now - business.lastCollectedAt.getTime(), BUSINESS_MAX_ACCUMULATION_MS);
  const elapsedHours = elapsedMs / (60 * 60 * 1000);
  const accumulatedIncome = BigInt(Math.floor(Number(levelDef.incomePerHour) * elapsedHours));

  const employees = business.employees.map(e => ({
    userId: e.userId,
    hiredAt: e.hiredAt,
  }));

  const employeeBonus = employees.length * configService.getNumber(S.businessOwnerBonus);

  return {
    hasBusiness: true,
    workLevel: user.workLevel,
    unlocked,
    chips: user.chips,
    business: {
      type: typeDef,
      level: business.level,
      levelDef,
      lastCollectedAt: business.lastCollectedAt,
      totalEarned: business.totalEarned,
      accumulatedIncome,
      employees,
      employeeBonus,
    },
  };
}

export async function buyBusiness(
  userId: string,
  typeId: string,
): Promise<{ success: boolean; error?: string }> {
  const user = await findOrCreateUser(userId);

  const businessUnlockLevel = configService.getNumber(S.businessUnlockLevel);
  if (user.workLevel < businessUnlockLevel) {
    return { success: false, error: `ビジネスにはワークLv.${businessUnlockLevel}が必要です。` };
  }

  const existing = await getBusiness(userId);
  if (existing) {
    return { success: false, error: 'すでにビジネスを所持しています。' };
  }

  const typeDef = BUSINESS_TYPE_MAP.get(typeId);
  if (!typeDef) {
    return { success: false, error: '無効なビジネスタイプです。' };
  }

  if (user.chips < typeDef.purchaseCost) {
    return { success: false, error: 'チップが不足しています。' };
  }

  await removeChips(userId, typeDef.purchaseCost, 'BUSINESS_INVEST');
  await createBusiness(userId, typeId);

  return { success: true };
}

export async function upgradeBusinessLevel(
  userId: string,
): Promise<{ success: boolean; newLevel?: number; cost?: bigint; error?: string }> {
  const business = await getBusiness(userId);
  if (!business) {
    return { success: false, error: 'ビジネスを所持していません。' };
  }

  const typeDef = BUSINESS_TYPE_MAP.get(business.type);
  if (!typeDef) {
    return { success: false, error: '無効なビジネスタイプです。' };
  }

  if (business.level >= typeDef.maxLevel) {
    return { success: false, error: 'すでに最大レベルです。' };
  }

  const nextLevel = getBusinessLevel(business.type, business.level + 1);
  if (!nextLevel) {
    return { success: false, error: '次のレベルが見つかりません。' };
  }

  const user = await findOrCreateUser(userId);
  if (user.chips < nextLevel.upgradeCost) {
    return { success: false, error: 'チップが不足しています。' };
  }

  await removeChips(userId, nextLevel.upgradeCost, 'BUSINESS_INVEST');
  await upgradeBusiness(userId);

  return { success: true, newLevel: business.level + 1, cost: nextLevel.upgradeCost };
}

export interface CollectResult {
  success: boolean;
  income?: bigint;
  employeeBonus?: bigint;
  employeeSalaries?: bigint;
  event?: BusinessEvent;
  finalIncome?: bigint;
  newBalance?: bigint;
  error?: string;
}

export async function collectIncome(userId: string): Promise<CollectResult> {
  const business = await getBusiness(userId);
  if (!business) {
    return { success: false, error: 'ビジネスを所持していません。' };
  }

  const typeDef = BUSINESS_TYPE_MAP.get(business.type);
  if (!typeDef) {
    return { success: false, error: '無効なビジネスタイプです。' };
  }

  const levelDef = getBusinessLevel(business.type, business.level);
  if (!levelDef) {
    return { success: false, error: 'レベル情報が見つかりません。' };
  }

  const now = Date.now();
  const elapsedMs = Math.min(now - business.lastCollectedAt.getTime(), BUSINESS_MAX_ACCUMULATION_MS);

  if (elapsedMs < 60_000) {
    return { success: false, error: '回収するほどの収入が蓄積されていません。（最低1分）' };
  }

  const elapsedHours = elapsedMs / (60 * 60 * 1000);
  const baseIncome = BigInt(Math.floor(Number(levelDef.incomePerHour) * elapsedHours));

  if (baseIncome <= 0n) {
    return { success: false, error: '回収する収入がありません。' };
  }

  // Employee bonus
  const employeeCount = business.employees.length;
  const employeeBonus = (baseIncome * BigInt(employeeCount * configService.getNumber(S.businessOwnerBonus))) / 100n;

  // Roll event
  const event = rollBusinessEvent();
  const eventMultiplier = event?.multiplier ?? 1.0;

  const beforeEvent = baseIncome + employeeBonus;
  const finalIncome = BigInt(Math.floor(Number(beforeEvent) * eventMultiplier));

  // Employee salaries
  let totalSalaries = 0n;
  if (employeeCount > 0 && finalIncome > 0n) {
    const salaryPerEmployee = (finalIncome * BigInt(configService.getNumber(S.businessSalaryRate))) / 100n;
    for (const emp of business.employees) {
      try {
        await addChips(emp.userId, salaryPerEmployee, 'BUSINESS_SALARY');
        totalSalaries += salaryPerEmployee;
      } catch { /* ignore if user doesn't exist */ }
    }
  }

  // Pay owner
  let newBalance: bigint;
  if (finalIncome > 0n) {
    newBalance = await addChips(userId, finalIncome, 'BUSINESS_COLLECT');
  } else {
    const user = await findOrCreateUser(userId);
    newBalance = user.chips;
  }

  await updateLastCollected(userId, new Date(now), finalIncome);

  return {
    success: true,
    income: baseIncome,
    employeeBonus,
    employeeSalaries: totalSalaries,
    event,
    finalIncome,
    newBalance,
  };
}

export async function hireEmployee(
  ownerId: string,
  employeeId: string,
): Promise<{ success: boolean; error?: string }> {
  if (ownerId === employeeId) {
    return { success: false, error: '自分自身を雇用することはできません。' };
  }

  const business = await getBusiness(ownerId);
  if (!business) {
    return { success: false, error: 'ビジネスを所持していません。' };
  }

  const businessEmployeeMax = configService.getNumber(S.businessEmployeeMax);
  if (business.employees.length >= businessEmployeeMax) {
    return { success: false, error: `従業員の上限（${businessEmployeeMax}人）に達しています。` };
  }

  // Check if employee exists
  try {
    await findOrCreateUser(employeeId);
  } catch {
    return { success: false, error: 'ユーザーが見つかりません。' };
  }

  // Check if already employed here
  const alreadyHired = business.employees.some(e => e.userId === employeeId);
  if (alreadyHired) {
    return { success: false, error: 'このユーザーはすでに雇用されています。' };
  }

  // Check if employed elsewhere
  const existing = await getEmploymentInfo(employeeId);
  if (existing) {
    return { success: false, error: 'このユーザーはすでに他のビジネスで働いています。' };
  }

  await addEmployee(business.id, employeeId);
  return { success: true };
}

export async function fireEmployee(
  ownerId: string,
  employeeId: string,
): Promise<{ success: boolean; error?: string }> {
  const business = await getBusiness(ownerId);
  if (!business) {
    return { success: false, error: 'ビジネスを所持していません。' };
  }

  const employee = business.employees.find(e => e.userId === employeeId);
  if (!employee) {
    return { success: false, error: 'この従業員は雇用されていません。' };
  }

  await removeEmployee(business.id, employeeId);
  return { success: true };
}
