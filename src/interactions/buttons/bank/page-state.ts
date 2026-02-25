export const bankHistoryPage = new Map<string, number>();
export const bankLoanPage = new Map<string, number>();

export function setPageGuarded(map: Map<string, number>, key: string, value: number): void {
    if (map.size > 10_000) map.clear();
    map.set(key, value);
}
