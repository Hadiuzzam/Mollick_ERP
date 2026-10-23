export function receivePurchase(product, quantity, unitCost) {
  const currentStock = Math.max(0, Number(product.stock) || 0);
  const currentCost = Math.max(0, Number(product.buyPrice) || 0);
  const nextStock = currentStock + quantity;
  return {
    ...product,
    stock: nextStock,
    buyPrice: Math.round((currentStock * currentCost + quantity * unitCost) / nextStock),
  };
}
