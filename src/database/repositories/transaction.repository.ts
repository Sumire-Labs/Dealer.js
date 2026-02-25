import {type GameType, Prisma, type TransactionType} from '@prisma/client';
import {prisma} from '../client.js';

export interface CreateTransactionInput {
    userId: string;
    type: TransactionType;
    game?: GameType;
    amount: bigint;
    balanceAfter: bigint;
    metadata?: Prisma.InputJsonValue;
}

export async function createTransaction(input: CreateTransactionInput) {
    return prisma.transaction.create({
        data: {
            userId: input.userId,
            type: input.type,
            game: input.game ?? null,
            amount: input.amount,
            balanceAfter: input.balanceAfter,
            metadata: input.metadata ?? Prisma.JsonNull,
        },
    });
}

export async function getUserTransactions(
    userId: string,
    limit = 20,
    offset = 0,
) {
    return prisma.transaction.findMany({
        where: {userId},
        orderBy: {createdAt: 'desc'},
        take: limit,
        skip: offset,
    });
}

const BANK_TRANSACTION_TYPES: TransactionType[] = [
    'BANK_DEPOSIT',
    'BANK_WITHDRAW',
    'BANK_TRANSFER_SEND',
    'BANK_TRANSFER_RECV',
    'BANK_INTEREST',
    'LOAN_BORROW',
    'LOAN_REPAY',
    'BANKRUPTCY',
    'FIXED_DEPOSIT_CREATE',
    'FIXED_DEPOSIT_MATURE',
    'FIXED_DEPOSIT_EARLY_WITHDRAW',
];

export async function getBankTransactions(
    userId: string,
    limit: number,
    offset: number,
) {
    const where = {
        userId,
        type: {in: BANK_TRANSACTION_TYPES},
    };

    const [transactions, total] = await Promise.all([
        prisma.transaction.findMany({
            where,
            select: {
                id: true,
                type: true,
                amount: true,
                balanceAfter: true,
                createdAt: true,
                metadata: true,
            },
            orderBy: {createdAt: 'desc'},
            take: limit,
            skip: offset,
        }),
        prisma.transaction.count({where}),
    ]);

    return {transactions, total};
}
