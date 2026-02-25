export interface GameResult {
    multiplier: number;
    description: string;
    metadata: Record<string, unknown>;
}

export interface GameSession {
    userId: string;
    betAmount: bigint;
    startedAt: number;
}
