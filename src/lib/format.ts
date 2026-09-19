export function formatYen(amount: number): string {
  return `${amount.toLocaleString("ja-JP")}円`;
}

export function formatSignedYen(amount: number): string {
  const formatted = Math.abs(amount).toLocaleString("ja-JP");
  if (amount > 0) {
    return `+${formatted}円`;
  }
  if (amount < 0) {
    return `-${formatted}円`;
  }
  return "0円";
}
