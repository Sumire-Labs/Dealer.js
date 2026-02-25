/** configMax が 0n なら balance を返す。それ以外は min(configMax, balance) */
export function getEffectiveMax(configMax: bigint, balance: bigint): bigint {
    if (configMax <= 0n) return balance;
    return configMax < balance ? configMax : balance;
}
