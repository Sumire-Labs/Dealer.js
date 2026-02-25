export type SymbolRank = 'special' | 'high' | 'medium' | 'low';

export interface SlotSymbol {
    id: string;
    emoji: string;
    rank: SymbolRank;
    weight: number;
}

export const SLOT_SYMBOLS: readonly SlotSymbol[] = [
    // Special (wild)
    {id: 'DIAMOND', emoji: '💎', rank: 'special', weight: 2},
    // High rank
    {id: 'SEVEN', emoji: '7️⃣', rank: 'high', weight: 5},
    {id: 'CROWN', emoji: '👑', rank: 'high', weight: 5},
    // Medium rank
    {id: 'BELL', emoji: '🔔', rank: 'medium', weight: 10},
    {id: 'STAR', emoji: '⭐', rank: 'medium', weight: 10},
    // Low rank
    {id: 'CHERRY', emoji: '🍒', rank: 'low', weight: 15},
    {id: 'LEMON', emoji: '🍋', rank: 'low', weight: 15},
    {id: 'GRAPE', emoji: '🍇', rank: 'low', weight: 15},
] as const;

export const SPIN_EMOJIS = ['🔄', '❓', '⚡', '✨', '🎲'];

export function getSymbolById(id: string): SlotSymbol {
    const symbol = SLOT_SYMBOLS.find(s => s.id === id);
    if (!symbol) throw new Error(`Unknown symbol: ${id}`);
    return symbol;
}
