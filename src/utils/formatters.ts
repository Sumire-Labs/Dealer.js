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
