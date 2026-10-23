export function applyFullSaleReturn(data, saleId, details, recordMovement) {
  const sale = data.sales.find((item) => item.id === saleId);
  if (!sale || sale.condition || sale.payment === "Courier Condition" || sale.returnedAt) return false;

  const stockChanges = [];
  for (const line of sale.items || []) {
    if (line.kind === "service") continue;
    const product = data.products.find((item) => item.id === line.productId);
    if (!product || product.kind === "service") return false;
    stockChanges.push({ product, quantity: Number(line.qty) || 0 });
  }

  for (const { product, quantity } of stockChanges) {
    product.stock = Math.max(0, Number(product.stock) || 0) + quantity;
    recordMovement(product, quantity);
  }

  sale.returnedAt = details.date;
  sale.returnReason = details.reason;
  const total = Number(sale.total) || 0;
  const refundAmount = Math.min(total, Math.max(0, Number(sale.paid) || 0));
  const profitReversed = (sale.items || []).reduce(
    (sum, line) => sum + (Number(line.price || 0) - Number(line.buyPrice || 0)) * Number(line.qty || 0),
    0,
  );
  data.returns.push({
    id: details.id,
    saleId,
    orderNo: sale.orderNo || "",
    date: details.date,
    reason: details.reason,
    customer: sale.customer || "",
    items: sale.items || [],
    total,
    refundAmount,
    cancelledDue: Math.max(0, total - refundAmount),
    profitReversed,
    staffName: details.staffName || "",
  });
  return true;
}
