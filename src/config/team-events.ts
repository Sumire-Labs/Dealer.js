export interface TeamEvent {
  id: string;
  name: string;
  emoji: string;
  description: string;
  payMultiplier: number;
  chance: number;
}

export const TEAM_EVENTS: TeamEvent[] = [
  {
    id: 'team_rush',
    name: '大忙し',
    emoji: '🔥',
    description: '予想外の来客ラッシュ！チームワークで乗り切れ！',
    payMultiplier: 1.8,
    chance: 20,
  },
  {
    id: 'team_vip',
    name: 'VIP来店',
    emoji: '⭐',
    description: 'VIP客が来店！チーム全員でおもてなし！',
    payMultiplier: 2.0,
    chance: 10,
  },
  {
    id: 'team_trouble',
    name: '連携ミス',
    emoji: '💥',
    description: 'チーム内で連携ミスが発生...',
    payMultiplier: 0.5,
    chance: 15,
  },
];

export const TEAM_EVENT_MAP = new Map(TEAM_EVENTS.map(e => [e.id, e]));
