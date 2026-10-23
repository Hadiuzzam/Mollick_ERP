import assert from "node:assert/strict";
import test from "node:test";
import { businessDateKey, businessMonthKey } from "./businessDate.js";
import { parseBackup } from "./backup.js";
import { paidAmount } from "./saleMath.js";
import { receivePurchase } from "./inventory.js";
import { applyFullSaleReturn } from "./returns.js";

test("reports use Dhaka calendar dates around UTC midnight and month end", () => {
  assert.equal(businessDateKey("2026-10-22T19:00:00.000Z"), "2026-10-23");
  assert.equal(businessMonthKey("2026-10-31T19:00:00.000Z"), "2026-11");
});

test("backup import rejects incomplete and invalid business data", () => {
  assert.throws(() => parseBackup(JSON.stringify({ products: [] })));
  const backup = {
    products: [{ id: "p1", name: "Test", stock: 2 }],
    sales: [], expenses: [], staff: [], shop: { name: "Test" },
  };
  assert.deepEqual(parseBackup(JSON.stringify(backup)), backup);
  backup.products[0].stock = -2;
  assert.throws(() => parseBackup(JSON.stringify(backup)));
  backup.products[0].stock = 2;
  backup.sales = [{ id: "s1", items: [{ qty: 1, price: 10 }], total: 10, paid: 11 }];
  assert.throws(() => parseBackup(JSON.stringify(backup)));
});

test("blank Due payment remains unpaid while blank Cash payment is fully paid", () => {
  assert.equal(paidAmount(500, "", "Due"), 0);
  assert.equal(paidAmount(500, "", "Cash"), 500);
  assert.equal(paidAmount(500, "125", "Due"), 125);
  assert.equal(paidAmount(500, "900", "Cash"), 500);
  assert.equal(paidAmount(500, "-10", "Cash"), 0);
  assert.equal(paidAmount(500, "100", "Courier Condition"), 0);
});

test("a purchase increases stock and uses the weighted average buying cost", () => {
  const product = { id: "p1", stock: 10, buyPrice: 100 };
  assert.deepEqual(receivePurchase(product, 10, 200), {
    id: "p1", stock: 20, buyPrice: 150,
  });
  assert.equal(product.stock, 10);
});

test("a full return restores stock once and records refund plus cancelled due", () => {
  const data = {
    products: [{ id: "p1", kind: "product", stock: 3 }],
    sales: [{ id: "s1", total: 200, paid: 50, items: [{ productId: "p1", kind: "product", qty: 2, price: 100, buyPrice: 60 }] }],
    returns: [],
  };
  const movements = [];
  const details = { id: "r1", date: "2026-10-23T13:00:00.000Z", reason: "Damaged", staffName: "Owner" };
  assert.equal(applyFullSaleReturn(data, "s1", details, (product, qty) => movements.push([product.id, qty])), true);
  assert.equal(data.products[0].stock, 5);
  assert.deepEqual(movements, [["p1", 2]]);
  assert.equal(data.returns[0].refundAmount, 50);
  assert.equal(data.returns[0].cancelledDue, 150);
  assert.equal(data.returns[0].profitReversed, 80);
  assert.equal(applyFullSaleReturn(data, "s1", details, () => {}), false);
  assert.equal(data.products[0].stock, 5);
});
