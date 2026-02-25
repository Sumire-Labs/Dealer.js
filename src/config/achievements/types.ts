export type AchievementCategory = 'gaming' | 'economy' | 'social' | 'special';
export type AchievementContext =
    | 'game_result'
    | 'daily_claim'
    | 'economy_change'
    | 'bankruptcy'
    | 'loan'
    | 'lottery'
    | 'heist'
    | 'multiplayer'
    | 'work'
    | 'mission'
    | 'shop'
    | 'weekly_challenge';

export interface AchievementDefinition {
    id: string;
    name: string;
    description: string;
    emoji: string;
    category: AchievementCategory;
    contexts: AchievementContext[];
    hidden: boolean;
}
