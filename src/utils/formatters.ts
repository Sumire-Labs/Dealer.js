const SI_SUFFIXES: Record<string, number> = {
    k: 1_000,
    m: 1_000_000,
    b: 1_000_000_000,
};

/**
 * Parse a chip amount string with optional SI suffix (k/m/b) and commas.
 * Examples: "10000", "10,000", "2k", "1.5m", "$50k"
 * Returns NaN for invalid input.
 */
export function parseChipAmount(input: string): number {
    let s = input.trim().replace(/[$,]/g, '');
    if (s.length === 0) return NaN;

    const lastChar = s[s.length - 1].toLowerCase();
    const multiplier = SI_SUFFIXES[lastChar];
    if (multiplier) {
        s = s.slice(0, -1);
        const num = parseFloat(s);
        if (isNaN(num)) return NaN;
        return Math.floor(num * multiplier);
    }

    const num = parseFloat(s);
    if (isNaN(num)) return NaN;
    return Math.floor(num);
}

export function formatChips(amount: bigint): string {
    const isNegative = amount < 0n;
    const abs = isNegative ? -amount : amount;
    const formatted = abs.toLocaleString('en-US');
    return `${isNegative ? '-' : ''}$${formatted}`;
}

export function formatMultiplier(multiplier: number): string {
    return `${multiplier}x`;
}

export function formatTimeDelta(ms: number): string {
    const totalSeconds = Math.ceil(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const parts: string[] = [];
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);
    return parts.join(' ');
}
