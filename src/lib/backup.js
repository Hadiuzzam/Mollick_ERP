export function parseBackup(text) {
  const data = JSON.parse(text);
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Invalid backup");
  }
  for (const key of ["products", "sales", "expenses", "staff"]) {
    if (!Array.isArray(data[key])) throw new Error(`Missing ${key}`);
  }
  if (!data.shop || typeof data.shop !== "object" || Array.isArray(data.shop)) {
    throw new Error("Missing business information");
  }
  if (data.products.some((item) =>
    !item || typeof item.id !== "string" || typeof item.name !== "string" ||
    !Number.isFinite(Number(item.stock)) || Number(item.stock) < 0
  )) throw new Error("Invalid products");
  if (data.sales.some((item) =>
    !item || typeof item.id !== "string" || !Array.isArray(item.items) ||
    !Number.isFinite(Number(item.total)) || Number(item.total) < 0 ||
    !Number.isFinite(Number(item.paid)) || Number(item.paid) < 0 ||
    Number(item.paid) > Number(item.total) ||
    item.items.some((line) =>
      !line || !Number.isFinite(Number(line.qty)) || Number(line.qty) <= 0 ||
      !Number.isFinite(Number(line.price)) || Number(line.price) < 0
    )
  )) throw new Error("Invalid sales");
  if (data.expenses.some((item) =>
    !item || !Number.isFinite(Number(item.amount)) || Number(item.amount) < 0
  )) throw new Error("Invalid expenses");
  if (data.staff.some((item) =>
    !item || typeof item.id !== "string" || typeof item.name !== "string"
  )) throw new Error("Invalid staff");
  for (const key of ["products", "sales", "expenses", "staff"]) {
    const ids = data[key].map((item) => item.id);
    if (new Set(ids).size !== ids.length) throw new Error(`Duplicate ${key}`);
  }
  for (const key of ["stockMovements", "duePayments", "purchases", "returns"]) {
    if (data[key] != null && !Array.isArray(data[key])) {
      throw new Error(`Invalid ${key}`);
    }
  }
  if (data.purchases?.some((item) =>
    !item || typeof item.id !== "string" || typeof item.productId !== "string" ||
    !Number.isFinite(Number(item.qty)) || Number(item.qty) <= 0 ||
    !Number.isFinite(Number(item.unitCost)) || Number(item.unitCost) <= 0 ||
    !Number.isFinite(Number(item.total)) || Number(item.total) < 0
  )) throw new Error("Invalid purchases");
  if (data.purchases && new Set(data.purchases.map((item) => item.id)).size !== data.purchases.length) {
    throw new Error("Duplicate purchases");
  }
  if (data.returns?.some((item) =>
    !item || typeof item.id !== "string" || typeof item.saleId !== "string" ||
    !Number.isFinite(Number(item.total)) || Number(item.total) < 0 ||
    !Number.isFinite(Number(item.refundAmount)) || Number(item.refundAmount) < 0 ||
    Number(item.refundAmount) > Number(item.total)
  )) throw new Error("Invalid returns");
  if (data.returns && new Set(data.returns.map((item) => item.id)).size !== data.returns.length) {
    throw new Error("Duplicate returns");
  }
  if (data.returns?.some((item) => !data.sales.some((sale) => sale.id === item.saleId && sale.returnedAt))) {
    throw new Error("Unmatched return");
  }
  return data;
}
