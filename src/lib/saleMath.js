export function paidAmount(total, enteredAmount, payment) {
  const safeTotal = Math.max(0, Number(total) || 0);
  if (payment === "Courier Condition") return 0;
  if (enteredAmount === "" || enteredAmount == null) {
    return payment === "Due" ? 0 : safeTotal;
  }
  const amount = Math.round(Number(enteredAmount) || 0);
  return Math.max(0, Math.min(amount, safeTotal));
}
