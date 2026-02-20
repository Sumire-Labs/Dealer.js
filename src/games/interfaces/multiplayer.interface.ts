export interface MultiplayerSession {
  id: string;
  channelId: string;
  participants: Map<string, PlayerBet>;
  status: 'betting' | 'running' | 'finished' | 'cancelled';
  createdAt: number;
}

export interface PlayerBet {
  userId: string;
  choice: number;
  amount: bigint;
}
