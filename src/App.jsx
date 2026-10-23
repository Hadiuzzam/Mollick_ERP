import React, { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  Boxes,
  ChevronDown,
  ChevronUp,
  Download,
  Eye,
  EyeOff,
  FileUp,
  Home,
  Pencil,
  PackagePlus,
  Plus,
  ReceiptText,
  Save,
  Search,
  Settings,
  ShoppingCart,
  Trash2,
  Truck,
  UserRound,
  Users,
  WalletCards,
  Warehouse,
  X,
} from "lucide-react";
import {
  getStoreMode,
  isFirebaseReady,
  mutateFirebaseData,
  register,
  resetPassword,
  replaceFirebaseData,
  signIn,
  signOutUser,
  subscribeAuth,
  subscribeFirebaseData,
} from "./lib/firebaseStore";
import { businessDateKey, businessMonthKey } from "./lib/businessDate";
import { parseBackup } from "./lib/backup";
import { paidAmount } from "./lib/saleMath";
import { receivePurchase } from "./lib/inventory";
import { applyFullSaleReturn } from "./lib/returns";

const LOCAL_KEY = "shohoj-erp-react-vite";
const LANG_KEY = "shohoj-erp-language";
const CURRENT_STAFF_KEY = "shohoj-erp-current-staff";

const languageText = {
  bn: {
    languageButton: "English",
    console: "আজকের কাজ",
    dashboard: "ড্যাশবোর্ড",
    sale: "বিক্রয়",
    allSales: "সব বিক্রয়",
    courier: "কুরিয়ার কন্ডিশন",
    productInsights: "পণ্য চাহিদা",
    customerInsights: "ক্রেতা বিশ্লেষণ",
    products: "পণ্য/সেবা",
    purchases: "ক্রয়",
    stock: "স্টক",
    dues: "বাকি",
    reports: "রিপোর্ট",
    staff: "স্টাফ",
    settings: "সেটিংস",
    stockTitle: "স্টক কন্ট্রোল",
    stockSubtitle: "দেখানো",
    searchStock: "স্টক খুঁজুন",
    addProduct: "পণ্য যোগ",
    sellingPrice: "বিক্রয় মূল্য",
    staffTitle: "স্টাফ মেম্বার",
    active: "active",
    staffName: "স্টাফের নাম",
    role: "রোল",
    addStaff: "স্টাফ যোগ",
    staffSaved: "স্টাফ সেভ হয়েছে",
    enterStaff: "স্টাফের নাম দিন",
    assignedStaff: "স্টাফ",
  },
  en: {
    languageButton: "বাংলা",
    console: "Admin Console",
    dashboard: "Dashboard",
    sale: "Sale",
    allSales: "All Sales",
    courier: "Courier COD",
    productInsights: "Product Demand",
    customerInsights: "Customer Insights",
    products: "Products & Services",
    purchases: "Purchases",
    stock: "Stock",
    dues: "Due",
    reports: "Reports",
    staff: "Staff",
    settings: "Settings",
    stockTitle: "Stock Control",
    stockSubtitle: "shown",
    searchStock: "Search stock",
    addProduct: "Add Product",
    sellingPrice: "selling price",
    staffTitle: "Staff Members",
    active: "active",
    staffName: "Staff name",
    role: "Role",
    addStaff: "Add Staff",
    staffSaved: "Staff saved",
    enterStaff: "Enter staff name",
    assignedStaff: "Staff",
  },
};

function uid(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function todayKey(date = new Date()) {
  return businessDateKey(date);
}

function monthKey(date = new Date()) {
  return businessMonthKey(date);
}

function getDateKey(iso) {
  return businessDateKey(iso);
}

function getMonthKey(iso) {
  return businessMonthKey(iso);
}

function wholeTaka(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? Math.round(number) : 0;
}

function money(value) {
  return `৳${wholeTaka(value).toLocaleString("bn-BD", {
    maximumFractionDigits: 0,
  })}`;
}

function getProductionInitialData() {
  return {
    products: [],
    purchases: [],
    returns: [],
    sales: [],
    expenses: [],
    staff: [],
    stockMovements: [],
    duePayments: [],
    shop: { name: "", phone: "", address: "" },
  };
}

function loadLocalData() {
  try {
    const saved = localStorage.getItem(LOCAL_KEY);
    return saved ? normalizeData(JSON.parse(saved)) : getProductionInitialData();
  } catch {
    return getProductionInitialData();
  }
}

function defaultStaff() {
  return [];
}

function normalizeData(data) {
  return {
    products: Array.isArray(data?.products)
      ? data.products.map((product) => ({
          ...product,
          active: product?.active !== false,
          kind: product?.kind === "service" ? "service" : "product",
        }))
      : [],
    purchases: Array.isArray(data?.purchases) ? data.purchases : [],
    returns: Array.isArray(data?.returns) ? data.returns : [],
    sales: Array.isArray(data?.sales) ? data.sales : [],
    expenses: Array.isArray(data?.expenses) ? data.expenses : [],
    staff: Array.isArray(data?.staff) ? data.staff : [],
    stockMovements: Array.isArray(data?.stockMovements) ? data.stockMovements : [],
    duePayments: Array.isArray(data?.duePayments) ? data.duePayments : [],
    shop: data?.shop || { name: "", phone: "", address: "" },
  };
}

function isConditionSale(sale) {
  return Boolean(sale?.condition) || sale?.payment === "Courier Condition";
}

function getConditionStatus(sale) {
  if (!isConditionSale(sale)) return "";
  return sale?.condition?.status || "pending_dispatch";
}

function isConditionSettled(sale) {
  return isConditionSale(sale) && getConditionStatus(sale) === "settled";
}

function isRevenueRecognizedSale(sale) {
  return !isConditionSale(sale) || isConditionSettled(sale);
}

function getRevenueDate(sale) {
  if (isConditionSettled(sale) && sale?.condition?.settledAt) {
    return sale.condition.settledAt;
  }

  return sale?.date;
}

function conditionStatusLabel(status, lang = "bn") {
  const labels = {
    pending_dispatch: {
      bn: "পাঠানোর অপেক্ষায়",
      en: "Pending dispatch",
    },
    sent: {
      bn: "কুরিয়ারে পাঠানো",
      en: "Sent to courier",
    },
    awaiting_payment: {
      bn: "টাকার অপেক্ষায়",
      en: "Awaiting payment",
    },
    settled: {
      bn: "টাকা পাওয়া গেছে",
      en: "Payment received",
    },
    returned: {
      bn: "ফেরত এসেছে",
      en: "Returned",
    },
  };

  return labels[status]?.[lang === "bn" ? "bn" : "en"] || status || "—";
}

function stockReasonLabel(reason, lang = "bn") {
  const labels = {
    opening_stock: ["শুরুর স্টক", "Opening stock"],
    product_edit: ["পণ্য সংশোধন", "Product edit"],
    adjustment: ["স্টক সমন্বয়", "Stock adjustment"],
    sale: ["বিক্রয়", "Sale"],
    purchase: ["ক্রয়", "Purchase"],
    sale_return: ["বিক্রয় ফেরত", "Sale return"],
    courier_return: ["কুরিয়ার ফেরত", "Courier return"],
  };
  return labels[reason]?.[lang === "bn" ? 0 : 1] || reason;
}

function saleProfit(sale) {
  if (!isRevenueRecognizedSale(sale)) return 0;

  const itemProfit = (Array.isArray(sale.items) ? sale.items : []).reduce(
    (sum, item) =>
      sum +
      (Number(item.price || 0) - Number(item.buyPrice || 0)) *
        Number(item.qty || 0),
    0,
  );

  const courierCharge = isConditionSale(sale)
    ? Number(sale?.condition?.courierCharge || 0)
    : 0;

  return itemProfit - courierCharge;
}

const tabs = [
  { id: "dashboard", label: "ড্যাশবোর্ড", icon: Home },
  { id: "sale", label: "বিক্রয়", icon: ShoppingCart },
  { id: "allSales", label: "সব বিক্রয়", icon: ReceiptText },
  { id: "courier", label: "কুরিয়ার কন্ডিশন", icon: Truck },
  { id: "productInsights", label: "পণ্য চাহিদা", icon: BarChart3 },
  { id: "customerInsights", label: "ক্রেতা বিশ্লেষণ", icon: UserRound },
  { id: "products", label: "পণ্য/সেবা", icon: Boxes },
  { id: "purchases", label: "ক্রয়", icon: PackagePlus },
  { id: "stock", label: "স্টক", icon: Warehouse },
  { id: "dues", label: "বাকি", icon: WalletCards },
  { id: "reports", label: "রিপোর্ট", icon: BarChart3 },
  { id: "staff", label: "স্টাফ", icon: Users },
  { id: "settings", label: "সেটিংস", icon: Settings },
];

const primaryTabs = new Set(["dashboard", "sale", "allSales", "products", "purchases", "stock", "dues", "settings"]);

const titles = {
  dashboard: "ড্যাশবোর্ড",
  sale: "বিক্রয় যোগ করা",
  allSales: "সব বিক্রয়",
  courier: "কুরিয়ার কন্ডিশন",
  productInsights: "পণ্য চাহিদা",
  customerInsights: "ক্রেতা বিশ্লেষণ",
  products: "পণ্য ও সেবা",
  purchases: "পণ্য ক্রয়",
  stock: "স্টক কন্ট্রোল",
  dues: "বাকি হিসাব",
  reports: "লাভ ও রিপোর্ট",
  staff: "স্টাফ মেম্বার",
  settings: "সেটিংস",
};

export default function App() {
  const [lang, setLang] = useState(() => localStorage.getItem(LANG_KEY) || "bn");
  const t = languageText[lang];
  const bt = (bn, en) => (lang === "bn" ? bn : en);
  const [data, setData] = useState(() =>
    isFirebaseReady() ? getProductionInitialData() : loadLocalData(),
  );
  const [authUser, setAuthUser] = useState(null);
  const [authReady, setAuthReady] = useState(!isFirebaseReady());
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authConfirmPassword, setAuthConfirmPassword] = useState("");
  const [authRegister, setAuthRegister] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [authNotice, setAuthNotice] = useState("");
  const [showAuthPassword, setShowAuthPassword] = useState(false);
  const [localDemoEntered, setLocalDemoEntered] = useState(false);
  const [saleSaving, setSaleSaving] = useState(false);
  const [currentStaffId, setCurrentStaffId] = useState(
    () => localStorage.getItem(CURRENT_STAFF_KEY) || "",
  );
  const [activeTab, setActiveTab] = useState("dashboard");
  const [showMoreNav, setShowMoreNav] = useState(false);
  const [toast, setToast] = useState("");
  const [search, setSearch] = useState("");
  const [stockSearch, setStockSearch] = useState("");
  const [reportFilter, setReportFilter] = useState("today");
  const [allSalesSearch, setAllSalesSearch] = useState("");
  const [allSalesStatus, setAllSalesStatus] = useState("all");
  const [conditionFilter, setConditionFilter] = useState("open");
  const [conditionSearch, setConditionSearch] = useState("");
  const [insightFilter, setInsightFilter] = useState("all");
  const [cloudStatus, setCloudStatus] = useState(getStoreMode());
  const [syncRetry, setSyncRetry] = useState(0);
  const [productForm, setProductForm] = useState(emptyProductForm);
  const [productDeleteConfirm, setProductDeleteConfirm] = useState({
    open: false,
    productId: "",
    productName: "",
  });
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [productCategory, setProductCategory] = useState("all");
  const [saleForm, setSaleForm] = useState(emptySaleForm);
  const [saleItems, setSaleItems] = useState([]);
  const [staffForm, setStaffForm] = useState({ name: "", role: "Cashier" });
  const [staffDeleteConfirm, setStaffDeleteConfirm] = useState({
    open: false,
    staffId: "",
    staffName: "",
    staffRole: "",
  });
  const [expenseForm, setExpenseForm] = useState({ type: "", amount: "", note: "" });
  const [purchaseForm, setPurchaseForm] = useState({ productId: "", supplier: "", qty: "", unitCost: "", note: "" });
  const [purchaseSaving, setPurchaseSaving] = useState(false);
  const [shopForm, setShopForm] = useState(data.shop);
  const [dueDialog, setDueDialog] = useState({ saleId: "", amount: "" });
  const [dueSaving, setDueSaving] = useState(false);
  const [returnDialog, setReturnDialog] = useState({ saleId: "", reason: "" });
  const [returnSaving, setReturnSaving] = useState(false);

  const products = data.products;
  const sales = data.sales;
  const returns = data.returns;
  const returnDialogSale = sales.find((sale) => sale.id === returnDialog.saleId);
  const dueDialogSale = sales.find((sale) => sale.id === dueDialog.saleId);
  const dueDialogRemaining = Math.max(0, Number(dueDialogSale?.total || 0) - Number(dueDialogSale?.paid || 0));
  const expenses = data.expenses;
  const staff = data.staff;
  const activeStaff = staff.filter((member) => member.active !== false);
  const currentStaff =
    activeStaff.find((member) => member.id === currentStaffId) ||
    activeStaff[0] ||
    null;
  const saleProducts = products.filter((product) => product.active !== false);

  useEffect(() => {
    localStorage.setItem(LANG_KEY, lang);
  }, [lang]);

  useEffect(() => {
    if (currentStaff?.id) {
      localStorage.setItem(CURRENT_STAFF_KEY, currentStaff.id);
    } else {
      localStorage.removeItem(CURRENT_STAFF_KEY);
    }
  }, [currentStaff?.id]);

  useEffect(() => {
    setShopForm(data.shop);
  }, [data.shop]);

  useEffect(() => {
    if (!isFirebaseReady()) return undefined;
    return subscribeAuth(
      (user) => {
        setAuthUser(user);
        setAuthReady(true);
        setData(getProductionInitialData());
        setCloudStatus(user ? "connecting" : "local");
      },
      () => {
        setAuthReady(true);
        setCloudStatus("error");
      },
    );
  }, []);

  useEffect(() => {
    if (!isFirebaseReady() || !authUser) return undefined;
    return subscribeFirebaseData(
      authUser.uid,
      (cloudData) => {
        setData(normalizeData(cloudData));
        setCloudStatus("firebase");
      },
      () => setCloudStatus("error"),
    );
  }, [authUser?.uid, syncRetry]);

  useEffect(() => {
    if (!isFirebaseReady()) {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(normalizeData(data)));
    }
  }, [data]);

  useEffect(() => {
    if (toast) {
      const timer = window.setTimeout(() => setToast(""), 2200);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [toast]);

  useEffect(() => {
    const product = products.find((item) => item.id === saleForm.productId);
    if (product && !saleForm.price) {
      setSaleForm((current) => ({
        ...current,
        price: String(wholeTaka(product.sellPrice)),
      }));
    }
  }, [products, saleForm.productId, saleForm.price]);

  function showToast(message) {
    setToast(message);
  }

  async function patchData(mutator) {
    const update = (current) => {
      const draft = structuredClone(normalizeData(current));
      if (mutator(draft) === false) return undefined;
      return draft;
    };
    if (isFirebaseReady()) {
      if (!authUser || cloudStatus !== "firebase") {
        showToast(bt("সংযোগ তৈরি হলে আবার চেষ্টা করুন", "Try again after connecting"));
        return false;
      }
      try {
        await mutateFirebaseData(authUser.uid, update);
        return true;
      } catch (error) {
        if (error?.code === "transaction/aborted") {
          showToast(bt("তথ্য বদলেছে; নতুন হিসাব দেখে আবার চেষ্টা করুন", "Data changed; review and retry"));
          return false;
        }
        setCloudStatus("error");
        showToast(bt("ডেটা সেভ হয়নি; আবার চেষ্টা করুন", "Save failed; please retry"));
        return false;
      }
    } else {
      setData((current) => update(current) || current);
      return true;
    }
  }

  function recordStockMovement(draft, product, delta, reason, saleId = "") {
    if (!delta) return;
    draft.stockMovements.push({
      id: uid("stock"),
      date: new Date().toISOString(),
      productId: product.id,
      productName: product.name,
      delta,
      reason,
      saleId,
      staffName: currentStaff?.name || "",
    });
  }

  const metrics = useMemo(() => {
    const today = todayKey();
    const month = monthKey();
    const todaysSales = sales.filter(
      (sale) =>
        getDateKey(getRevenueDate(sale)) === today &&
        isRevenueRecognizedSale(sale),
    );
    const monthlySales = sales.filter(
      (sale) =>
        getMonthKey(getRevenueDate(sale)) === month &&
        isRevenueRecognizedSale(sale),
    );
    const todaysReturns = returns.filter((item) => getDateKey(item.date) === today);
    const monthlyReturns = returns.filter((item) => getMonthKey(item.date) === month);
    const dailyExpense = expenses
      .filter((expense) => getDateKey(expense.date) === today)
      .reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
    const monthlyExpense = expenses
      .filter((expense) => getMonthKey(expense.date) === month)
      .reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
    const dailyProfit = todaysSales.reduce((sum, sale) => sum + saleProfit(sale), 0) - todaysReturns.reduce((sum, item) => sum + Number(item.profitReversed || 0), 0) - dailyExpense;
    const monthlyProfit = monthlySales.reduce((sum, sale) => sum + saleProfit(sale), 0) - monthlyReturns.reduce((sum, item) => sum + Number(item.profitReversed || 0), 0) - monthlyExpense;

    return {
      todaySales: todaysSales.reduce((sum, sale) => sum + Number(sale.total || 0), 0) - todaysReturns.reduce((sum, item) => sum + Number(item.total || 0), 0),
      todayProfit: dailyProfit,
      totalDue: sales
        .filter((sale) => !isConditionSale(sale) && !sale.returnedAt)
        .reduce(
          (sum, sale) =>
            sum +
            Math.max(
              0,
              Number(sale.total || 0) - Number(sale.paid || 0),
            ),
          0,
        ),
      conditionPending: sales
        .filter(
          (sale) =>
            isConditionSale(sale) &&
            !["settled", "returned"].includes(getConditionStatus(sale)),
        )
        .reduce((sum, sale) => sum + Number(sale.total || 0), 0),
      stockValue: products.reduce(
        (sum, product) => sum + Number(product.buyPrice || 0) * Number(product.stock || 0),
        0,
      ),
      monthSales: monthlySales.reduce((sum, sale) => sum + Number(sale.total || 0), 0) - monthlyReturns.reduce((sum, item) => sum + Number(item.total || 0), 0),
      monthProfit: monthlyProfit,
      monthExpense: monthlyExpense,
    };
  }, [expenses, products, returns, sales]);

  const lowStock = products.filter((product) =>
    product.active !== false && product.kind !== "service" &&
    Number(product.stock) <= Number(product.lowStock || 0),
  );
  const productCategories = [...new Set(
    products
      .map((product) => String(product.category || "").trim())
      .filter(Boolean),
  )].sort((a, b) => a.localeCompare(b));

  const filteredProducts = products.filter((product) => {
    const matchesSearch = `${product.name} ${product.category}`
      .toLowerCase()
      .includes(search.toLowerCase());

    const matchesCategory =
      productCategory === "all" ||
      String(product.category || "") === productCategory;

    return matchesSearch && matchesCategory;
  });
  const filteredStock = products.filter((product) =>
    product.kind !== "service" &&
    `${product.name} ${product.category}`.toLowerCase().includes(stockSearch.toLowerCase()),
  );
  const recentSales = [...sales].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 8);
  const dueSales = sales.filter(
    (sale) =>
      !isConditionSale(sale) &&
      !sale.returnedAt &&
      Number(sale.total || 0) - Number(sale.paid || 0) > 0.001,
  );
  const reportSales = sales
    .filter((sale) => {
      if (!isRevenueRecognizedSale(sale)) return false;
      if (reportFilter === "today") {
        return getDateKey(getRevenueDate(sale)) === todayKey();
      }
      if (reportFilter === "month") {
        return getMonthKey(getRevenueDate(sale)) === monthKey();
      }
      return true;
    })
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  const reportReturns = returns
    .filter((item) => reportFilter === "all" ||
      (reportFilter === "today" ? getDateKey(item.date) === todayKey() : getMonthKey(item.date) === monthKey()))
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const allSalesRows = [...sales]
    .filter((sale) => {
      const conditionSale = isConditionSale(sale);
      const conditionStatus = getConditionStatus(sale);
      const due = conditionSale
        ? 0
        : Math.max(
            0,
            Number(sale.total || 0) - Number(sale.paid || 0),
          );

      if (
        allSalesStatus === "paid" &&
        !(
          (conditionSale && conditionStatus === "settled") ||
          (!conditionSale && !sale.returnedAt && due <= 0)
        )
      ) {
        return false;
      }

      if (
        allSalesStatus === "due" &&
        (conditionSale || sale.returnedAt || due <= 0)
      ) {
        return false;
      }

      if (allSalesStatus === "condition" && !conditionSale) {
        return false;
      }
      if (allSalesStatus === "returned" && !sale.returnedAt && conditionStatus !== "returned") return false;

      const productNames = Array.isArray(sale.items)
        ? sale.items.map((item) => item.name || "").join(" ")
        : "";

      const searchable = [
        sale.orderNo || "",
        sale.customer || "",
        sale.customerPhone || "",
        sale.customerAddress || "",
        sale.staffName || "",
        sale.payment || "",
        sale?.condition?.courierName || "",
        sale?.condition?.trackingNo || "",
        conditionStatusLabel(conditionStatus, lang),
        sale.returnedAt ? bt("ফেরত", "returned") : "",
        productNames,
      ]
        .join(" ")
        .toLowerCase();

      return searchable.includes(allSalesSearch.trim().toLowerCase());
    })
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const allSalesSummary = allSalesRows.reduce(
    (summary, sale) => {
      const total = Number(sale.total || 0);
      const paid = Math.min(Number(sale.paid || 0), total);

      if (isRevenueRecognizedSale(sale) && !sale.returnedAt) {
        summary.total += total;
        summary.paid += paid;
      }

      if (!isConditionSale(sale) && !sale.returnedAt) {
        summary.due += Math.max(0, total - paid);
      }

      return summary;
    },
    { total: 0, paid: 0, due: 0 },
  );

  const conditionSales = [...sales]
    .filter((sale) => isConditionSale(sale))
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const filteredConditionSales = conditionSales.filter((sale) => {
    const status = getConditionStatus(sale);

    if (
      conditionFilter === "open" &&
      ["settled", "returned"].includes(status)
    ) {
      return false;
    }

    if (
      !["all", "open"].includes(conditionFilter) &&
      status !== conditionFilter
    ) {
      return false;
    }

    const productsText = Array.isArray(sale.items)
      ? sale.items.map((item) => item.name || "").join(" ")
      : "";

    const searchable = [
      sale.orderNo || "",
      sale.customer || "",
      sale.customerPhone || "",
      sale.customerAddress || "",
      sale?.condition?.courierName || "",
      sale?.condition?.trackingNo || "",
      productsText,
      conditionStatusLabel(status, lang),
    ]
      .join(" ")
      .toLowerCase();

    return searchable.includes(conditionSearch.trim().toLowerCase());
  });

  const conditionSummary = conditionSales.reduce(
    (summary, sale) => {
      const status = getConditionStatus(sale);
      const total = Number(sale.total || 0);

      if (!["settled", "returned"].includes(status)) {
        summary.openOrders += 1;
        summary.pendingAmount += total;
      }

      if (status === "awaiting_payment") {
        summary.awaitingAmount += total;
      }

      if (status === "settled") {
        summary.settledAmount += total;
      }

      return summary;
    },
    {
      openOrders: 0,
      pendingAmount: 0,
      awaitingAmount: 0,
      settledAmount: 0,
    },
  );


  const insightSales = sales.filter((sale) => {
    if (!isRevenueRecognizedSale(sale)) return false;
    if (insightFilter === "today") {
      return getDateKey(getRevenueDate(sale)) === todayKey();
    }

    if (insightFilter === "month") {
      return getMonthKey(getRevenueDate(sale)) === monthKey();
    }

    return true;
  });

  const productDemandRows = (() => {
    const demand = new Map();

    insightSales.forEach((sale) => {
      const items = Array.isArray(sale.items) ? sale.items : [];

      items.forEach((item) => {
        const name = String(item.name || "").trim();
        if (!name) return;

        const key = item.productId || name.toLowerCase();
        const qty = Math.max(0, wholeTaka(item.qty));
        const revenue = qty * wholeTaka(item.price);
        const current = demand.get(key) || {
          key,
          name,
          qty: 0,
          revenue: 0,
          orders: 0,
        };

        current.qty += qty;
        current.revenue += revenue;
        current.orders += 1;
        demand.set(key, current);
      });
    });

    return [...demand.values()].sort(
      (a, b) =>
        b.qty - a.qty ||
        b.revenue - a.revenue ||
        a.name.localeCompare(b.name),
    );
  })();

  const productDemandMaxQty = Math.max(
    1,
    ...productDemandRows.map((row) => row.qty),
  );

  const productDemandSummary = productDemandRows.reduce(
    (summary, row) => {
      summary.units += row.qty;
      summary.revenue += row.revenue;
      return summary;
    },
    {
      units: 0,
      revenue: 0,
    },
  );

  const customerInsightRows = (() => {
    const customers = new Map();

    insightSales.forEach((sale) => {
      const name = String(sale.customer || "").trim();
      const phone = String(sale.customerPhone || "").trim();
      const address = String(sale.customerAddress || "").trim();

      if (!name && !phone) return;

      const normalizedPhone = phone.replace(/\s+/g, "");
      const key = normalizedPhone
        ? `phone:${normalizedPhone}`
        : `name:${name.toLowerCase()}`;

      const items = Array.isArray(sale.items) ? sale.items : [];
      const itemQty = items.reduce(
        (sum, item) => sum + Math.max(0, wholeTaka(item.qty)),
        0,
      );

      const current = customers.get(key) || {
        key,
        name: name || phone,
        phone,
        address,
        orders: 0,
        qty: 0,
        total: 0,
      };

      current.name = name || current.name || phone;
      current.phone = phone || current.phone;
      current.address = address || current.address;
      current.orders += 1;
      current.qty += itemQty;
      current.total += Number(sale.total || 0);

      customers.set(key, current);
    });

    return [...customers.values()].sort(
      (a, b) =>
        b.total - a.total ||
        b.orders - a.orders ||
        a.name.localeCompare(b.name),
    );
  })();

  const customerInsightMaxTotal = Math.max(
    1,
    ...customerInsightRows.map((row) => row.total),
  );

  const customerInsightSummary = customerInsightRows.reduce(
    (summary, row) => {
      summary.orders += row.orders;
      summary.qty += row.qty;
      summary.total += row.total;
      return summary;
    },
    {
      orders: 0,
      qty: 0,
      total: 0,
    },
  );

  const selectedSaleProduct =
    saleProducts.find((product) => product.id === saleForm.productId) ||
    saleProducts[0];

  const saleQty = Math.max(0, wholeTaka(saleForm.qty));
  const salePrice = wholeTaka(
    saleForm.price || selectedSaleProduct?.sellPrice || 0,
  );
  const saleDraftTotal = saleQty * salePrice;
  const saleCartQty = saleItems.reduce(
    (sum, item) => sum + wholeTaka(item.qty),
    0,
  );
  const saleCartTotal = saleItems.reduce(
    (sum, item) => sum + wholeTaka(item.qty) * wholeTaka(item.price),
    0,
  );
  const isConditionDraft = saleForm.payment === "Courier Condition";
  const salePaid = paidAmount(saleCartTotal, saleForm.paid, saleForm.payment);

  function openNewProductModal() {
    setProductForm(emptyProductForm);
    setProductModalOpen(true);
  }

  function closeProductModal() {
    setProductModalOpen(false);
    setProductForm(emptyProductForm);
  }

  async function submitProduct(event) {
    event.preventDefault();

    const existingProduct = productForm.id
      ? products.find((item) => item.id === productForm.id)
      : null;

    const product = {
      id: productForm.id || uid("product"),
      name: productForm.name.trim(),
      kind: productForm.kind === "service" ? "service" : "product",
      category: productForm.category.trim(),
      buyPrice: productForm.kind === "service" ? 0 : wholeTaka(productForm.buyPrice),
      sellPrice: wholeTaka(productForm.sellPrice),
      stock: productForm.kind === "service" ? 0 : wholeTaka(productForm.stock),
      lowStock: productForm.kind === "service" ? 0 : wholeTaka(productForm.lowStock),
      active: productForm.active !== false,
      addedByStaffId: existingProduct
        ? existingProduct.addedByStaffId || ""
        : currentStaff?.id || "",
      addedByStaffName: existingProduct
        ? existingProduct.addedByStaffName || ""
        : currentStaff?.name || "",
    };

    if (!product.name || product.sellPrice <= 0 ||
        (product.kind === "product" && [product.buyPrice, product.stock, product.lowStock].some((value) => value < 0))) {
      showToast(bt("সঠিক নাম, মূল্য ও স্টক দিন", "Enter valid name, prices, and stock"));
      return;
    }

    const saved = await patchData((draft) => {
      const index = draft.products.findIndex((item) => item.id === product.id);
      const previousStock = index >= 0 ? wholeTaka(draft.products[index].stock) : 0;
      if (index >= 0) draft.products[index] = product;
      else draft.products.push(product);
      recordStockMovement(
        draft,
        product,
        product.stock - previousStock,
        index >= 0 ? "product_edit" : "opening_stock",
      );
    });

    if (saved) {
      setProductModalOpen(false);
      setProductForm(emptyProductForm);
      showToast(productForm.id ? "পণ্য আপডেট হয়েছে" : "পণ্য সেভ হয়েছে");
    }
  }

  function editProduct(product) {
    setProductForm({
      id: product.id,
      name: product.name,
      kind: product.kind || "product",
      category: product.category || "",
      buyPrice: product.buyPrice === "" ? "" : String(wholeTaka(product.buyPrice)),
      sellPrice: product.sellPrice === "" ? "" : String(wholeTaka(product.sellPrice)),
      stock: String(wholeTaka(product.stock)),
      lowStock: String(wholeTaka(product.lowStock)),
      active: product.active !== false,
    });

    setProductModalOpen(true);
  }

  function deleteProduct(productId) {
    const product = products.find((item) => item.id === productId);
    setProductDeleteConfirm({
      open: true,
      productId,
      productName: product?.name || bt("এই পণ্য", "this product"),
    });
  }

  function closeProductDeleteConfirm() {
    setProductDeleteConfirm({
      open: false,
      productId: "",
      productName: "",
    });
  }

  async function confirmDeleteProduct() {
    const productId = productDeleteConfirm.productId;
    if (!productId) return;

    const saved = await patchData((draft) => {
      const hasHistory = draft.sales.some((sale) => sale.items?.some((item) => item.productId === productId)) ||
        draft.purchases.some((purchase) => purchase.productId === productId);
      if (hasHistory) {
        draft.products = draft.products.map((product) => product.id === productId ? { ...product, active: false } : product);
      } else {
        draft.products = draft.products.filter((product) => product.id !== productId);
      }
    });

    if (saved) {
      closeProductDeleteConfirm();
      showToast(bt("পণ্য সরানো হয়েছে", "Product removed"));
    }
  }

  function adjustStock(productId, delta) {
    patchData((draft) => {
      const product = draft.products.find((item) => item.id === productId);
      if (!product) return;
      const previousStock = wholeTaka(product.stock);
      product.stock = Math.max(0, previousStock + delta);
      recordStockMovement(draft, product, product.stock - previousStock, "adjustment");
    });
  }

  async function submitPurchase(event) {
    event.preventDefault();
    if (purchaseSaving) return;
    const product = products.find((item) => item.id === purchaseForm.productId);
    const quantity = wholeTaka(purchaseForm.qty);
    const unitCost = wholeTaka(purchaseForm.unitCost);
    if (!product || product.kind === "service" || quantity <= 0 || unitCost <= 0 ||
        !Number.isFinite(Number(purchaseForm.qty)) || !Number.isFinite(Number(purchaseForm.unitCost))) {
      showToast(bt("পণ্য, পরিমাণ ও ক্রয় মূল্য ঠিক করুন", "Check the product, quantity, and buying price"));
      return;
    }
    const purchaseId = uid("purchase");
    setPurchaseSaving(true);
    const saved = await patchData((draft) => {
      const index = draft.products.findIndex((item) => item.id === product.id && item.kind !== "service");
      if (index < 0) return false;
      const current = draft.products[index];
      draft.products[index] = receivePurchase(current, quantity, unitCost);
      recordStockMovement(draft, current, quantity, "purchase");
      draft.purchases.push({
        id: purchaseId,
        date: new Date().toISOString(),
        productId: current.id,
        productName: current.name,
        supplier: purchaseForm.supplier.trim(),
        qty: quantity,
        unitCost,
        total: quantity * unitCost,
        note: purchaseForm.note.trim(),
        staffName: currentStaff?.name || "",
      });
    });
    setPurchaseSaving(false);
    if (saved) {
      setPurchaseForm({ productId: "", supplier: "", qty: "", unitCost: "", note: "" });
      showToast(bt("ক্রয় ও স্টক সেভ হয়েছে", "Purchase and stock saved"));
    }
  }

  function addSaleItem() {
    const product = selectedSaleProduct;
    const qty = Math.max(0, wholeTaka(saleForm.qty));
    const price = wholeTaka(
      saleForm.price || product?.sellPrice || 0,
    );

    if (!product) {
      showToast(
        bt(
          "বিক্রয়ের জন্য কোনো Active পণ্য নেই",
          "No active product is available for sale",
        ),
      );
      return;
    }

    if (qty <= 0 || price < 0) {
      showToast(
        bt(
          "পরিমাণ ও বিক্রয় মূল্য ঠিক করুন",
          "Please check quantity and sale price",
        ),
      );
      return;
    }

    const currentLine = saleItems.find(
      (item) => item.productId === product.id,
    );
    const nextQty = wholeTaka(currentLine?.qty) + qty;
    const availableStock = product.kind === "service" ? Infinity : wholeTaka(product.stock);

    if (nextQty > availableStock) {
      showToast(
        bt(
          `স্টকে ${availableStock}টি আছে`,
          `Only ${availableStock} in stock`,
        ),
      );
      return;
    }

    setSaleItems((current) => {
      const index = current.findIndex(
        (item) => item.productId === product.id,
      );

      const nextItem = {
        productId: product.id,
        name: product.name,
        kind: product.kind || "product",
        qty: nextQty,
        price,
        buyPrice: wholeTaka(product.buyPrice),
      };

      if (index < 0) {
        return [...current, nextItem];
      }

      return current.map((item, itemIndex) =>
        itemIndex === index ? nextItem : item,
      );
    });

    setSaleForm((current) => ({
      ...current,
      qty: "1",
      price: String(wholeTaka(product.sellPrice)),
    }));

    showToast(
      currentLine
        ? bt("পণ্যের পরিমাণ আপডেট হয়েছে", "Product quantity updated")
        : bt("পণ্য বিক্রয়ে যোগ হয়েছে", "Product added to sale"),
    );
  }

  function adjustSaleItemQty(productId, delta) {
    const line = saleItems.find(
      (item) => item.productId === productId,
    );
    if (!line) return;

    const product = products.find(
      (item) => item.id === productId,
    );
    const availableStock = product?.kind === "service" ? Infinity : wholeTaka(product?.stock);
    const nextQty = wholeTaka(line.qty) + delta;

    if (nextQty < 1) return;

    if (delta > 0 && nextQty > availableStock) {
      showToast(
        bt(
          `স্টকে ${availableStock}টি আছে`,
          `Only ${availableStock} in stock`,
        ),
      );
      return;
    }

    setSaleItems((current) =>
      current.map((item) =>
        item.productId === productId
          ? { ...item, qty: nextQty }
          : item,
      ),
    );
  }

  function removeSaleItem(productId) {
    setSaleItems((current) =>
      current.filter((item) => item.productId !== productId),
    );
  }

  function resetSaleDraft() {
    setSaleItems([]);
    setSaleForm({
      ...emptySaleForm,
      staffId: currentStaff?.id || "",
    });
  }

  async function submitSale(event) {
    event.preventDefault();
    if (saleSaving) return;

    const staffMember = currentStaff || activeStaff[0];
    const isCondition = saleForm.payment === "Courier Condition";

    if (isCondition && !saleForm.courierName.trim()) {
      showToast(
        bt(
          "কুরিয়ার কন্ডিশন বিক্রয়ের জন্য কুরিয়ার সার্ভিসের নাম দিন",
          "Enter the courier service for a Courier COD sale",
        ),
      );
      return;
    }

    if (!saleItems.length) {
      showToast(
        bt(
          "কমপক্ষে একটি পণ্য বিক্রয়ে যোগ করুন",
          "Add at least one product to the sale",
        ),
      );
      return;
    }

    const invalidLine = saleItems.find((line) => {
      const product = products.find(
        (item) => item.id === line.productId,
      );

      return (
        !product ||
        product.active === false ||
        wholeTaka(line.qty) <= 0 ||
        wholeTaka(line.price) < 0 ||
        (product.kind !== "service" && wholeTaka(product.stock) < wholeTaka(line.qty))
      );
    });

    if (invalidLine) {
      const product = products.find(
        (item) => item.id === invalidLine.productId,
      );

      showToast(
        product
          ? bt(
              `${product.name}-এর স্টক পর্যাপ্ত নেই`,
              `Not enough stock for ${product.name}`,
            )
          : bt(
              "একটি পণ্য আর পাওয়া যাচ্ছে না",
              "One product is no longer available",
            ),
      );
      return;
    }

    const items = saleItems.map((item) => ({
      productId: item.productId,
      name: item.name,
      kind: item.kind || "product",
      qty: wholeTaka(item.qty),
      price: wholeTaka(item.price),
      buyPrice: wholeTaka(item.buyPrice),
    }));

    const total = items.reduce(
      (sum, item) => sum + item.qty * item.price,
      0,
    );
    if (!isCondition && saleForm.paid !== "" &&
        (!Number.isFinite(Number(saleForm.paid)) || Number(saleForm.paid) < 0 || Number(saleForm.paid) > total)) {
      showToast(bt("পরিশোধের টাকা বিলের মধ্যে দিন", "Paid amount must be within the bill total"));
      return;
    }
    const paid = paidAmount(total, saleForm.paid, saleForm.payment);
    const saleId = uid("sale");

    setSaleSaving(true);
    const saved = await patchData((draft) => {
      if (items.some((item) => {
        const product = draft.products.find((entry) => entry.id === item.productId);
        return !product || product.active === false ||
          (product.kind !== "service" && wholeTaka(product.stock) < item.qty);
      })) return false;
      const committedItems = items.map((item) => ({
        ...item,
        buyPrice: wholeTaka(draft.products.find((product) => product.id === item.productId)?.buyPrice),
      }));
      const soldQtyByProduct = new Map(
        items.map((item) => [item.productId, item.qty]),
      );

      draft.products = draft.products.map((product) => {
        const soldQty = soldQtyByProduct.get(product.id);
        if (!soldQty || product.kind === "service") return product;

        recordStockMovement(draft, product, -soldQty, "sale", saleId);

        return {
          ...product,
          stock: Math.max(
            0,
            wholeTaka(product.stock) - soldQty,
          ),
        };
      });

      draft.sales.push({
        id: saleId,
        orderNo: `T${Date.now().toString().slice(-10)}`,
        date: new Date().toISOString(),
        customer: saleForm.customer.trim(),
        customerPhone: saleForm.customerPhone.trim(),
        customerAddress: saleForm.customerAddress.trim(),
        payment: saleForm.payment,
        condition: isCondition
          ? {
              status: "pending_dispatch",
              courierName: saleForm.courierName.trim(),
              trackingNo: saleForm.trackingNo.trim(),
              courierCharge: Math.max(
                0,
                wholeTaka(saleForm.courierCharge),
              ),
              createdAt: new Date().toISOString(),
              sentAt: "",
              deliveredAt: "",
              settledAt: "",
              returnedAt: "",
              stockRestored: false,
            }
          : null,
        staffId: staffMember?.id || "",
        staffName: staffMember?.name || "",
        items: committedItems,
        total,
        paid,
      });
    });

    setSaleSaving(false);
    if (saved) {
      resetSaleDraft();
      showToast(bt("বিক্রয় সেভ হয়েছে", "Sale saved successfully"));
    }
  }

  async function updateConditionStatus(saleId, nextStatus) {
    const sale = sales.find((item) => item.id === saleId);

    if (!sale || !isConditionSale(sale)) return;

    const currentStatus = getConditionStatus(sale);

    if (["settled", "returned"].includes(currentStatus)) {
      showToast(
        bt(
          "এই কন্ডিশন অর্ডারটি ইতোমধ্যে সম্পন্ন হয়েছে",
          "This Courier COD order is already closed",
        ),
      );
      return;
    }

    const now = new Date().toISOString();

    const saved = await patchData((draft) => {
      const conditionSale = draft.sales.find(
        (item) => item.id === saleId,
      );

      if (!conditionSale) return;

      const previousStatus = getConditionStatus(conditionSale);
      const currentCondition = conditionSale.condition || {};

      if (nextStatus === "returned") {
        if (!currentCondition.stockRestored) {
          const returnedQtyByProduct = new Map();

          (Array.isArray(conditionSale.items)
            ? conditionSale.items
            : []
          ).forEach((item) => {
            returnedQtyByProduct.set(
              item.productId,
              (returnedQtyByProduct.get(item.productId) || 0) +
                Math.max(0, wholeTaka(item.qty)),
            );
          });

          draft.products = draft.products.map((product) => {
            const returnedQty = returnedQtyByProduct.get(product.id);
            if (!returnedQty) return product;
            recordStockMovement(draft, product, returnedQty, "courier_return", saleId);

            return {
              ...product,
              stock: wholeTaka(product.stock) + returnedQty,
            };
          });
        }

        conditionSale.paid = 0;
        conditionSale.condition = {
          ...currentCondition,
          status: "returned",
          returnedAt: now,
          stockRestored: true,
        };
        return;
      }

      if (nextStatus === "sent") {
        conditionSale.condition = {
          ...currentCondition,
          status: "sent",
          sentAt: currentCondition.sentAt || now,
        };
        return;
      }

      if (nextStatus === "awaiting_payment") {
        conditionSale.condition = {
          ...currentCondition,
          status: "awaiting_payment",
          deliveredAt: currentCondition.deliveredAt || now,
        };
        return;
      }

      if (nextStatus === "settled") {
        if (previousStatus !== "awaiting_payment") return;

        conditionSale.paid = Number(conditionSale.total || 0);
        conditionSale.condition = {
          ...currentCondition,
          status: "settled",
          settledAt: now,
        };
      }
    });

    const messages = {
      sent: bt("অর্ডার কুরিয়ারে পাঠানো হয়েছে", "Marked as sent to courier"),
      awaiting_payment: bt(
        "ডেলিভারি সম্পন্ন, এখন টাকার অপেক্ষায়",
        "Delivered and awaiting courier payment",
      ),
      settled: bt(
        "কুরিয়ার থেকে টাকা পাওয়া গেছে",
        "Courier payment received",
      ),
      returned: bt(
        "অর্ডার ফেরত হয়েছে এবং স্টক ফিরিয়ে দেওয়া হয়েছে",
        "Order returned and stock restored",
      ),
    };

    if (saved) showToast(messages[nextStatus] || bt("স্ট্যাটাস আপডেট হয়েছে", "Status updated"));
  }

  async function submitStaff(event) {
    event.preventDefault();
    if (!staffForm.name.trim()) {
      showToast(t.enterStaff);
      return;
    }
    const saved = await patchData((draft) => {
      draft.staff.push({
        id: uid("staff"),
        name: staffForm.name.trim(),
        role: staffForm.role.trim() || "Cashier",
        active: true,
      });
    });
    if (saved) {
      setStaffForm({ name: "", role: "Cashier" });
      showToast(t.staffSaved);
    }
  }

  function removeStaff(staffId) {
    const member = staff.find((item) => item.id === staffId);

    setStaffDeleteConfirm({
      open: true,
      staffId,
      staffName: member?.name || bt("এই স্টাফ", "this staff member"),
      staffRole: member?.role || "Cashier",
    });
  }

  function closeStaffDeleteConfirm() {
    setStaffDeleteConfirm({
      open: false,
      staffId: "",
      staffName: "",
      staffRole: "",
    });
  }

  async function confirmDeleteStaff() {
    const staffId = staffDeleteConfirm.staffId;
    if (!staffId) return;

    const saved = await patchData((draft) => {
      draft.staff = draft.staff.map((member) =>
        member.id === staffId ? { ...member, active: false } : member,
      );
    });

    if (saved) {
      closeStaffDeleteConfirm();
      showToast(bt("স্টাফ সরানো হয়েছে", "Staff member removed"));
    }
  }

  async function submitExpense(event) {
    event.preventDefault();
    if (!expenseForm.type || wholeTaka(expenseForm.amount) <= 0) {
      showToast("খরচের ধরন ও টাকা দিন");
      return;
    }
    const saved = await patchData((draft) => {
      draft.expenses.push({
        id: uid("expense"),
        date: new Date().toISOString(),
        type: expenseForm.type.trim(),
        amount: wholeTaka(expenseForm.amount),
        note: expenseForm.note.trim(),
      });
    });
    if (saved) {
      setExpenseForm({ type: "", amount: "", note: "" });
      showToast("খরচ সেভ হয়েছে");
    }
  }

  function payDue(saleId) {
    const sale = sales.find((item) => item.id === saleId);
    if (!sale) return;
    setDueDialog({ saleId, amount: String(wholeTaka(sale.total - sale.paid)) });
  }

  async function submitDuePayment(event) {
    event.preventDefault();
    if (dueSaving) return;
    const saleId = dueDialog.saleId;
    const amount = wholeTaka(dueDialog.amount);
    const sale = sales.find((item) => item.id === saleId);
    const due = sale ? Math.max(0, wholeTaka(sale.total) - wholeTaka(sale.paid)) : 0;
    if (!sale || sale.returnedAt || amount <= 0 || amount > due) {
      showToast(bt("বাকির মধ্যে সঠিক টাকা দিন", "Enter an amount within the remaining due"));
      return;
    }
    setDueSaving(true);
    const saved = await patchData((draft) => {
      const dueSale = draft.sales.find((item) => item.id === saleId);
      if (!dueSale || dueSale.returnedAt) return false;
      const currentDue = Math.max(0, Number(dueSale.total || 0) - Number(dueSale.paid || 0));
      if (amount > currentDue) return false;
      const collected = amount;
      dueSale.paid = Number(dueSale.paid || 0) + collected;
      draft.duePayments.push({
        id: uid("due"),
        saleId,
        date: new Date().toISOString(),
        amount: collected,
        staffName: currentStaff?.name || "",
      });
    });
    setDueSaving(false);
    if (saved) {
      setDueDialog({ saleId: "", amount: "" });
      showToast(bt("বাকি পরিশোধ সেভ হয়েছে", "Due payment saved"));
    }
  }

  async function submitSaleReturn(event) {
    event.preventDefault();
    if (returnSaving) return;
    const reason = returnDialog.reason.trim();
    if (!reason) {
      showToast(bt("ফেরতের কারণ লিখুন", "Enter a reason for the return"));
      return;
    }
    const saleId = returnDialog.saleId;
    const details = {
      id: uid("return"),
      date: new Date().toISOString(),
      reason,
      staffName: currentStaff?.name || "",
    };
    setReturnSaving(true);
    const saved = await patchData((draft) => applyFullSaleReturn(
      draft,
      saleId,
      details,
      (product, quantity) => recordStockMovement(draft, product, quantity, "sale_return", saleId),
    ));
    setReturnSaving(false);
    if (saved) {
      setReturnDialog({ saleId: "", reason: "" });
      showToast(bt("ফেরত ও স্টক সেভ হয়েছে", "Return and stock saved"));
    }
  }

  async function downloadSaleInvoice(sale) {
    const total = Number(sale.total || 0);
    const paid = Math.min(Number(sale.paid || 0), total);
    const conditionSale = isConditionSale(sale);
    const returnedSale = Boolean(sale.returnedAt);
    const conditionStatus = getConditionStatus(sale);
    const conditionOutstanding =
      conditionSale &&
      !["settled", "returned"].includes(conditionStatus)
        ? total
        : 0;
    const due = conditionSale || returnedSale ? 0 : Math.max(0, total - paid);

    const invoiceNumber = sale.orderNo || sale.id || `INV-${Date.now()}`;
    const business = data.shop || {};
    const items = Array.isArray(sale.items) ? sale.items : [];

    const escapeHtml = (value) =>
      String(value ?? "").replace(/[&<>"']/g, (character) => {
        const entities = {
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#039;",
        };
        return entities[character];
      });

    const saleDate = sale.date
      ? new Date(sale.date).toLocaleString("en-GB", {
          timeZone: "Asia/Dhaka",
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "—";

    const itemRows = items.length
      ? items
          .map((item) => {
            const qty = Math.max(0, Number(item.qty ?? item.quantity ?? 0));
            const price = Number(item.price ?? item.salePrice ?? 0);
            const lineTotal = qty * price;

            return `
              <tr>
                <td style="
                  padding:16px 10px;
                  border-bottom:1px solid #e3e9ef;
                  color:#15263b;
                  font-size:15px;
                  font-weight:650;
                  word-break:break-word;
                ">
                  ${escapeHtml(item.name || "Product")}
                </td>

                <td style="
                  padding:16px 10px;
                  border-bottom:1px solid #e3e9ef;
                  color:#46576b;
                  font-size:14px;
                  text-align:right;
                  white-space:nowrap;
                ">
                  ${escapeHtml(money(price))}
                </td>

                <td style="
                  padding:16px 10px;
                  border-bottom:1px solid #e3e9ef;
                  color:#46576b;
                  font-size:14px;
                  text-align:center;
                  white-space:nowrap;
                ">
                  ${escapeHtml(qty)}
                </td>

                <td style="
                  padding:16px 10px;
                  border-bottom:1px solid #e3e9ef;
                  color:#082c52;
                  font-size:14px;
                  font-weight:800;
                  text-align:right;
                  white-space:nowrap;
                ">
                  ${escapeHtml(money(lineTotal))}
                </td>
              </tr>
            `;
          })
          .join("")
      : `
        <tr>
          <td
            colspan="4"
            style="
              padding:24px 10px;
              border-bottom:1px solid #e3e9ef;
              text-align:center;
              color:#64748b;
              font-size:13px;
            "
          >
            No item details available
          </td>
        </tr>
      `;

    const invoice = document.createElement("div");

    invoice.setAttribute("aria-hidden", "true");
    invoice.style.position = "fixed";
    invoice.style.left = "-10000px";
    invoice.style.top = "0";
    invoice.style.width = "820px";
    invoice.style.boxSizing = "border-box";
    invoice.style.background = "#ffffff";
    invoice.style.color = "#172033";
    invoice.style.overflow = "hidden";
    invoice.style.fontFamily =
      '"Segoe UI", "Noto Sans Bengali", "Nirmala UI", Arial, sans-serif';

    invoice.innerHTML = `
      <div
        style="
          width:820px;
          min-height:1090px;
          padding:46px 58px 40px;
          box-sizing:border-box;
          background:#ffffff;
        "
      >
        <!-- BUSINESS IDENTITY -->
        <div style="text-align:center;">
          <div
            style="
              margin-top:10px;
              color:#082c52;
              font-size:26px;
              line-height:1.15;
              font-weight:850;
            "
          >
            ${escapeHtml(business.name || "Shohoj ERP")}
          </div>

          <div
            style="
              margin-top:7px;
              color:#5f7083;
              font-size:14px;
              line-height:1.65;
            "
          >
            ${
              business.phone
                ? `<div>${escapeHtml(business.phone)}</div>`
                : ""
            }
            ${
              business.address
                ? `<div>${escapeHtml(business.address)}</div>`
                : ""
            }
          </div>
        </div>

        <div
          style="
            height:2px;
            margin-top:24px;
            border-radius:999px;
            background:#082c52;
          "
        ></div>

        <!-- INVOICE TITLE + META -->
        <div
          style="
            display:flex;
            justify-content:space-between;
            align-items:flex-end;
            gap:56px;
            margin-top:27px;
          "
        >
          <div>
            <div
              style="
                color:#082c52;
                font-size:46px;
                line-height:1;
                font-weight:900;
                letter-spacing:1.2px;
              "
            >
              INVOICE
            </div>
          </div>

          <div
            style="
              width:350px;
              display:grid;
              grid-template-columns:110px 1fr;
              justify-content:end;
              column-gap:18px;
              row-gap:10px;
              font-size:13px;
            "
          >
            <div style="color:#94a3b8;">Invoice no.</div>
            <div style="color:#172033;font-weight:800;text-align:right;">
              ${escapeHtml(invoiceNumber)}
            </div>

            <div style="color:#94a3b8;">Date</div>
            <div style="color:#172033;font-weight:700;text-align:right;">
              ${escapeHtml(saleDate)}
            </div>
          </div>
        </div>

        <!-- CUSTOMER + SALE DETAILS -->
        <div
          style="
            display:grid;
            grid-template-columns:minmax(0, 1fr) 350px;
            column-gap:70px;
            align-items:start;
            margin-top:34px;
          "
        >
          <div>
            <div
              style="
                color:#60748b;
                font-size:11px;
                font-weight:850;
                letter-spacing:1.7px;
                text-transform:uppercase;
              "
            >
              Customer
            </div>

            <div
              style="
                margin-top:9px;
                color:#082c52;
                font-size:22px;
                font-weight:850;
                line-height:1.2;
              "
            >
              ${escapeHtml(sale.customer || "Walk-in Customer")}
            </div>

            ${
              sale.customerPhone
                ? `
                  <div
                    style="
                      margin-top:7px;
                      color:#64748b;
                      font-size:14px;
                    "
                  >
                    ${escapeHtml(sale.customerPhone)}
                  </div>
                `
                : ""
            }

            ${
              sale.customerAddress
                ? `
                  <div
                    style="
                      margin-top:6px;
                      color:#64748b;
                      font-size:13px;
                      line-height:1.55;
                      max-width:300px;
                    "
                  >
                    ${escapeHtml(sale.customerAddress)}
                  </div>
                `
                : ""
            }
          </div>

          <div>
            <div
              style="
                color:#60748b;
                font-size:11px;
                font-weight:850;
                letter-spacing:1.7px;
                text-transform:uppercase;
              "
            >
              Sale Details
            </div>

            <div
              style="
                margin-top:9px;
                margin-left:auto;
                width:100%;
                display:grid;
                grid-template-columns:110px 1fr;
                column-gap:16px;
                row-gap:10px;
                font-size:14px;
              "
            >
              <div style="color:#94a3b8;">Staff</div>
              <div style="color:#172033;font-weight:750;">
                ${escapeHtml(sale.staffName || "—")}
              </div>

              <div style="color:#94a3b8;">Payment</div>
              <div style="color:#172033;font-weight:750;">
                ${escapeHtml(
                  conditionSale ? "Courier COD" : sale.payment || "Cash",
                )}
              </div>

              ${
                conditionSale
                  ? `
                    <div style="color:#94a3b8;">Courier</div>
                    <div style="color:#172033;font-weight:750;">
                      ${escapeHtml(
                        sale?.condition?.courierName || "—",
                      )}
                    </div>

                    ${
                      sale?.condition?.trackingNo
                        ? `
                          <div style="color:#94a3b8;">Tracking</div>
                          <div style="color:#172033;font-weight:750;">
                            ${escapeHtml(
                              sale.condition.trackingNo,
                            )}
                          </div>
                        `
                        : ""
                    }
                  `
                  : ""
              }

              <div style="color:#94a3b8;">Status</div>
              <div
                style="
                  color:${
                    returnedSale
                      ? "#b91c1c"
                      : conditionSale
                      ? conditionStatus === "settled"
                        ? "#15803d"
                        : conditionStatus === "returned"
                          ? "#b91c1c"
                          : "#b45309"
                      : due <= 0
                        ? "#15803d"
                        : "#b45309"
                  };
                  font-weight:850;
                "
              >
                ${
                  returnedSale
                    ? "Returned / Refunded"
                    : conditionSale
                    ? escapeHtml(
                        conditionStatusLabel(
                          conditionStatus,
                          "en",
                        ),
                      )
                    : due <= 0
                      ? "Paid"
                      : "Balance Due"
                }
              </div>
              ${returnedSale ? `<div style="color:#94a3b8;">Refunded</div><div style="color:#b91c1c;font-weight:800;">${escapeHtml(money(paid))}</div>` : ""}
            </div>
          </div>
        </div>

        <!-- ITEMS -->
        <table
          style="
            width:100%;
            table-layout:fixed;
            border-collapse:collapse;
            margin-top:38px;
          "
        >
          <colgroup>
            <col style="width:46%;" />
            <col style="width:19%;" />
            <col style="width:12%;" />
            <col style="width:23%;" />
          </colgroup>

          <thead>
            <tr style="background:#eef4f8;">
              <th style="
                padding:12px 10px;
                border-top:1px solid #d7e1e9;
                border-bottom:1px solid #d7e1e9;
                color:#2b465f;
                font-size:11px;
                font-weight:850;
                letter-spacing:.9px;
                text-align:left;
                text-transform:uppercase;
              ">
                Product
              </th>

              <th style="
                padding:12px 10px;
                border-top:1px solid #d7e1e9;
                border-bottom:1px solid #d7e1e9;
                color:#2b465f;
                font-size:11px;
                font-weight:850;
                letter-spacing:.9px;
                text-align:right;
                text-transform:uppercase;
              ">
                Price
              </th>

              <th style="
                padding:12px 10px;
                border-top:1px solid #d7e1e9;
                border-bottom:1px solid #d7e1e9;
                color:#2b465f;
                font-size:11px;
                font-weight:850;
                letter-spacing:.9px;
                text-align:center;
                text-transform:uppercase;
              ">
                Qty
              </th>

              <th style="
                padding:12px 10px;
                border-top:1px solid #d7e1e9;
                border-bottom:1px solid #d7e1e9;
                color:#2b465f;
                font-size:11px;
                font-weight:850;
                letter-spacing:.9px;
                text-align:right;
                text-transform:uppercase;
              ">
                Amount
              </th>
            </tr>
          </thead>

          <tbody>
            ${itemRows}
          </tbody>
        </table>

        <!-- TOTALS -->
        <div
          style="
            display:flex;
            justify-content:flex-end;
            margin-top:28px;
          "
        >
          <div
            style="
              width:350px;
              margin-left:auto;
            "
          >
            <div
              style="
                display:flex;
                justify-content:space-between;
                gap:22px;
                padding:10px 0;
                color:#64748b;
                font-size:14px;
              "
            >
              <span>Total Payable</span>
              <strong style="color:#172033;font-size:14px;">
                ${escapeHtml(money(total))}
              </strong>
            </div>

            <div
              style="
                display:flex;
                justify-content:space-between;
                gap:22px;
                padding:10px 0;
                color:#64748b;
                font-size:14px;
              "
            >
              <span>Amount Received</span>
              <strong style="color:#172033;font-size:14px;">
                ${escapeHtml(money(paid))}
              </strong>
            </div>

            <div
              style="
                display:flex;
                justify-content:space-between;
                align-items:center;
                gap:22px;
                margin-top:8px;
                padding:14px 16px;
                border-radius:8px;
                background:#082c52;
                color:#ffffff;
              "
            >
              <span style="font-size:15px;font-weight:850;">
                ${conditionSale ? "Condition Amount" : "Due"}
              </span>

              <strong style="font-size:17px;">
                ${escapeHtml(
                  money(
                    conditionSale
                      ? conditionOutstanding
                      : due,
                  ),
                )}
              </strong>
            </div>
          </div>
        </div>

        <!-- PAYMENT / NOTE -->
        <div
          style="
            margin-top:46px;
            color:#4d6074;
            font-size:13px;
            line-height:1.7;
          "
        >
          <div>
            <strong style="color:#172033;">Payment Method:</strong>
            ${escapeHtml(
              conditionSale ? "Courier COD" : sale.payment || "Cash",
            )}
          </div>

          ${
            conditionSale
              ? `
                <div style="margin-top:5px;">
                  <strong style="color:#172033;">Courier:</strong>
                  ${escapeHtml(
                    sale?.condition?.courierName || "—",
                  )}
                  ${
                    sale?.condition?.trackingNo
                      ? ` · ${escapeHtml(
                          sale.condition.trackingNo,
                        )}`
                      : ""
                  }
                </div>
              `
              : ""
          }

          ${
            sale.note
              ? `
                <div style="margin-top:5px;">
                  <strong style="color:#172033;">Note:</strong>
                  ${escapeHtml(sale.note)}
                </div>
              `
              : ""
          }
        </div>

        <!-- FOOTER -->
        <div
          style="
            margin-top:72px;
            padding-top:18px;
            border-top:1px solid #dbe3ea;
            text-align:center;
          "
        >
          <div
            style="
              color:#64748b;
              font-size:12px;
              line-height:1.7;
            "
          >
            Thank you for your business.
          </div>

          <div
            style="
              margin-top:5px;
              color:#082c52;
              font-size:13px;
              font-weight:800;
            "
          >
            ${escapeHtml(business.name || "Shohoj ERP")}
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(invoice);

    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);
      if (document.fonts?.ready) {
        await document.fonts.ready;
      }

      const invoiceImages = Array.from(invoice.querySelectorAll("img"));

      await Promise.all(
        invoiceImages.map(
          (image) =>
            new Promise((resolve) => {
              if (image.complete) {
                resolve();
                return;
              }

              image.onload = () => resolve();
              image.onerror = () => resolve();
            }),
        ),
      );

      const canvas = await html2canvas(invoice, {
        backgroundColor: "#ffffff",
        scale: 2,
        useCORS: true,
        logging: false,
        width: 820,
        windowWidth: 820,
        scrollX: 0,
        scrollY: 0,
      });

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      const margin = 8;
      const printableWidth = pageWidth - margin * 2;
      const printableHeight = pageHeight - margin * 2;

      const imageWidth = printableWidth;
      const imageHeight = (canvas.height * imageWidth) / canvas.width;
      const imageData = canvas.toDataURL("image/jpeg", 0.98);

      if (imageHeight <= printableHeight) {
        pdf.addImage(
          imageData,
          "JPEG",
          margin,
          margin,
          imageWidth,
          imageHeight,
          undefined,
          "FAST",
        );
      } else {
        let pageIndex = 0;
        let remainingHeight = imageHeight;

        while (remainingHeight > 0) {
          if (pageIndex > 0) {
            pdf.addPage();
          }

          const yPosition = margin - pageIndex * printableHeight;

          pdf.addImage(
            imageData,
            "JPEG",
            margin,
            yPosition,
            imageWidth,
            imageHeight,
            undefined,
            "FAST",
          );

          remainingHeight -= printableHeight;
          pageIndex += 1;
        }
      }

      const safeInvoiceNumber = String(invoiceNumber)
        .replace(/[^a-zA-Z0-9_-]/g, "-");

      pdf.save(`Invoice-${safeInvoiceNumber}.pdf`);

      showToast(
        bt(
          "ইনভয়েস PDF ডাউনলোড হয়েছে",
          "Invoice PDF downloaded",
        ),
      );
    } catch (error) {
      console.error("Invoice PDF error:", error);

      showToast(
        bt(
          "ইনভয়েস PDF তৈরি করা যায়নি",
          "Could not create invoice PDF",
        ),
      );
    } finally {
      invoice.remove();
    }
  }

  async function saveShop(event) {
    event.preventDefault();
    const saved = await patchData((draft) => {
      draft.shop = {
        name: shopForm.name.trim(),
        phone: shopForm.phone.trim(),
        address: shopForm.address.trim(),
      };
    });
    if (saved) showToast("দোকানের তথ্য সেভ হয়েছে");
  }

  function backupData() {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `shohoj-erp-backup-${todayKey()}.json`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function restoreData(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = "";
    if (file.size > 10 * 1024 * 1024) {
      showToast(bt("ব্যাকআপ ফাইল ১০ MB-এর বেশি", "Backup exceeds 10 MB"));
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const restored = normalizeData(parseBackup(reader.result));
        const confirmed = window.confirm(
          bt(
            `এই ব্যাকআপে ${restored.products.length}টি পণ্য এবং ${restored.sales.length}টি বিক্রয় আছে। বর্তমান ডেটা বদলে যাবে। আগে বর্তমান ডেটার ব্যাকআপ ডাউনলোড হবে। চালিয়ে যাবেন?`,
            `This backup has ${restored.products.length} products and ${restored.sales.length} sales. It will replace current data. A backup of current data will download first. Continue?`,
          ),
        );
        if (!confirmed) return;
        if (isFirebaseReady() && (!authUser || cloudStatus !== "firebase")) {
          throw new Error("Cloud unavailable");
        }
        backupData();
        if (isFirebaseReady()) {
          await replaceFirebaseData(authUser.uid, restored);
        } else {
          setData(restored);
        }
        showToast(bt("ব্যাকআপ ইমপোর্ট হয়েছে", "Backup imported"));
      } catch {
        showToast(bt("ইমপোর্ট হয়নি; ফাইল বা সংযোগ যাচাই করুন", "Import failed; check file or connection"));
      }
    };
    reader.readAsText(file);
  }

  async function submitAuth(event) {
    event.preventDefault();
    if (authRegister && authPassword !== authConfirmPassword) {
      setAuthError(bt("পাসওয়ার্ড দুটি এক নয়", "The passwords do not match"));
      return;
    }
    setAuthBusy(true);
    setAuthError("");
    setAuthNotice("");
    try {
      if (authRegister) await register(authEmail.trim(), authPassword);
      else await signIn(authEmail.trim(), authPassword);
      setAuthPassword("");
      setAuthConfirmPassword("");
    } catch (error) {
      const code = String(error?.code || "");
      setAuthError(
        code.includes("email-already-in-use")
          ? bt("এই ইমেইলে অ্যাকাউন্ট আছে", "This email already has an account")
          : code.includes("weak-password")
            ? bt("অন্তত ৮ অক্ষরের পাসওয়ার্ড দিন", "Use at least 8 password characters")
            : bt("ইমেইল, পাসওয়ার্ড বা Firebase সেটআপ যাচাই করুন", "Check email, password, or Firebase setup"),
      );
    } finally {
      setAuthBusy(false);
    }
  }

  function submitDemoAuth(event) {
    event.preventDefault();
    const username = authEmail.trim().toLowerCase();
    if ((username !== "admin" && username !== "admin@demo.local") || authPassword !== "123456") {
      setAuthError(bt("ডেমো ইউজারনেম বা পাসওয়ার্ড ভুল", "Incorrect demo username or password"));
      return;
    }
    setAuthError("");
    setAuthPassword("");
    setLocalDemoEntered(true);
  }

  async function sendResetLink() {
    if (!authEmail.trim()) {
      setAuthError(bt("আগে ইমেইল লিখুন", "Enter your email first"));
      return;
    }
    setAuthBusy(true);
    setAuthError("");
    setAuthNotice("");
    try {
      await resetPassword(authEmail.trim());
      setAuthNotice(bt("অ্যাকাউন্ট থাকলে ইমেইলে পাসওয়ার্ড পরিবর্তনের লিংক পাঠানো হয়েছে।", "If this account exists, a password reset link has been emailed."));
    } catch {
      setAuthError(bt("পাসওয়ার্ডের লিংক পাঠানো যায়নি; ইমেইল ও Firebase সেটআপ দেখুন।", "Could not send a reset link; check the email and Firebase setup."));
    } finally {
      setAuthBusy(false);
    }
  }

  if ((!isFirebaseReady() && !localDemoEntered) || (isFirebaseReady() && (!authReady || !authUser))) {
    const cloudLogin = isFirebaseReady();
    return (
      <main className="erp-auth-screen">
        <div className="erp-auth-layout">
          <aside className="erp-auth-brand">
            <div className="erp-auth-brand-top">
              <span className="erp-auth-logo" aria-hidden="true">S</span>
              <span><strong>{bt("সহজ ERP", "Shohoj ERP")}</strong><small>{bt("সহজ ব্যবসা ব্যবস্থাপনা", "Simple business management")}</small></span>
            </div>
            <div className="erp-auth-brand-copy">
              <span className="erp-auth-eyebrow">{bt("আপনার ব্যবসা, এক জায়গায়", "Your business, in one place")}</span>
              <h2>{bt("প্রতিদিনের কাজ আরও সহজ করুন।", "Make every workday simpler.")}</h2>
              <p>{bt("বিক্রয়, বাকি, স্টক ও রিপোর্ট—প্রয়োজনীয় সব হিসাব গুছিয়ে রাখুন।", "Keep sales, dues, stock and reports organized in one clear workspace.")}</p>
            </div>
            <span className="erp-auth-brand-foot">{bt("দ্রুত • পরিষ্কার • ব্যবহার সহজ", "Fast • Clear • Easy to use")}</span>
          </aside>

          <section className="erp-auth-panel">
            <div className="erp-auth-toolbar">
              <button type="button" onClick={() => setLang(lang === "bn" ? "en" : "bn")}>{lang === "bn" ? "English" : "বাংলা"}</button>
            </div>
            <div className="erp-auth-card">
              <span className="erp-auth-kicker">{cloudLogin ? bt("নিরাপদ অ্যাকাউন্ট", "Secure account") : bt("লোকাল ডেমো", "Local demo")}</span>
              <h1>{cloudLogin && !authReady ? bt("অপেক্ষা করুন", "Please wait") : cloudLogin && authRegister ? bt("অ্যাকাউন্ট তৈরি করুন", "Create your account") : bt("লগইন", "Sign in")}</h1>
              <p className="erp-auth-intro">{cloudLogin ? bt("আপনার প্রতিষ্ঠানের কাজ শুরু করতে লগইন করুন।", "Sign in to continue to your business workspace.") : bt("নির্দিষ্ট ডেমো তথ্য দিয়ে প্রবেশ করুন। এখানে করা কাজ শুধু এই ব্রাউজারেই থাকবে।", "Use the fixed demo credentials. Your work here stays in this browser.")}</p>

              {cloudLogin && authReady && (
                <>
                  <form onSubmit={submitAuth}>
                    <label>{bt("ইমেইল", "Email address")}
                      <input type="email" autoComplete="email" placeholder="name@example.com" required value={authEmail} onChange={(event) => setAuthEmail(event.target.value)} />
                    </label>
                    <label>{bt("পাসওয়ার্ড", "Password")}
                      <span className="erp-auth-password-field">
                        <input type={showAuthPassword ? "text" : "password"} autoComplete={authRegister ? "new-password" : "current-password"} minLength={authRegister ? 8 : 6} placeholder={bt("পাসওয়ার্ড লিখুন", "Enter your password")} required value={authPassword} onChange={(event) => setAuthPassword(event.target.value)} />
                        <button type="button" aria-label={showAuthPassword ? bt("পাসওয়ার্ড লুকান", "Hide password") : bt("পাসওয়ার্ড দেখান", "Show password")} onClick={() => setShowAuthPassword((shown) => !shown)}>{showAuthPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
                      </span>
                    </label>
                    {authRegister && <label>{bt("পাসওয়ার্ড নিশ্চিত করুন", "Confirm password")}
                      <input type={showAuthPassword ? "text" : "password"} autoComplete="new-password" minLength={8} required value={authConfirmPassword} onChange={(event) => setAuthConfirmPassword(event.target.value)} />
                    </label>}
                    {!authRegister && <button className="erp-auth-forgot" type="button" disabled={authBusy} onClick={sendResetLink}>{bt("পাসওয়ার্ড ভুলে গেছেন?", "Forgot password?")}</button>}
                    {authError && <p className="erp-auth-error" role="alert">{authError}</p>}
                    {authNotice && <p className="erp-auth-notice" role="status">{authNotice}</p>}
                    <button className="primary-button erp-auth-submit" disabled={authBusy} type="submit">{authBusy ? bt("অপেক্ষা করুন…", "Please wait…") : authRegister ? bt("অ্যাকাউন্ট তৈরি করুন", "Create account") : bt("লগইন করুন", "Sign in")}</button>
                  </form>
                  <p className="erp-auth-alt">{authRegister ? bt("আগেই অ্যাকাউন্ট আছে?", "Already have an account?") : bt("নতুন ব্যবহারকারী?", "New here?")} <button type="button" onClick={() => { setAuthRegister(!authRegister); setAuthError(""); setAuthNotice(""); }}>{authRegister ? bt("লগইন করুন", "Sign in") : bt("অ্যাকাউন্ট তৈরি করুন", "Create account")}</button></p>
                  <p className="erp-auth-alt">{bt("নির্দিষ্ট ডেমো লগইন ব্যবহার করবেন?", "Want to use the fixed demo login?")} <a href="?demo=1">{bt("ডেমো খুলুন", "Open demo")}</a></p>
                </>
              )}

              {!cloudLogin && (
                <form className="erp-auth-demo" onSubmit={submitDemoAuth}>
                  <label>{bt("ডেমো ইউজারনেম বা ইমেইল", "Demo username or email")}
                    <input type="text" autoComplete="username" placeholder="Admin" required value={authEmail} onChange={(event) => setAuthEmail(event.target.value)} />
                  </label>
                  <label>{bt("পাসওয়ার্ড", "Password")}
                    <span className="erp-auth-password-field">
                      <input type={showAuthPassword ? "text" : "password"} autoComplete="current-password" placeholder={bt("পাসওয়ার্ড লিখুন", "Enter your password")} required value={authPassword} onChange={(event) => setAuthPassword(event.target.value)} />
                      <button type="button" aria-label={showAuthPassword ? bt("পাসওয়ার্ড লুকান", "Hide password") : bt("পাসওয়ার্ড দেখান", "Show password")} onClick={() => setShowAuthPassword((shown) => !shown)}>{showAuthPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
                    </span>
                  </label>
                  <div className="erp-auth-demo-note"><strong>{bt("ডেমো মোড", "Demo mode")}</strong><span>{bt("ডেমোর তথ্য শুধু এই ব্রাউজারে থাকবে; এটি অনলাইন ব্যক্তিগত অ্যাকাউন্ট নয়।", "Demo data stays in this browser; this is not a private online account.")}</span></div>
                  {authError && <p className="erp-auth-error" role="alert">{authError}</p>}
                  <button className="primary-button erp-auth-submit" type="submit">{bt("ডেমোতে প্রবেশ করুন", "Enter demo")}</button>
                  {window.location.search.includes("demo=1") && <p className="erp-auth-alt"><a href={window.location.pathname}>{bt("অনলাইন লগইনে ফিরুন", "Back to online sign in")}</a></p>}
                </form>
              )}
            </div>
            <p className="erp-auth-panel-foot">© {new Date().getFullYear()} {bt("সহজ ERP", "Shohoj ERP")}</p>
          </section>
        </div>
      </main>
    );
  }

  if (isFirebaseReady() && cloudStatus !== "firebase") {
    return (
      <main className="erp-auth-screen">
        <section className="erp-auth-card">
          <span className="erp-auth-kicker">{bt("সহজ ERP", "Shohoj ERP")}</span>
          <h1>{cloudStatus === "error" ? bt("সংযোগ পাওয়া যাচ্ছে না", "Connection unavailable") : bt("ডেটা লোড হচ্ছে", "Loading data")}</h1>
          <p>{bt("ডেটা সংযোগ ঠিক না হওয়া পর্যন্ত পরিবর্তন বন্ধ রাখা হয়েছে।", "Changes are paused until data connection is ready.")}</p>
          {cloudStatus === "error" && <button className="primary-button" type="button" onClick={() => { setCloudStatus("connecting"); setSyncRetry((count) => count + 1); }}>{bt("আবার চেষ্টা করুন", "Retry")}</button>}
          <button className="erp-auth-switch" type="button" onClick={() => signOutUser()}>{bt("লগআউট", "Sign out")}</button>
        </section>
      </main>
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark brand-mark-logo" aria-hidden="true">
            <svg viewBox="0 0 64 64" role="img" focusable="false">
              <defs>
                <linearGradient id="mollickBrandGradient" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#0a2f56" />
                  <stop offset="100%" stopColor="#1c6ea4" />
                </linearGradient>
              </defs>
              <rect x="2" y="2" width="60" height="60" rx="14" fill="url(#mollickBrandGradient)" />
              <text x="32" y="44" textAnchor="middle" fontSize="38" fontWeight="800" fill="#ffffff">S</text>
              <rect x="18" y="49" width="28" height="4" rx="2" fill="#f4c342" />
            </svg>
          </span>
          <div className="brand-copy">
            <strong>{lang === "bn" ? "সহজ ERP" : "Shohoj ERP"}</strong>
            <small className="brand-edition">{bt("সহজ ব্যবসা ব্যবস্থাপনা", "Simple business management")}</small>
            
          </div>
        </div>

        <nav className="nav-tabs" aria-label="প্রধান মেনু">
          {tabs.filter((tab) => primaryTabs.has(tab.id) || showMoreNav || activeTab === tab.id).map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                className={`nav-tab ${activeTab === tab.id ? "is-active" : ""}`}
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                type="button"
              >
                <Icon size={19} />
                {t[tab.id] || tab.label}
              </button>
            );
          })}
          <button className="nav-tab nav-more" aria-expanded={showMoreNav} onClick={() => setShowMoreNav((open) => !open)} type="button">
            {showMoreNav ? <ChevronUp size={19} /> : <ChevronDown size={19} />}
            {showMoreNav ? bt("কম দেখুন", "Show less") : bt("আরও মেনু", "More menus")}
          </button>
        </nav>


      </aside>

      <main className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">{t.console}</p>
            <h1>{activeTab === "stock" ? t.stockTitle : activeTab === "staff" ? t.staffTitle : lang === "en" ? t[activeTab] : titles[activeTab]}</h1>
          </div>
          <div className="top-actions">
            <span className="sync-status" role="status">{cloudLabel(cloudStatus, lang)}</span>
            {isFirebaseReady() && <button className="ghost-button" type="button" onClick={() => signOutUser()}>{bt("লগআউট", "Sign out")}</button>}
            {!isFirebaseReady() && <button className="ghost-button" type="button" onClick={() => setLocalDemoEntered(false)}>{bt("ডেমো থেকে বের হন", "Exit demo")}</button>}
            <button className="language-toggle" onClick={() => setLang(lang === "bn" ? "en" : "bn")} type="button">
              {t.languageButton}
            </button>
            <button className="ghost-button" onClick={backupData} type="button">
              <Download size={18} />
              {bt("ব্যাকআপ", "Backup")}
            </button>
            <label className="file-button">
              <FileUp size={18} />
              {bt("ইমপোর্ট", "Import")}
              <input accept="application/json" onChange={restoreData} type="file" />
            </label>
          </div>
        </header>

        {activeTab === "dashboard" && (
          <section className="view">
            <MetricGrid metrics={metrics} lang={lang} />

            {!products.length && (
              <section className="panel setup-panel">
                <h2>{bt("শুরু করুন", "Get started")}</h2>
                <p>{bt("প্রথমে প্রতিষ্ঠানের তথ্য দিন, তারপর পণ্য বা সেবা যোগ করুন।", "Add your business details, then add a product or service.")}</p>
                <div className="setup-actions">
                  <button className="ghost-button" type="button" onClick={() => setActiveTab("settings")}>{bt("প্রতিষ্ঠানের তথ্য", "Business details")}</button>
                  <button className="primary-button" type="button" onClick={() => { setActiveTab("products"); window.setTimeout(openNewProductModal, 0); }}>{bt("পণ্য/সেবা যোগ", "Add product/service")}</button>
                </div>
              </section>
            )}

            <section className="panel current-staff-panel">
              <div className="current-staff-copy">
                <span className="current-staff-kicker">
                  {bt("বর্তমান স্টাফ", "Current Staff")}
                </span>
                <strong>
                  {currentStaff?.name ||
                    bt("স্টাফ ছাড়াই শুরু করা যাবে", "You can start without staff")}
                </strong>
                <small>
                  {currentStaff
                    ? bt("এখনকার বিক্রয় ও নতুন পণ্য এই স্টাফের নামে রেকর্ড হবে।", "Sales and new products will be recorded under this staff.")
                    : bt("স্টাফ যোগ করা ঐচ্ছিক। যোগ করলে বিক্রির সঙ্গে তার নাম থাকবে।", "Staff is optional. Add someone to record their name on sales.")}
                </small>
              </div>

              {activeStaff.length ? <label className="current-staff-selector">
                <span>{bt("স্টাফ নির্বাচন", "Select staff")}</span>
                <select
                  disabled={!activeStaff.length}
                  onChange={(event) => {
                    setCurrentStaffId(event.target.value);
                    setSaleForm((current) => ({
                      ...current,
                      staffId: event.target.value,
                    }));
                  }}
                  value={currentStaff?.id || ""}
                >
                  {activeStaff.length ? (
                    activeStaff.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.name}
                        {member.role ? " · " + member.role : ""}
                      </option>
                    ))
                  ) : (
                    <option value="">
                      {bt("Active স্টাফ নেই", "No active staff")}
                    </option>
                  )}
                </select>
              </label> : <button className="ghost-button" type="button" onClick={() => { setShowMoreNav(true); setActiveTab("staff"); }}>{bt("স্টাফ যোগ করুন", "Add staff")}</button>}
            </section>

            <div className="dashboard-grid">
              <section className="panel">
                <div className="panel-head">
                  <h2>{bt("দ্রুত বিক্রয়", "Quick sale")}</h2>
                  <button className="primary-button" onClick={() => {
                    if (saleProducts.length) { resetSaleDraft(); setActiveTab("sale"); }
                    else { setActiveTab("products"); window.setTimeout(openNewProductModal, 0); }
                  }} type="button">
                    <Plus size={18} />
                    {saleProducts.length ? bt("নতুন বিক্রয়", "New sale") : bt("পণ্য/সেবা যোগ", "Add product/service")}
                  </button>
                </div>
                <div className="quick-products">
                  {!saleProducts.length && <p className="quick-empty">{bt("পণ্য বা সেবা যোগ করলে এখান থেকে এক ক্লিকে বিক্রয় শুরু করতে পারবেন।", "Add a product or service to start a sale here in one click.")}</p>}
                  {saleProducts.slice(0, 8).map((product) => (
                    <button
                      className="quick-card"
                      key={product.id}
                      onClick={() => {
                        setSaleItems([]);
                        setSaleForm({
                          ...emptySaleForm,
                          productId: product.id,
                          staffId: currentStaff?.id || "",
                          price: String(product.sellPrice),
                        });
                        setActiveTab("sale");
                      }}
                      type="button"
                    >
                      <strong>{product.name}</strong>
                      <span>{money(product.sellPrice)} · {product.kind === "service" ? bt("সেবা", "Service") : `${bt("স্টক", "Stock")} ${product.stock}`}</span>
                    </button>
                  ))}
                </div>
              </section>

              <section className="panel warning-panel">
                <div className="panel-head">
                <h2>{bt("স্টক সতর্কতা", "Low stock watch")}</h2>
                  <button className="ghost-button" onClick={() => setActiveTab("products")} type="button">
                    {bt("স্টক যোগ", "Add stock")}
                  </button>
                </div>
                <div className="list-stack">
                  {lowStock.length ? (
                    lowStock.map((product) => (
                      <div className="list-item" key={product.id}>
                        <div>
                          <strong>{product.name}</strong>
                          <span>স্টক {product.stock}, সীমা {product.lowStock}</span>
                        </div>
                        <button className="small-button" onClick={() => editProduct(product)} type="button">
                          এডিট
                        </button>
                      </div>
                    ))
                  ) : (
                    <p className="empty-state">{bt("সব পণ্যের স্টক ঠিক আছে।", "Stock levels look good.")}</p>
                  )}
                </div>
              </section>
            </div>

            <SalesTable title={bt("সর্বশেষ বিক্রয়", "Recent orders")} sales={recentSales} lang={lang} onInvoice={downloadSaleInvoice} />
          </section>
        )}

        {activeTab === "sale" && (
          <section className="view split-layout multi-sale-layout">
            <section className="panel multi-sale-panel">
              <div className="panel-head">
                <div>
                  <h2>{bt("বিক্রয় যোগ করুন", "Add sale")}</h2>
                  <p className="multi-sale-subtitle">
                    {bt(
                      "একই বিলে একাধিক পণ্য যোগ করে একসাথে বিক্রয় সেভ করুন।",
                      "Add multiple products to one bill and save them together.",
                    )}
                  </p>
                </div>
              </div>

              <form className="form-grid multi-sale-form" onSubmit={submitSale}>
                <label>
                  {bt("পণ্য", "Product")}
                  <select
                    required
                    value={saleForm.productId || saleProducts[0]?.id || ""}
                    onChange={(event) => {
                      const product = saleProducts.find(
                        (item) => item.id === event.target.value,
                      );

                      setSaleForm((current) => ({
                        ...current,
                        productId: event.target.value,
                        price: product
                          ? String(wholeTaka(product.sellPrice))
                          : "",
                      }));
                    }}
                  >
                    {saleProducts.length ? (
                      saleProducts.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.name} · {product.kind === "service" ? bt("সেবা", "Service") : `${bt("স্টক", "Stock")} ${product.stock}`}
                        </option>
                      ))
                    ) : (
                      <option value="">
                        {bt("কোনো Active পণ্য নেই", "No active products")}
                      </option>
                    )}
                  </select>
                </label>

                <label>
                  {t.assignedStaff}
                  <div
                    className="sale-fixed-staff"
                    title={bt(
                      "স্টাফ পরিবর্তন করতে Dashboard থেকে Current Staff পরিবর্তন করুন",
                      "Change Current Staff from the Dashboard",
                    )}
                  >
                    <div className="sale-fixed-staff__identity">
                      <span className="sale-fixed-staff__avatar">
                        {(currentStaff?.name || activeStaff[0]?.name || "?")
                          .trim()
                          .charAt(0)
                          .toUpperCase()}
                      </span>

                      <span className="sale-fixed-staff__copy">
                        <strong>
                          {currentStaff?.name ||
                            activeStaff[0]?.name ||
                            bt("Active স্টাফ নেই", "No active staff")}
                        </strong>

                        {(currentStaff?.role || activeStaff[0]?.role) && (
                          <small>
                            {currentStaff?.role || activeStaff[0]?.role}
                          </small>
                        )}
                      </span>
                    </div>

                    <span className="sale-fixed-staff__lock">
                      {bt("ফিক্সড", "Fixed")}
                    </span>
                  </div>
                </label>

                <label>
                  {bt("পরিমাণ", "Quantity")}
                  <input
                    min="1"
                    onChange={(event) =>
                      setSaleForm({
                        ...saleForm,
                        qty: event.target.value,
                      })
                    }
                    required
                    step="1"
                    type="number"
                    value={saleForm.qty}
                  />
                </label>

                <label>
                  {bt("বিক্রয় মূল্য", "Sale price")}
                  <input
                    min="0"
                    onChange={(event) =>
                      setSaleForm({
                        ...saleForm,
                        price: event.target.value,
                      })
                    }
                    required
                    step="1"
                    type="number"
                    value={
                      saleForm.price ||
                      (selectedSaleProduct
                        ? String(
                            wholeTaka(selectedSaleProduct.sellPrice),
                          )
                        : "")
                    }
                  />
                </label>

                <div className="sale-add-item-action form-span-2">
                  <button
                    className="sale-add-item-button"
                    disabled={!selectedSaleProduct}
                    onClick={addSaleItem}
                    type="button"
                  >
                    <Plus size={18} />
                    {bt("বিক্রয়ে পণ্য যোগ করুন", "Add product to sale")}
                  </button>

                  <span>
                    {bt("এই লাইনের মোট", "Selected line total")}:{" "}
                    <strong>{money(saleDraftTotal)}</strong>
                  </span>
                </div>

                <section className="sale-cart-section form-span-2">
                  <div className="sale-cart-head">
                    <div>
                      <span className="sale-cart-kicker">
                        {bt("বিক্রয়ের পণ্য", "Sale items")}
                      </span>
                      <strong>
                        {saleItems.length.toLocaleString(
                          lang === "bn" ? "bn-BD" : "en-GB",
                        )}{" "}
                        {bt("টি পণ্য", "products")}
                      </strong>
                    </div>

                    {saleItems.length > 0 && (
                      <span className="sale-cart-total-pill">
                        {money(saleCartTotal)}
                      </span>
                    )}
                  </div>

                  {saleItems.length ? (
                    <div className="sale-cart-list">
                      {saleItems.map((item) => (
                        <article
                          className="sale-cart-item"
                          key={item.productId}
                        >
                          <div className="sale-cart-item__product">
                            <strong>{item.name}</strong>
                            <span>
                              {money(item.price)} × {item.qty}
                            </span>
                          </div>

                          <div
                            className="sale-cart-item__controls"
                            aria-label={bt(
                              `${item.name} পরিমাণ`,
                              `${item.name} quantity`,
                            )}
                          >
                            <button
                              aria-label={bt(
                                "পরিমাণ কমান",
                                "Decrease quantity",
                              )}
                              className="sale-cart-step"
                              onClick={() =>
                                adjustSaleItemQty(item.productId, -1)
                              }
                              type="button"
                            >
                              <ChevronDown size={17} />
                            </button>

                            <b>{item.qty}</b>

                            <button
                              aria-label={bt(
                                "পরিমাণ বাড়ান",
                                "Increase quantity",
                              )}
                              className="sale-cart-step"
                              onClick={() =>
                                adjustSaleItemQty(item.productId, 1)
                              }
                              type="button"
                            >
                              <ChevronUp size={17} />
                            </button>
                          </div>

                          <strong className="sale-cart-item__total">
                            {money(
                              wholeTaka(item.qty) *
                                wholeTaka(item.price),
                            )}
                          </strong>

                          <button
                            aria-label={bt(
                              `${item.name} সরান`,
                              `Remove ${item.name}`,
                            )}
                            className="sale-cart-remove"
                            onClick={() =>
                              removeSaleItem(item.productId)
                            }
                            title={bt("পণ্য সরান", "Remove product")}
                            type="button"
                          >
                            <Trash2 size={17} />
                          </button>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <div className="sale-cart-empty">
                      <span className="sale-cart-empty__icon">
                        <ShoppingCart size={21} />
                      </span>
                      <div>
                        <strong>
                          {bt(
                            "এখনও কোনো পণ্য যোগ করা হয়নি",
                            "No products added yet",
                          )}
                        </strong>
                        <span>
                          {bt(
                            "উপরে পণ্য, পরিমাণ ও মূল্য ঠিক করে “বিক্রয়ে পণ্য যোগ করুন” চাপুন।",
                            "Choose a product, quantity and price above, then add it to the sale.",
                          )}
                        </span>
                      </div>
                    </div>
                  )}
                </section>

                <label>
                  {bt("কাস্টমার নাম", "Customer name")}
                  <input
                    autoComplete="name"
                    onChange={(event) =>
                      setSaleForm({
                        ...saleForm,
                        customer: event.target.value,
                      })
                    }
                    placeholder={bt(
                      "কাস্টমারের নাম লিখুন",
                      "Enter customer name",
                    )}
                    value={saleForm.customer}
                  />
                </label>

                <label>
                  {bt("কাস্টমার নাম্বার", "Customer phone")}
                  <input
                    autoComplete="tel"
                    inputMode="tel"
                    onChange={(event) =>
                      setSaleForm({
                        ...saleForm,
                        customerPhone: event.target.value,
                      })
                    }
                    placeholder={bt(
                      "মোবাইল / ফোন নাম্বার",
                      "Mobile / phone number",
                    )}
                    type="tel"
                    value={saleForm.customerPhone}
                  />
                </label>

                <label className="form-span-2">
                  {bt("কাস্টমার ঠিকানা", "Customer address")}
                  <input
                    autoComplete="street-address"
                    onChange={(event) =>
                      setSaleForm({
                        ...saleForm,
                        customerAddress: event.target.value,
                      })
                    }
                    placeholder={bt(
                      "কাস্টমারের ঠিকানা লিখুন",
                      "Enter customer address",
                    )}
                    value={saleForm.customerAddress}
                  />
                </label>

                <label>
                  {bt("পরিশোধ", "Paid")}
                  <input
                    disabled={isConditionDraft}
                    min="0"
                    onChange={(event) =>
                      setSaleForm({
                        ...saleForm,
                        paid: event.target.value,
                      })
                    }
                    placeholder={
                      isConditionDraft
                        ? bt(
                            "কুরিয়ার টাকা সংগ্রহ করবে",
                            "Courier will collect payment",
                          )
                        : saleForm.payment === "Due" ? "0" : String(saleCartTotal || 0)
                    }
                    step="1"
                    type="number"
                    value={isConditionDraft ? "" : saleForm.paid}
                  />
                </label>

                <label>
                  {bt("পেমেন্ট", "Payment")}
                  <select
                    value={saleForm.payment}
                    onChange={(event) => {
                      const payment = event.target.value;

                      setSaleForm({
                        ...saleForm,
                        payment,
                        paid:
                          payment === "Courier Condition" || payment === "Due"
                            ? ""
                            : saleForm.paid,
                      });
                    }}
                  >
                    <option>Cash</option>
                    <option>bKash</option>
                    <option>Nagad</option>
                    <option>Card</option>
                    <option>Due</option>
                    <option value="Courier Condition">
                      {bt("কুরিয়ার কন্ডিশন", "Courier COD")}
                    </option>
                  </select>
                </label>

                {isConditionDraft && (
                  <section className="condition-sale-fields form-span-2">
                    <div className="condition-sale-fields__head">
                      <Truck size={18} />
                      <div>
                        <strong>
                          {bt(
                            "কুরিয়ার কন্ডিশন তথ্য",
                            "Courier COD details",
                          )}
                        </strong>
                        <span>
                          {bt(
                            "কুরিয়ার থেকে টাকা পাওয়ার আগ পর্যন্ত এটি বিক্রয় আয় হিসেবে গণনা হবে না।",
                            "Revenue is recognised after courier payment is received.",
                          )}
                        </span>
                      </div>
                    </div>

                    <div className="condition-sale-fields__grid">
                      <label>
                        {bt("কুরিয়ার সার্ভিস", "Courier service")}
                        <input
                          onChange={(event) =>
                            setSaleForm({
                              ...saleForm,
                              courierName: event.target.value,
                            })
                          }
                          placeholder={bt(
                            "যেমন: Steadfast / Pathao / RedX",
                            "e.g. Steadfast / Pathao / RedX",
                          )}
                          required={isConditionDraft}
                          value={saleForm.courierName}
                        />
                      </label>

                      <label>
                        {bt(
                          "কনসাইনমেন্ট / ট্র্যাকিং নম্বর",
                          "Consignment / tracking no.",
                        )}
                        <input
                          onChange={(event) =>
                            setSaleForm({
                              ...saleForm,
                              trackingNo: event.target.value,
                            })
                          }
                          placeholder={bt("ঐচ্ছিক", "Optional")}
                          value={saleForm.trackingNo}
                        />
                      </label>

                      <label>
                        {bt(
                          "কুরিয়ার চার্জ (নিজের খরচ)",
                          "Courier charge (your cost)",
                        )}
                        <input
                          min="0"
                          onChange={(event) =>
                            setSaleForm({
                              ...saleForm,
                              courierCharge: event.target.value,
                            })
                          }
                          placeholder="0"
                          step="1"
                          type="number"
                          value={saleForm.courierCharge}
                        />
                      </label>
                    </div>
                  </section>
                )}

                <output className="sale-total multi-sale-grand-total">
                  <span>
                    {bt("মোট", "Total")}:{" "}
                    <strong>{money(saleCartTotal)}</strong>
                  </span>
                  <small>
                    {saleCartQty.toLocaleString(
                      lang === "bn" ? "bn-BD" : "en-GB",
                    )}{" "}
                    {bt("টি ইউনিট", "units")}
                  </small>
                </output>

                <button
                  className="primary-button wide multi-sale-save-button"
                  disabled={!saleItems.length || saleSaving}
                  type="submit"
                >
                  <Save size={18} />
                  {saleSaving ? bt("সেভ হচ্ছে…", "Saving…") : bt("বিক্রয় সেভ করুন", "Save sale")}
                </button>
              </form>
            </section>

            <section className="panel multi-sale-summary-panel">
              <div className="panel-head">
                <div>
                  <h2>{bt("বিলের সারাংশ", "Bill summary")}</h2>
                  <p className="multi-sale-subtitle">
                    {bt(
                      "একটি অর্ডারে যোগ করা সব পণ্য",
                      "All products in this order",
                    )}
                  </p>
                </div>

                <button
                  className="ghost-button"
                  onClick={resetSaleDraft}
                  type="button"
                >
                  {bt("রিসেট", "Reset")}
                </button>
              </div>

              <div className="bill-items-summary">
                {saleItems.length ? (
                  saleItems.map((item) => (
                    <div
                      className="bill-item-summary"
                      key={item.productId}
                    >
                      <div>
                        <strong>{item.name}</strong>
                        <span>
                          {item.qty} × {money(item.price)}
                        </span>
                      </div>

                      <strong>
                        {money(
                          wholeTaka(item.qty) *
                            wholeTaka(item.price),
                        )}
                      </strong>
                    </div>
                  ))
                ) : (
                  <div className="bill-items-empty">
                    {bt(
                      "পণ্য যোগ করলে এখানে বিল দেখা যাবে।",
                      "Your bill will appear here after adding products.",
                    )}
                  </div>
                )}
              </div>

              <div className="receipt-box multi-sale-receipt">
                <ReceiptLine
                  label={bt("পণ্যের ধরন", "Products")}
                  value={saleItems.length}
                />
                <ReceiptLine
                  label={bt("মোট পরিমাণ", "Total quantity")}
                  value={saleCartQty}
                />
                <ReceiptLine
                  label={bt("মোট বিল", "Total bill")}
                  value={money(saleCartTotal)}
                />
                <ReceiptLine
                  label={
                    isConditionDraft
                      ? bt("এখন পরিশোধ", "Paid now")
                      : bt("পরিশোধ", "Paid")
                  }
                  value={money(salePaid)}
                />
                <ReceiptLine
                  label={
                    isConditionDraft
                      ? bt("কন্ডিশন টাকা", "Condition amount")
                      : bt("বাকি", "Due")
                  }
                  value={
                    isConditionDraft
                      ? money(saleCartTotal)
                      : money(
                          Math.max(0, saleCartTotal - salePaid),
                        )
                  }
                />
              </div>
            </section>
          </section>
        )}


        {activeTab === "courier" && (
          <section className="view condition-view">
            <section className="condition-summary-grid">
              <article className="condition-summary-card">
                <span>{bt("চলমান কন্ডিশন", "Open COD orders")}</span>
                <strong>
                  {conditionSummary.openOrders.toLocaleString(
                    lang === "bn" ? "bn-BD" : "en-GB",
                  )}
                </strong>
              </article>

              <article className="condition-summary-card">
                <span>{bt("পেন্ডিং টাকা", "Pending amount")}</span>
                <strong>{money(conditionSummary.pendingAmount)}</strong>
              </article>

              <article className="condition-summary-card">
                <span>{bt("কুরিয়ারের কাছে পাওনা", "Awaiting courier payment")}</span>
                <strong>{money(conditionSummary.awaitingAmount)}</strong>
              </article>

              <article className="condition-summary-card">
                <span>{bt("মোট সেটেলড", "Settled amount")}</span>
                <strong>{money(conditionSummary.settledAmount)}</strong>
              </article>
            </section>

            <section className="panel condition-panel">
              <div className="condition-toolbar">
                <div className="condition-toolbar-copy">
                  <h2>{bt("কুরিয়ার কন্ডিশন অর্ডার", "Courier COD orders")}</h2>
                  <p>
                    {bt(
                      "পাঠানো, ডেলিভারি, টাকা পাওয়া এবং ফেরত—সব স্ট্যাটাস এখান থেকে পরিচালনা করুন।",
                      "Track dispatch, delivery, courier settlement and returns in one place.",
                    )}
                  </p>
                </div>

                <div className="condition-toolbar-actions">
                  <div className="input-with-icon condition-search">
                    <Search size={18} />
                    <input
                      onChange={(event) =>
                        setConditionSearch(event.target.value)
                      }
                      placeholder={bt(
                        "অর্ডার, কাস্টমার, কুরিয়ার বা ট্র্যাকিং খুঁজুন",
                        "Search order, customer, courier or tracking",
                      )}
                      value={conditionSearch}
                    />
                  </div>

                  <select
                    className="condition-filter"
                    onChange={(event) =>
                      setConditionFilter(event.target.value)
                    }
                    value={conditionFilter}
                  >
                    <option value="open">
                      {bt("চলমান", "Open")}
                    </option>
                    <option value="all">
                      {bt("সব", "All")}
                    </option>
                    <option value="pending_dispatch">
                      {bt("পাঠানোর অপেক্ষায়", "Pending dispatch")}
                    </option>
                    <option value="sent">
                      {bt("কুরিয়ারে পাঠানো", "Sent")}
                    </option>
                    <option value="awaiting_payment">
                      {bt("টাকার অপেক্ষায়", "Awaiting payment")}
                    </option>
                    <option value="settled">
                      {bt("টাকা পাওয়া গেছে", "Settled")}
                    </option>
                    <option value="returned">
                      {bt("ফেরত", "Returned")}
                    </option>
                  </select>
                </div>
              </div>

              <div className="table-wrap condition-table-wrap">
                <table className="condition-table">
                  <thead>
                    <tr>
                      <th>{bt("অর্ডার", "Order")}</th>
                      <th>{bt("তারিখ", "Date")}</th>
                      <th>{bt("কাস্টমার", "Customer")}</th>
                      <th>{bt("পণ্য", "Products")}</th>
                      <th>{bt("কুরিয়ার", "Courier")}</th>
                      <th>{bt("পরিমাণ", "Amount")}</th>
                      <th>{bt("স্ট্যাটাস", "Status")}</th>
                      <th>{bt("কাজ", "Action")}</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredConditionSales.length ? (
                      filteredConditionSales.map((sale) => {
                        const status = getConditionStatus(sale);
                        const condition = sale.condition || {};
                        const productNames = Array.isArray(sale.items)
                          ? sale.items
                              .map((item) => item.name)
                              .filter(Boolean)
                              .join(", ")
                          : "";

                        return (
                          <tr key={sale.id}>
                            <td className="condition-order-cell">
                              <strong>{sale.orderNo || "—"}</strong>
                              {condition.trackingNo && (
                                <small>{condition.trackingNo}</small>
                              )}
                            </td>

                            <td>
                              {new Date(sale.date).toLocaleString(
                                lang === "bn" ? "bn-BD" : "en-GB",
                                {
                                  timeZone: "Asia/Dhaka",
                                  dateStyle: "short",
                                  timeStyle: "short",
                                },
                              )}
                            </td>

                            <td className="condition-customer-cell">
                              <strong>
                                {sale.customer ||
                                  bt(
                                    "ওয়াক-ইন কাস্টমার",
                                    "Walk-in customer",
                                  )}
                              </strong>
                              {sale.customerPhone && (
                                <small>{sale.customerPhone}</small>
                              )}
                              {sale.customerAddress && (
                                <small>{sale.customerAddress}</small>
                              )}
                            </td>

                            <td>{productNames || "—"}</td>

                            <td className="condition-courier-cell">
                              <strong>
                                {condition.courierName || "—"}
                              </strong>
                              {wholeTaka(condition.courierCharge) > 0 && (
                                <small>
                                  {bt("চার্জ", "Charge")}{" "}
                                  {money(condition.courierCharge)}
                                </small>
                              )}
                            </td>

                            <td className="condition-money">
                              {money(sale.total)}
                            </td>

                            <td>
                              <span
                                className={`condition-status is-${status}`}
                              >
                                {conditionStatusLabel(status, lang)}
                              </span>
                            </td>

                            <td>
                              <div className="condition-actions">
                                {status === "pending_dispatch" && (
                                  <>
                                    <button
                                      className="small-button condition-action-primary"
                                      onClick={() =>
                                        updateConditionStatus(
                                          sale.id,
                                          "sent",
                                        )
                                      }
                                      type="button"
                                    >
                                      {bt("পাঠানো হয়েছে", "Mark sent")}
                                    </button>

                                    <button
                                      className="small-button condition-action-danger"
                                      onClick={() =>
                                        updateConditionStatus(
                                          sale.id,
                                          "returned",
                                        )
                                      }
                                      type="button"
                                    >
                                      {bt("বাতিল", "Cancel")}
                                    </button>
                                  </>
                                )}

                                {status === "sent" && (
                                  <>
                                    <button
                                      className="small-button condition-action-primary"
                                      onClick={() =>
                                        updateConditionStatus(
                                          sale.id,
                                          "awaiting_payment",
                                        )
                                      }
                                      type="button"
                                    >
                                      {bt("ডেলিভারি হয়েছে", "Delivered")}
                                    </button>

                                    <button
                                      className="small-button condition-action-danger"
                                      onClick={() =>
                                        updateConditionStatus(
                                          sale.id,
                                          "returned",
                                        )
                                      }
                                      type="button"
                                    >
                                      {bt("ফেরত", "Returned")}
                                    </button>
                                  </>
                                )}

                                {status === "awaiting_payment" && (
                                  <button
                                    className="small-button condition-action-success"
                                    onClick={() =>
                                      updateConditionStatus(
                                        sale.id,
                                        "settled",
                                      )
                                    }
                                    type="button"
                                  >
                                    {bt("টাকা পেয়েছি", "Payment received")}
                                  </button>
                                )}

                                {["settled", "returned"].includes(
                                  status,
                                ) && (
                                  <span className="condition-closed-label">
                                    {status === "settled"
                                      ? bt("সম্পন্ন", "Completed")
                                      : bt("স্টক ফেরত", "Stock restored")}
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td className="condition-empty" colSpan="8">
                          {bt(
                            "কোনো কুরিয়ার কন্ডিশন অর্ডার পাওয়া যায়নি।",
                            "No Courier COD orders found.",
                          )}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </section>
        )}

        {activeTab === "allSales" && (
          <section className="view all-sales-view">
            <section className="all-sales-summary-grid">
              <article className="all-sales-summary-card">
                <span>{bt("মোট অর্ডার", "Total orders")}</span>
                <strong>{allSalesRows.length.toLocaleString(lang === "bn" ? "bn-BD" : "en-GB")}</strong>
              </article>

              <article className="all-sales-summary-card">
                <span>{bt("মোট বিক্রয়", "Total sales")}</span>
                <strong>{money(allSalesSummary.total)}</strong>
              </article>

              <article className="all-sales-summary-card">
                <span>{bt("পরিশোধ হয়েছে", "Received")}</span>
                <strong>{money(allSalesSummary.paid)}</strong>
              </article>

              <article className="all-sales-summary-card is-due">
                <span>{bt("বাকি", "Outstanding")}</span>
                <strong>{money(allSalesSummary.due)}</strong>
              </article>
            </section>

            <section className="panel all-sales-panel">
              <div className="all-sales-toolbar">
                <div className="all-sales-toolbar-copy">
                  <h2>{bt("বিক্রয়ের ইতিহাস", "Sales history")}</h2>
                  <p>
                    {bt(
                      "সব বিক্রয়, কাস্টমার, স্টাফ এবং পেমেন্ট এক জায়গায়।",
                      "All sales, customers, staff and payments in one place.",
                    )}
                  </p>
                </div>

                <div className="all-sales-toolbar-actions">
                  <div className="input-with-icon all-sales-search">
                    <Search size={18} />
                    <input
                      onChange={(event) => setAllSalesSearch(event.target.value)}
                      placeholder={bt(
                        "অর্ডার, পণ্য, কাস্টমার বা স্টাফ খুঁজুন",
                        "Search order, product, customer or staff",
                      )}
                      value={allSalesSearch}
                    />
                  </div>

                  <select
                    className="all-sales-filter"
                    onChange={(event) => setAllSalesStatus(event.target.value)}
                    value={allSalesStatus}
                  >
                    <option value="all">{bt("সব বিক্রয়", "All sales")}</option>
                    <option value="paid">{bt("পরিশোধিত", "Paid")}</option>
                    <option value="due">{bt("বাকি আছে", "Due")}</option>
                    <option value="returned">{bt("ফেরত", "Returned")}</option>
                    <option value="condition">
                      {bt("কুরিয়ার কন্ডিশন", "Courier COD")}
                    </option>
                  </select>

                  <button
                    className="primary-button all-sales-new-button"
                    onClick={() => { resetSaleDraft(); setActiveTab("sale"); }}
                    type="button"
                  >
                    <Plus size={18} />
                    {bt("নতুন বিক্রয়", "New sale")}
                  </button>
                </div>
              </div>

              <div className="table-wrap all-sales-table-wrap">
                <table className="all-sales-table">
                  <thead>
                    <tr>
                      <th>{bt("অর্ডার", "Order")}</th>
                      <th>{bt("তারিখ", "Date")}</th>
                      <th>{bt("পণ্য", "Product")}</th>
                      <th>{bt("কাস্টমার", "Customer")}</th>
                      <th>{bt("স্টাফ", "Staff")}</th>
                      <th>{bt("পেমেন্ট", "Payment")}</th>
                      <th>{bt("মোট", "Total")}</th>
                      <th>{bt("পরিশোধ", "Paid")}</th>
                      <th>{bt("বাকি", "Due")}</th>
                      <th className="invoice-column-heading">
                        {bt("কাজ", "Actions")}
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {allSalesRows.length ? (
                      allSalesRows.map((sale) => {
                        const total = Number(sale.total || 0);
                        const paid = Math.min(Number(sale.paid || 0), total);
                        const due = isConditionSale(sale)
                          ? 0
                          : Math.max(0, total - paid);
                        const productNames = Array.isArray(sale.items)
                          ? sale.items.map((item) => item.name).filter(Boolean).join(", ")
                          : "";

                        return (
                          <tr key={sale.id}>
                            <td className="all-sales-order">
                              <strong>{sale.orderNo || "—"}</strong>
                            </td>

                            <td>
                              {new Date(sale.date).toLocaleString(
                                lang === "bn" ? "bn-BD" : "en-GB",
                                {
                                  timeZone: "Asia/Dhaka",
                                  dateStyle: "short",
                                  timeStyle: "short",
                                },
                              )}
                            </td>

                            <td>{productNames || "—"}</td>
                            <td className="all-sales-customer-cell">
                              <strong>
                                {sale.customer ||
                                  bt("ওয়াক-ইন কাস্টমার", "Walk-in customer")}
                              </strong>
                              {sale.customerPhone && (
                                <small>{sale.customerPhone}</small>
                              )}
                              {sale.customerAddress && (
                                <small>{sale.customerAddress}</small>
                              )}
                            </td>
                            <td>{sale.staffName || "—"}</td>
                            <td className="all-sales-payment-cell">
                              <strong>
                                {isConditionSale(sale)
                                  ? bt(
                                      "কুরিয়ার কন্ডিশন",
                                      "Courier COD",
                                    )
                                  : sale.payment || "Cash"}
                              </strong>
                              {isConditionSale(sale) && (
                                <small
                                  className={`condition-inline-status is-${getConditionStatus(
                                    sale,
                                  )}`}
                                >
                                  {conditionStatusLabel(
                                    getConditionStatus(sale),
                                    lang,
                                  )}
                                </small>
                              )}
                              {sale.returnedAt && <small>{bt("সম্পূর্ণ ফেরত", "Fully returned")}</small>}
                            </td>
                            <td className="all-sales-money">{money(total)}</td>
                            <td className="all-sales-money">{money(paid)}</td>
                            <td>
                              {sale.returnedAt ? (
                                <span className="all-sales-payment-badge">{bt("ফেরত", "Returned")}</span>
                              ) : isConditionSale(sale) ? (
                                <span
                                  className={`all-sales-payment-badge condition-inline-status is-${getConditionStatus(
                                    sale,
                                  )}`}
                                >
                                  {conditionStatusLabel(
                                    getConditionStatus(sale),
                                    lang,
                                  )}
                                </span>
                              ) : (
                                <span
                                  className={
                                    due > 0
                                      ? "all-sales-payment-badge is-due"
                                      : "all-sales-payment-badge is-paid"
                                  }
                                >
                                  {due > 0
                                    ? money(due)
                                    : bt("পরিশোধিত", "Paid")}
                                </span>
                              )}
                            </td>

                            <td className="invoice-column-cell">
                              <div className="table-actions">
                              <button
                                aria-label={bt(
                                  "PDF ইনভয়েস ডাউনলোড",
                                  "Download PDF invoice",
                                )}
                                className="invoice-icon-button"
                                onClick={() => downloadSaleInvoice(sale)}
                                title={bt(
                                  "PDF ইনভয়েস ডাউনলোড",
                                  "Download PDF invoice",
                                )}
                                type="button"
                              >
                                <svg
                                  aria-hidden="true"
                                  fill="none"
                                  height="17"
                                  viewBox="0 0 24 24"
                                  width="17"
                                >
                                  <path
                                    d="M12 3v11m0 0 4-4m-4 4-4-4M5 17v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2"
                                    stroke="currentColor"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth="2"
                                  />
                                </svg>
                              </button>
                              {!isConditionSale(sale) && !sale.returnedAt && <button className="small-button" type="button" onClick={() => setReturnDialog({ saleId: sale.id, reason: "" })}>{bt("ফেরত", "Return")}</button>}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td className="all-sales-empty" colSpan="10">
                          {bt("কোনো বিক্রয় পাওয়া যায়নি।", "No sales found.")}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </section>
        )}


        {activeTab === "productInsights" && (
          <section className="view insight-view">
            <section className="insight-summary-grid">
              <article className="insight-summary-card">
                <span>{bt("মোট বিক্রি হওয়া ইউনিট", "Units sold")}</span>
                <strong>
                  {productDemandSummary.units.toLocaleString(
                    lang === "bn" ? "bn-BD" : "en-GB",
                  )}
                </strong>
              </article>

              <article className="insight-summary-card">
                <span>{bt("বিক্রি হওয়া পণ্যের ধরন", "Products sold")}</span>
                <strong>
                  {productDemandRows.length.toLocaleString(
                    lang === "bn" ? "bn-BD" : "en-GB",
                  )}
                </strong>
              </article>

              <article className="insight-summary-card">
                <span>{bt("সবচেয়ে বেশি চাহিদা", "Highest demand")}</span>
                <strong className="insight-summary-name">
                  {productDemandRows[0]?.name || "—"}
                </strong>
              </article>

              <article className="insight-summary-card">
                <span>{bt("এই বিক্রয়ের মূল্য", "Sales value")}</span>
                <strong>{money(productDemandSummary.revenue)}</strong>
              </article>
            </section>

            <section className="panel insight-panel">
              <div className="insight-panel-head">
                <div>
                  <h2>{bt("পণ্য চাহিদার তালিকা", "Product demand ranking")}</h2>
                  <p>
                    {bt(
                      "কোন পণ্য কতটি বিক্রি হয়েছে এবং কোনটির চাহিদা সবচেয়ে বেশি তা দেখুন।",
                      "See units sold, sales value and which products are in highest demand.",
                    )}
                  </p>
                </div>

                <select
                  className="insight-filter"
                  onChange={(event) => setInsightFilter(event.target.value)}
                  value={insightFilter}
                >
                  <option value="today">{bt("আজ", "Today")}</option>
                  <option value="month">{bt("এই মাস", "This month")}</option>
                  <option value="all">{bt("সব সময়", "All time")}</option>
                </select>
              </div>

              {productDemandRows.length ? (
                <div className="insight-ranking-list">
                  {productDemandRows.map((row, index) => (
                    <article className="insight-ranking-row" key={row.key}>
                      <span className="insight-rank">
                        #{(index + 1).toLocaleString(
                          lang === "bn" ? "bn-BD" : "en-GB",
                        )}
                      </span>

                      <div className="insight-ranking-main">
                        <div className="insight-ranking-title">
                          <strong>{row.name}</strong>
                          {index === 0 && (
                            <span className="insight-top-badge">
                              {bt("সর্বোচ্চ চাহিদা", "Top demand")}
                            </span>
                          )}
                        </div>

                        <div className="insight-bar-track">
                          <span
                            className="insight-bar-fill"
                            style={{
                              width: `${Math.max(
                                5,
                                Math.round(
                                  (row.qty / productDemandMaxQty) * 100,
                                ),
                              )}%`,
                            }}
                          />
                        </div>
                      </div>

                      <div className="insight-value">
                        <span>{bt("পরিমাণ", "Units")}</span>
                        <strong>
                          {row.qty.toLocaleString(
                            lang === "bn" ? "bn-BD" : "en-GB",
                          )}
                        </strong>
                      </div>

                      <div className="insight-value">
                        <span>{bt("অর্ডার", "Orders")}</span>
                        <strong>
                          {row.orders.toLocaleString(
                            lang === "bn" ? "bn-BD" : "en-GB",
                          )}
                        </strong>
                      </div>

                      <div className="insight-value is-money">
                        <span>{bt("বিক্রয়", "Sales")}</span>
                        <strong>{money(row.revenue)}</strong>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="insight-empty">
                  {bt(
                    "নির্বাচিত সময়ের জন্য কোনো বিক্রয় তথ্য নেই।",
                    "No sales data is available for this period.",
                  )}
                </div>
              )}
            </section>
          </section>
        )}

        {activeTab === "customerInsights" && (
          <section className="view insight-view">
            <section className="insight-summary-grid">
              <article className="insight-summary-card">
                <span>{bt("চিহ্নিত কাস্টমার", "Tracked customers")}</span>
                <strong>
                  {customerInsightRows.length.toLocaleString(
                    lang === "bn" ? "bn-BD" : "en-GB",
                  )}
                </strong>
              </article>

              <article className="insight-summary-card">
                <span>{bt("সর্বোচ্চ ক্রেতা", "Top customer")}</span>
                <strong className="insight-summary-name">
                  {customerInsightRows[0]?.name || "—"}
                </strong>
              </article>

              <article className="insight-summary-card">
                <span>{bt("সর্বোচ্চ ক্রয়", "Top purchase")}</span>
                <strong>{money(customerInsightRows[0]?.total || 0)}</strong>
              </article>

              <article className="insight-summary-card">
                <span>{bt("চিহ্নিত কাস্টমার বিক্রয়", "Tracked customer sales")}</span>
                <strong>{money(customerInsightSummary.total)}</strong>
              </article>
            </section>

            <section className="panel insight-panel">
              <div className="insight-panel-head">
                <div>
                  <h2>{bt("কাস্টমার ক্রয় তালিকা", "Customer purchase ranking")}</h2>
                  <p>
                    {bt(
                      "যেসব বিক্রয়ে কাস্টমারের নাম বা নাম্বার আছে সেগুলো থেকে সবচেয়ে বেশি ক্রয়কারী দেখানো হচ্ছে।",
                      "Ranks customers with a saved name or phone by total purchase value.",
                    )}
                  </p>
                </div>

                <select
                  className="insight-filter"
                  onChange={(event) => setInsightFilter(event.target.value)}
                  value={insightFilter}
                >
                  <option value="today">{bt("আজ", "Today")}</option>
                  <option value="month">{bt("এই মাস", "This month")}</option>
                  <option value="all">{bt("সব সময়", "All time")}</option>
                </select>
              </div>

              {customerInsightRows.length ? (
                <div className="insight-ranking-list">
                  {customerInsightRows.map((row, index) => (
                    <article className="insight-ranking-row customer-insight-row" key={row.key}>
                      <span className="insight-rank">
                        #{(index + 1).toLocaleString(
                          lang === "bn" ? "bn-BD" : "en-GB",
                        )}
                      </span>

                      <div className="insight-ranking-main">
                        <div className="insight-ranking-title">
                          <div className="customer-insight-name">
                            <strong>{row.name}</strong>
                            {(row.phone || row.address) && (
                              <small>
                                {[row.phone, row.address]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </small>
                            )}
                          </div>

                          {index === 0 && (
                            <span className="insight-top-badge">
                              {bt("সেরা ক্রেতা", "Top customer")}
                            </span>
                          )}
                        </div>

                        <div className="insight-bar-track">
                          <span
                            className="insight-bar-fill"
                            style={{
                              width: `${Math.max(
                                5,
                                Math.round(
                                  (row.total / customerInsightMaxTotal) * 100,
                                ),
                              )}%`,
                            }}
                          />
                        </div>
                      </div>

                      <div className="insight-value">
                        <span>{bt("অর্ডার", "Orders")}</span>
                        <strong>
                          {row.orders.toLocaleString(
                            lang === "bn" ? "bn-BD" : "en-GB",
                          )}
                        </strong>
                      </div>

                      <div className="insight-value">
                        <span>{bt("পণ্য", "Units")}</span>
                        <strong>
                          {row.qty.toLocaleString(
                            lang === "bn" ? "bn-BD" : "en-GB",
                          )}
                        </strong>
                      </div>

                      <div className="insight-value is-money">
                        <span>{bt("মোট ক্রয়", "Purchased")}</span>
                        <strong>{money(row.total)}</strong>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="insight-empty">
                  {bt(
                    "এই সময়ের মধ্যে নাম বা নাম্বারসহ কোনো কাস্টমার বিক্রয় পাওয়া যায়নি।",
                    "No identified customer purchases were found for this period.",
                  )}
                </div>
              )}
            </section>
          </section>
        )}

        {activeTab === "products" && (
          <section className="view products-reference-view">
            <section className="panel product-management-panel">
              <div className="product-management-toolbar">
                <div className="product-search-box">
                  <Search size={18} />
                  <input
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder={bt("পণ্য খুঁজুন", "Search products")}
                    value={search}
                  />
                </div>

                <select
                  className="product-category-filter"
                  onChange={(event) => setProductCategory(event.target.value)}
                  value={productCategory}
                >
                  <option value="all">{bt("সব ক্যাটাগরি", "All Categories")}</option>
                  {productCategories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>

                <button
                  className="primary-button product-add-button"
                  onClick={openNewProductModal}
                  type="button"
                >
                  <Plus size={18} />
                  {t.addProduct}
                </button>
              </div>

              <div className="table-wrap products-reference-table-wrap">
                <table className="products-reference-table">
                  <thead>
                    <tr>
                      <th>{bt("পণ্য", "Product")}</th>
                      <th>{bt("ক্যাটাগরি", "Category")}</th>
                      <th>{bt("ক্রয় মূল্য", "Buying Price")}</th>
                      <th>{bt("বিক্রয় মূল্য", "Selling Price")}</th>
                      <th>{bt("স্টক", "Stock")}</th>
                      <th>{bt("স্ট্যাটাস", "Status")}</th>
                      <th>{bt("কাজ", "Actions")}</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredProducts.map((product) => (
                      <tr key={product.id}>
                        <td className="product-primary-cell">
                          <strong>{product.name}</strong>
                          {product.kind === "service" && <small>{bt("সেবা", "Service")}</small>}
                          <small>{product.id}</small>
                          {product.addedByStaffName && (
                            <small className="product-added-by">
                              {bt("যোগ করেছেন", "Added by")}: {product.addedByStaffName}
                            </small>
                          )}
                        </td>

                        <td>{product.category || bt("ক্যাটাগরি নেই", "No category")}</td>
                        <td>{product.kind === "service" ? "—" : money(product.buyPrice)}</td>
                        <td>{money(product.sellPrice)}</td>
                        <td className="product-stock-cell">{product.kind === "service" ? "—" : product.stock}</td>

                        <td>
                          <span
                            className={
                              product.active !== false
                                ? "product-active-badge"
                                : "product-disabled-badge"
                            }
                          >
                            {product.active !== false
                              ? bt("সক্রিয়", "Active")
                              : bt("বন্ধ", "Disabled")}
                          </span>
                        </td>

                        <td>
                          <div className="table-actions product-action-buttons">
                            <button
                              aria-label={bt("পণ্য এডিট", "Edit product")}
                              className="small-button dark"
                              onClick={() => editProduct(product)}
                              type="button"
                            >
                              <Pencil size={16} />
                            </button>

                            <button
                              aria-label={bt("পণ্য ডিলিট", "Delete product")}
                              className="small-button danger"
                              onClick={() => deleteProduct(product.id)}
                              type="button"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}

                    {!filteredProducts.length && (
                      <tr>
                        <td className="products-empty-row" colSpan="7">
                          {bt("কোনো পণ্য পাওয়া যায়নি।", "No products found.")}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            {productModalOpen && (
              <div
                className="product-modal-backdrop"
                onMouseDown={closeProductModal}
                role="presentation"
              >
                <section
                  aria-labelledby="product-modal-title"
                  aria-modal="true"
                  className="product-editor-modal"
                  onMouseDown={(event) => event.stopPropagation()}
                  role="dialog"
                >
                  <header className="product-editor-header">
                    <div>
                      <small>PRODUCT EDITOR</small>
                      <h2 id="product-modal-title">
                        {productForm.id
                          ? bt("পণ্য এডিট", "Edit Product")
                          : bt("নতুন পণ্য", "New Product")}
                      </h2>
                    </div>

                    <button
                      aria-label={bt("বন্ধ করুন", "Close")}
                      className="product-modal-close"
                      onClick={closeProductModal}
                      type="button"
                    >
                      <X size={20} />
                    </button>
                  </header>

                  <form className="product-editor-form" onSubmit={submitProduct}>
                    <div className="product-editor-fields">
                      <label>
                        {bt("ধরন", "Type")}
                        <select value={productForm.kind} onChange={(event) => setProductForm({ ...productForm, kind: event.target.value })}>
                          <option value="product">{bt("পণ্য", "Product")}</option>
                          <option value="service">{bt("সেবা", "Service")}</option>
                        </select>
                      </label>
                      <label>
                        {bt("পণ্যের নাম", "Product Name")}
                        <input
                          autoFocus
                          onChange={(event) =>
                            setProductForm({ ...productForm, name: event.target.value })
                          }
                          required
                          value={productForm.name}
                        />
                      </label>

                      <label>
                        {bt("ক্যাটাগরি", "Category")}
                        <input
                          onChange={(event) =>
                            setProductForm({ ...productForm, category: event.target.value })
                          }
                          placeholder={bt("যেমন: খাবার", "Example: Food")}
                          value={productForm.category}
                        />
                      </label>

                      {productForm.kind !== "service" && <label>
                        {bt("ক্রয় মূল্য", "Buying Price")}
                        <input
                          min="0"
                          onChange={(event) =>
                            setProductForm({ ...productForm, buyPrice: event.target.value })
                          }
                          step="1"
                          type="number"
                          value={productForm.buyPrice}
                        />
                      </label>}

                      <label>
                        {bt("বিক্রয় মূল্য", "Selling Price")}
                        <input
                          min="0"
                          onChange={(event) =>
                            setProductForm({ ...productForm, sellPrice: event.target.value })
                          }
                          required
                          step="1"
                          type="number"
                          value={productForm.sellPrice}
                        />
                      </label>

                      {productForm.kind !== "service" && <label>
                        {bt("স্টক", "Stock")}
                        <input
                          min="0"
                          onChange={(event) =>
                            setProductForm({ ...productForm, stock: event.target.value })
                          }
                          required
                          step="1"
                          type="number"
                          value={productForm.stock}
                        />
                      </label>}

                      {productForm.kind !== "service" && <label>
                        {bt("কম স্টক সীমা", "Low Stock Limit")}
                        <input
                          min="0"
                          onChange={(event) =>
                            setProductForm({ ...productForm, lowStock: event.target.value })
                          }
                          step="1"
                          type="number"
                          value={productForm.lowStock}
                        />
                      </label>}

                      <label className="product-status-field">
                        <span>{bt("স্ট্যাটাস", "Status")}</span>

                        <span className="product-status-checkbox-row">
                          <input
                            checked={productForm.active !== false}
                            onChange={(event) =>
                              setProductForm({
                                ...productForm,
                                active: event.target.checked,
                              })
                            }
                            type="checkbox"
                          />

                          <span className="product-status-checkbox-copy">
                            <strong>
                              {bt("Active", "Active")}
                            </strong>
                            <small>
                              {productForm.active !== false
                                ? bt(
                                    "বিক্রয়ের জন্য দেখাবে",
                                    "Show this product for sale",
                                  )
                                : bt(
                                    "বিক্রয়ের জন্য দেখাবে না",
                                    "Hide this product from sale",
                                  )}
                            </small>
                          </span>
                        </span>
                      </label>
                    </div>

                    <footer className="product-editor-footer">
                      <button
                        className="product-editor-cancel"
                        onClick={closeProductModal}
                        type="button"
                      >
                        {bt("বাতিল", "Cancel")}
                      </button>

                      <button className="product-editor-save" type="submit">
                        <Save size={18} />
                        {bt("পণ্য সেভ করুন", "Save Product")}
                      </button>
                    </footer>
                  </form>
                </section>
              </div>
            )}
          </section>
        )}

        {activeTab === "purchases" && (
          <section className="view purchase-view">
            <section className="panel">
              <div className="panel-head">
                <div>
                  <h2>{bt("পণ্য ক্রয়", "Record a purchase")}</h2>
                  <p className="muted-line">{bt("ক্রয় সেভ করলে স্টক ও গড় ক্রয় মূল্য আপডেট হবে। লাভের হিসাবে এই ক্রয়মূল্য বিক্রয়ের সময় ধরা হয়।", "Saving a purchase updates stock and average buying cost. The cost is counted in profit when the item is sold.")}</p>
                </div>
              </div>
              {products.some((product) => product.kind !== "service") ? (
                <form className="form-grid purchase-form" onSubmit={submitPurchase}>
                  <label>{bt("পণ্য", "Product")}
                    <select required value={purchaseForm.productId} onChange={(event) => {
                      const selected = products.find((product) => product.id === event.target.value);
                      setPurchaseForm((current) => ({ ...current, productId: event.target.value, unitCost: selected ? String(wholeTaka(selected.buyPrice)) : "" }));
                    }}>
                      <option value="">{bt("পণ্য নির্বাচন করুন", "Select a product")}</option>
                      {products.filter((product) => product.kind !== "service").map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
                    </select>
                  </label>
                  <label>{bt("সরবরাহকারী (ঐচ্ছিক)", "Supplier (optional)")}
                    <input value={purchaseForm.supplier} onChange={(event) => setPurchaseForm((current) => ({ ...current, supplier: event.target.value }))} placeholder={bt("নাম লিখুন", "Enter a name")} />
                  </label>
                  <label>{bt("পরিমাণ", "Quantity")}
                    <input type="number" min="1" step="1" required value={purchaseForm.qty} onChange={(event) => setPurchaseForm((current) => ({ ...current, qty: event.target.value }))} />
                  </label>
                  <label>{bt("প্রতি ইউনিট ক্রয় মূল্য", "Buying price per unit")}
                    <input type="number" min="1" step="1" required value={purchaseForm.unitCost} onChange={(event) => setPurchaseForm((current) => ({ ...current, unitCost: event.target.value }))} />
                  </label>
                  <label className="form-span-2">{bt("নোট (ঐচ্ছিক)", "Note (optional)")}
                    <input value={purchaseForm.note} onChange={(event) => setPurchaseForm((current) => ({ ...current, note: event.target.value }))} />
                  </label>
                  <div className="purchase-form-footer form-span-2">
                    <strong>{bt("মোট", "Total")}: {money(Math.max(0, wholeTaka(purchaseForm.qty)) * Math.max(0, wholeTaka(purchaseForm.unitCost)))}</strong>
                    <button className="primary-button" type="submit" disabled={purchaseSaving}>{purchaseSaving ? bt("সেভ হচ্ছে…", "Saving…") : bt("ক্রয় সেভ করুন", "Save purchase")}</button>
                  </div>
                </form>
              ) : (
                <div className="setup-actions"><p>{bt("ক্রয়ের আগে একটি পণ্য যোগ করুন।", "Add a product before recording a purchase.")}</p><button className="primary-button" type="button" onClick={() => { setActiveTab("products"); window.setTimeout(openNewProductModal, 0); }}>{bt("পণ্য যোগ করুন", "Add product")}</button></div>
              )}
            </section>
            <section className="panel">
              <div className="panel-head"><h2>{bt("ক্রয়ের ইতিহাস", "Purchase history")}</h2><strong>{bt("এই মাসে", "This month")}: {money(data.purchases.filter((purchase) => getMonthKey(purchase.date) === monthKey()).reduce((sum, purchase) => sum + Number(purchase.total || 0), 0))}</strong></div>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>{bt("তারিখ", "Date")}</th><th>{bt("পণ্য", "Product")}</th><th>{bt("সরবরাহকারী", "Supplier")}</th><th>{bt("পরিমাণ", "Quantity")}</th><th>{bt("দর", "Unit cost")}</th><th>{bt("মোট", "Total")}</th></tr></thead>
                  <tbody>
                    {[...data.purchases].reverse().map((purchase) => <tr key={purchase.id}><td>{new Date(purchase.date).toLocaleString(lang === "bn" ? "bn-BD" : "en-GB", { timeZone: "Asia/Dhaka", dateStyle: "short", timeStyle: "short" })}</td><td>{purchase.productName}</td><td>{purchase.supplier || "—"}</td><td>{purchase.qty}</td><td>{money(purchase.unitCost)}</td><td>{money(purchase.total)}</td></tr>)}
                    {!data.purchases.length && <tr><td colSpan="6">{bt("এখনও কোনো ক্রয় নেই।", "No purchases yet.")}</td></tr>}
                  </tbody>
                </table>
              </div>
            </section>
          </section>
        )}

        {activeTab === "stock" && (
          <section className="view">
            <section className="panel">
              <div className="panel-head stock-head">
                <div>
                  <h2>{t.stockTitle}</h2>
                  <strong className="muted-line">
                    {filteredStock.length} {t.stockSubtitle} / {products.filter((item) => item.kind !== "service").length} {bt("মোট", "total")}
                  </strong>
                </div>
                <div className="toolbar">
                  <div className="input-with-icon">
                    <Search size={18} />
                    <input
                      onChange={(event) => setStockSearch(event.target.value)}
                      placeholder={t.searchStock}
                      value={stockSearch}
                    />
                  </div>
                  <button
                    className="primary-button"
                    onClick={() => {
                      setActiveTab("products");
                      window.setTimeout(openNewProductModal, 0);
                    }}
                    type="button"
                  >
                    <Plus size={18} />
                    {t.addProduct}
                  </button>
                </div>
              </div>

              <div className="stock-grid">
                {filteredStock.map((product) => (
                  <article className="stock-card" key={product.id}>
                    <div className="stock-name">
                      <strong>{product.name}</strong>
                      <span>{money(product.sellPrice)} {t.sellingPrice}</span>
                    </div>
                    <button className="stock-step" onClick={() => adjustStock(product.id, -1)} type="button" aria-label="Decrease stock">
                      <ChevronDown size={18} />
                    </button>
                    <b>{product.stock}</b>
                    <button className="stock-step" onClick={() => adjustStock(product.id, 1)} type="button" aria-label="Increase stock">
                      <ChevronUp size={18} />
                    </button>
                  </article>
                ))}
              </div>
              <h3 className="history-heading">{bt("সাম্প্রতিক স্টক পরিবর্তন", "Recent stock changes")}</h3>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>{bt("সময়", "Time")}</th><th>{bt("পণ্য", "Product")}</th><th>{bt("পরিবর্তন", "Change")}</th><th>{bt("কারণ", "Reason")}</th><th>{bt("স্টাফ", "Staff")}</th></tr></thead>
                  <tbody>
                    {data.stockMovements.slice(-15).reverse().map((movement) => (
                      <tr key={movement.id}>
                        <td>{new Date(movement.date).toLocaleString(lang === "bn" ? "bn-BD" : "en-GB", { timeZone: "Asia/Dhaka", dateStyle: "short", timeStyle: "short" })}</td>
                        <td>{movement.productName}</td>
                        <td>{movement.delta > 0 ? "+" : ""}{movement.delta}</td>
                        <td>{stockReasonLabel(movement.reason, lang)}</td>
                        <td>{movement.staffName || "—"}</td>
                      </tr>
                    ))}
                    {!data.stockMovements.length && <tr><td colSpan="5">{bt("এখনও পরিবর্তন নেই", "No changes yet")}</td></tr>}
                  </tbody>
                </table>
              </div>
            </section>
          </section>
        )}

        {activeTab === "dues" && (
          <section className="view">
            <section className="panel">
              <div className="panel-head">
                <h2>{bt("বাকি হিসাব", "Due list")}</h2>
                <span className="summary-pill">{money(metrics.totalDue)}</span>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>{bt("তারিখ", "Date")}</th>
                      <th>{bt("কাস্টমার", "Customer")}</th>
                      <th>{bt("বিল", "Bill")}</th>
                      <th>{bt("বাকি", "Due")}</th>
                      <th>{bt("কাজ", "Action")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dueSales.length ? (
                      dueSales.map((sale) => (
                        <tr key={sale.id}>
                          <td>{new Date(sale.date).toLocaleDateString(lang === "bn" ? "bn-BD" : "en-US", { timeZone: "Asia/Dhaka" })}</td>
                          <td>{sale.customer || bt("নাম নেই", "No name")}</td>
                          <td>{money(sale.total)}</td>
                          <td>{money(sale.total - sale.paid)}</td>
                          <td>
                            <button className="small-button" onClick={() => payDue(sale.id)} type="button">
                              {bt("পরিশোধ", "Pay")}
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="5">{bt("কোনো বাকি নেই।", "No due found.")}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <h3 className="history-heading">{bt("সাম্প্রতিক বাকি আদায়", "Recent due payments")}</h3>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>{bt("সময়", "Time")}</th><th>{bt("অর্ডার", "Order")}</th><th>{bt("টাকা", "Amount")}</th><th>{bt("স্টাফ", "Staff")}</th></tr></thead>
                  <tbody>
                    {data.duePayments.slice(-15).reverse().map((payment) => (
                      <tr key={payment.id}>
                        <td>{new Date(payment.date).toLocaleString(lang === "bn" ? "bn-BD" : "en-GB", { timeZone: "Asia/Dhaka", dateStyle: "short", timeStyle: "short" })}</td>
                        <td>{sales.find((sale) => sale.id === payment.saleId)?.orderNo || payment.saleId}</td>
                        <td>{money(payment.amount)}</td>
                        <td>{payment.staffName || "—"}</td>
                      </tr>
                    ))}
                    {!data.duePayments.length && <tr><td colSpan="4">{bt("এখনও আদায় নেই", "No payments yet")}</td></tr>}
                  </tbody>
                </table>
              </div>
            </section>
          </section>
        )}

        {activeTab === "reports" && (
          <section className="view">
            <div className="report-grid">
              <section className="panel">
                <h2>{bt("রিপোর্ট", "Reports")}</h2>
                <div className="metric-list">
                  <p><span>{bt("মাসিক বিক্রি", "Monthly sales")}</span><strong>{money(metrics.monthSales)}</strong></p>
                  <p><span>{bt("মাসিক লাভ", "Monthly profit")}</span><strong>{money(metrics.monthProfit)}</strong></p>
                  <p><span>{bt("মাসিক খরচ", "Monthly expense")}</span><strong>{money(metrics.monthExpense)}</strong></p>
                  <p><span>{bt("মোট পণ্য", "Total products")}</span><strong>{products.length.toLocaleString(lang === "bn" ? "bn-BD" : "en-US")}</strong></p>
                </div>
              </section>

              <section className="panel">
                <h2>{bt("খরচ যোগ করুন", "Add expense")}</h2>
                <form className="form-grid compact" onSubmit={submitExpense}>
                  <label>
                    {bt("খরচের ধরন", "Expense type")}
                    <input
                      onChange={(event) => setExpenseForm({ ...expenseForm, type: event.target.value })}
                      placeholder={bt("ভাড়া / বেতন / বিদ্যুৎ", "Rent / Salary / Utilities")}
                      required
                      value={expenseForm.type}
                    />
                  </label>
                  <label>
                    {bt("টাকা", "Amount")}
                    <input
                      min="0"
                      onChange={(event) => setExpenseForm({ ...expenseForm, amount: event.target.value })}
                      required
                      step="1"
                      type="number"
                      value={expenseForm.amount}
                    />
                  </label>
                  <label>
                    {bt("নোট", "Note")}
                    <input
                      onChange={(event) => setExpenseForm({ ...expenseForm, note: event.target.value })}
                      value={expenseForm.note}
                    />
                  </label>
                  <button className="primary-button wide" type="submit">
                    {bt("খরচ সেভ করুন", "Save expense")}
                  </button>
                </form>
              </section>
            </div>

            <section className="panel">
              <div className="panel-head">
                <h2>{bt("বিক্রয় রিপোর্ট", "Sales report")}</h2>
                <select value={reportFilter} onChange={(event) => setReportFilter(event.target.value)}>
                  <option value="today">{bt("আজ", "Today")}</option>
                  <option value="month">{bt("এই মাস", "This month")}</option>
                  <option value="all">{bt("সব", "All")}</option>
                </select>
              </div>
              <SalesTable sales={reportSales} lang={lang} onInvoice={downloadSaleInvoice} />
            </section>
            <section className="panel">
              <div className="panel-head"><h2>{bt("ফেরতের হিসাব", "Returns")}</h2><strong>{money(reportReturns.reduce((sum, item) => sum + Number(item.total || 0), 0))}</strong></div>
              <div className="table-wrap"><table>
                <thead><tr><th>{bt("তারিখ", "Date")}</th><th>{bt("অর্ডার", "Order")}</th><th>{bt("কাস্টমার", "Customer")}</th><th>{bt("ফেরতের কারণ", "Reason")}</th><th>{bt("বিক্রয় ফেরত", "Sale reversed")}</th><th>{bt("টাকা ফেরত", "Refunded")}</th></tr></thead>
                <tbody>
                  {reportReturns.map((item) => <tr key={item.id}><td>{new Date(item.date).toLocaleString(lang === "bn" ? "bn-BD" : "en-GB", { timeZone: "Asia/Dhaka", dateStyle: "short", timeStyle: "short" })}</td><td>{item.orderNo || item.saleId}</td><td>{item.customer || "—"}</td><td>{item.reason}</td><td>{money(item.total)}</td><td>{money(item.refundAmount)}</td></tr>)}
                  {!reportReturns.length && <tr><td colSpan="6">{bt("ফেরত নেই।", "No returns.")}</td></tr>}
                </tbody>
              </table></div>
            </section>
          </section>
        )}

        {activeTab === "staff" && (
          <section className="view">
            <section className="panel">
              <div className="panel-head">
                <div>
                  <h2>{t.staffTitle}</h2>
                  <strong className="muted-line">{activeStaff.length} {t.active}</strong>
                </div>
                <form className="staff-form" onSubmit={submitStaff}>
                  <input
                    onChange={(event) => setStaffForm({ ...staffForm, name: event.target.value })}
                    placeholder={t.staffName}
                    value={staffForm.name}
                  />
                  <input
                    onChange={(event) => setStaffForm({ ...staffForm, role: event.target.value })}
                    placeholder={t.role}
                    value={staffForm.role}
                  />
                  <button className="primary-button" type="submit">
                    <Plus size={18} />
                    {t.addStaff}
                  </button>
                </form>
              </div>

              <div className="staff-grid">
                {activeStaff.map((member) => (
                  <article className="staff-card" key={member.id}>
                    <span className="staff-avatar">
                      <UserRound size={20} />
                    </span>
                    <div>
                      <strong>{member.name}</strong>
                      <small>{member.role || "Cashier"}</small>
                    </div>
                    <button className="small-button danger" onClick={() => removeStaff(member.id)} type="button">
                      <Trash2 size={16} />
                    </button>
                  </article>
                ))}
              </div>
            </section>
          </section>
        )}

        {activeTab === "settings" && (
          <section className="view settings-single-view">
            <section className="panel settings-shop-panel">
              <div className="settings-section-heading">
                <span className="settings-section-kicker">
                  {bt("ব্যবসার তথ্য", "Business information")}
                </span>
                <h2>{bt("দোকানের তথ্য", "Shop info")}</h2>
                <p>
                  {bt(
                    "দোকানের নাম, ফোন এবং ঠিকানা এখানে আপডেট করুন।",
                    "Update your business name, phone and address here.",
                  )}
                </p>
              </div>

              <form className="form-grid compact" onSubmit={saveShop}>
                <label>
                  {bt("দোকানের নাম", "Shop name")}
                  <input
                    onChange={(event) =>
                      setShopForm({ ...shopForm, name: event.target.value })
                    }
                    placeholder={bt("আপনার দোকানের নাম", "Your shop name")}
                    value={shopForm.name || ""}
                  />
                </label>

                <label>
                  {bt("মোবাইল", "Phone")}
                  <input
                    inputMode="tel"
                    onChange={(event) =>
                      setShopForm({ ...shopForm, phone: event.target.value })
                    }
                    placeholder={bt("ফোন নাম্বার", "Phone number")}
                    type="tel"
                    value={shopForm.phone || ""}
                  />
                </label>

                <label>
                  {bt("ঠিকানা", "Address")}
                  <input
                    onChange={(event) =>
                      setShopForm({ ...shopForm, address: event.target.value })
                    }
                    placeholder={bt("এলাকা, শহর", "Area, city")}
                    value={shopForm.address || ""}
                  />
                </label>

                <button className="primary-button wide" type="submit">
                  {bt("সেভ করুন", "Save changes")}
                </button>
              </form>
            </section>
          </section>
        )}
      </main>

      {productDeleteConfirm.open && (
        <div
          className="premium-delete-backdrop"
          onMouseDown={closeProductDeleteConfirm}
          role="presentation"
        >
          <section
            aria-labelledby="product-delete-title"
            aria-modal="true"
            className="premium-delete-modal"
            onMouseDown={(event) => event.stopPropagation()}
            role="dialog"
          >
            <button
              aria-label={bt("বন্ধ করুন", "Close")}
              className="premium-delete-close"
              onClick={closeProductDeleteConfirm}
              type="button"
            >
              ×
            </button>

            <div className="premium-delete-icon" aria-hidden="true">
              <Trash2 size={24} />
            </div>

            <div className="premium-delete-copy">
              <span>{bt("নিশ্চিত করুন", "Confirm delete")}</span>
              <h3 id="product-delete-title">
                {bt("পণ্যটি সরাবেন?", "Remove this product?")}
              </h3>
              <p>
                {bt(
                  `“${productDeleteConfirm.productName}” সরাবেন? আগের বিক্রয় বা ক্রয়ের ইতিহাস থাকলে পণ্যটি নিষ্ক্রিয় হবে।`,
                  `Remove “${productDeleteConfirm.productName}”? Products with sales or purchase history will be deactivated.`,
                )}
              </p>
            </div>

            <div className="premium-delete-actions">
              <button
                className="premium-delete-cancel"
                onClick={closeProductDeleteConfirm}
                type="button"
              >
                {bt("বাতিল", "Cancel")}
              </button>

              <button
                className="premium-delete-confirm"
                onClick={confirmDeleteProduct}
                type="button"
              >
                <Trash2 size={17} />
                {bt("হ্যাঁ, সরান", "Yes, remove")}
              </button>
            </div>
          </section>
        </div>
      )}

      {staffDeleteConfirm.open && (
        <div
          className="premium-delete-backdrop"
          onMouseDown={closeStaffDeleteConfirm}
          role="presentation"
        >
          <section
            aria-labelledby="staff-delete-title"
            aria-modal="true"
            className="premium-delete-modal"
            onMouseDown={(event) => event.stopPropagation()}
            role="dialog"
          >
            <button
              aria-label={bt("বন্ধ করুন", "Close")}
              className="premium-delete-close"
              onClick={closeStaffDeleteConfirm}
              type="button"
            >
              ×
            </button>

            <div className="premium-delete-icon" aria-hidden="true">
              <Trash2 size={24} />
            </div>

            <div className="premium-delete-copy">
              <span>{bt("নিশ্চিত করুন", "Confirm action")}</span>
              <h3 id="staff-delete-title">
                {bt("স্টাফ মুছে ফেলবেন?", "Delete staff member?")}
              </h3>
              <p>
                {bt(
                  "আপনি কি “" + staffDeleteConfirm.staffName + "” কে সরাতে নিশ্চিত?",
                  "Are you sure you want to remove “" + staffDeleteConfirm.staffName + "”? ",
                )}
              </p>
              <div className="premium-delete-meta">
                <strong>{staffDeleteConfirm.staffName}</strong>
                <small>{staffDeleteConfirm.staffRole}</small>
              </div>
            </div>

            <div className="premium-delete-actions">
              <button
                className="premium-delete-cancel"
                onClick={closeStaffDeleteConfirm}
                type="button"
              >
                {bt("বাতিল", "Cancel")}
              </button>

              <button
                className="premium-delete-confirm"
                onClick={confirmDeleteStaff}
                type="button"
              >
                <Trash2 size={17} />
                {bt("হ্যাঁ, মুছুন", "Yes, delete")}
              </button>
            </div>
          </section>
        </div>
      )}

      {dueDialog.saleId && (
        <div className="premium-delete-backdrop" onMouseDown={() => !dueSaving && setDueDialog({ saleId: "", amount: "" })} role="presentation">
          <section className="premium-delete-modal due-entry-modal" aria-labelledby="due-entry-title" aria-modal="true" onMouseDown={(event) => event.stopPropagation()} role="dialog">
            <button className="premium-delete-close" type="button" aria-label={bt("বন্ধ করুন", "Close")} disabled={dueSaving} onClick={() => setDueDialog({ saleId: "", amount: "" })}>×</button>
            <form onSubmit={submitDuePayment}>
              <div className="premium-delete-copy">
                <span>{bt("বাকি আদায়", "Collect payment")}</span>
                <h3 id="due-entry-title">{bt("বাকি পরিশোধ", "Record due payment")}</h3>
                <p>{bt("অবশিষ্ট বাকি", "Remaining due")}: <strong>{money(dueDialogRemaining)}</strong></p>
                <label className="due-entry-field">{bt("আদায়ের পরিমাণ", "Amount received")}
                  <input autoFocus type="number" inputMode="numeric" min="1" max={dueDialogRemaining} required value={dueDialog.amount} onChange={(event) => setDueDialog((current) => ({ ...current, amount: event.target.value }))} />
                </label>
              </div>
              <div className="premium-delete-actions">
                <button className="premium-delete-cancel" type="button" disabled={dueSaving} onClick={() => setDueDialog({ saleId: "", amount: "" })}>{bt("বাতিল", "Cancel")}</button>
                <button className="primary-button" type="submit" disabled={dueSaving}>{dueSaving ? bt("সেভ হচ্ছে…", "Saving…") : bt("পরিশোধ সেভ করুন", "Save payment")}</button>
              </div>
            </form>
          </section>
        </div>
      )}

      {returnDialog.saleId && returnDialogSale && (
        <div className="premium-delete-backdrop" onMouseDown={() => !returnSaving && setReturnDialog({ saleId: "", reason: "" })} role="presentation">
          <section className="premium-delete-modal return-entry-modal" aria-labelledby="return-entry-title" aria-modal="true" onMouseDown={(event) => event.stopPropagation()} role="dialog">
            <button className="premium-delete-close" type="button" aria-label={bt("বন্ধ করুন", "Close")} disabled={returnSaving} onClick={() => setReturnDialog({ saleId: "", reason: "" })}>×</button>
            <form onSubmit={submitSaleReturn}>
              <div className="premium-delete-copy">
                <span>{bt("বিক্রয় ফেরত", "Sale return")}</span>
                <h3 id="return-entry-title">{bt("সম্পূর্ণ বিল ফেরত দিন", "Return the full sale")}</h3>
                <p>{returnDialogSale.orderNo || returnDialogSale.id} · {bt("বিক্রয়", "Sale")} {money(returnDialogSale.total)}</p>
                <div className="return-entry-summary">
                  <span>{bt("ফেরতযোগ্য টাকা", "Refund to customer")}: <strong>{money(returnDialogSale.paid)}</strong></span>
                  <span>{bt("বাতিল হবে এমন বাকি", "Due to cancel")}: <strong>{money(Math.max(0, Number(returnDialogSale.total || 0) - Number(returnDialogSale.paid || 0)))}</strong></span>
                </div>
                <label className="due-entry-field">{bt("ফেরতের কারণ", "Reason for return")}
                  <textarea required rows="3" maxLength="300" value={returnDialog.reason} onChange={(event) => setReturnDialog((current) => ({ ...current, reason: event.target.value }))} placeholder={bt("কারণ লিখুন", "Enter a reason")} />
                </label>
                <p className="return-entry-help">{bt("নিশ্চিত করলে পণ্যের স্টক ফিরবে এবং ফেরতের হিসাব সংরক্ষিত হবে।", "Confirm after refunding the customer. Stock and return history will be updated.")}</p>
              </div>
              <div className="premium-delete-actions">
                <button className="premium-delete-cancel" type="button" disabled={returnSaving} onClick={() => setReturnDialog({ saleId: "", reason: "" })}>{bt("বাতিল", "Cancel")}</button>
                <button className="primary-button" type="submit" disabled={returnSaving}>{returnSaving ? bt("সেভ হচ্ছে…", "Saving…") : bt("ফেরত নিশ্চিত করুন", "Confirm return")}</button>
              </div>
            </form>
          </section>
        </div>
      )}

      <div className={`toast ${toast ? "is-visible" : ""}`} role="status" aria-live="polite">
        {toast}
      </div>
    </div>
  );
}

function MetricGrid({ metrics, lang }) {
  const bn = lang === "bn";
  return (
    <div className="metric-grid">
      <Metric label={bn ? "আজকের বিক্রি" : "Sales today"} value={money(metrics.todaySales)} />
      <Metric label={bn ? "আজকের লাভ" : "Profit today"} value={money(metrics.todayProfit)} />
      <Metric label={bn ? "মোট বাকি" : "Total due"} value={money(metrics.totalDue)} />
      <Metric
        label={bn ? "কন্ডিশন পেন্ডিং" : "COD pending"}
        value={money(metrics.conditionPending)}
      />
      <Metric label={bn ? "স্টক মূল্য" : "Stock value"} value={money(metrics.stockValue)} />
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <article className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function ReceiptLine({ label, value }) {
  return (
    <div className="receipt-line">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function SalesTable({ title, sales, lang = "bn", onInvoice }) {
  const bn = lang === "bn";
  return (
    <section className={title ? "panel" : undefined}>
      {title && (
        <div className="panel-head">
          <h2>{title}</h2>
          <ReceiptText size={20} />
        </div>
      )}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>{bn ? "তারিখ" : "Date"}</th>
              <th>{bn ? "পণ্য" : "Product"}</th>
              <th>{bn ? "কাস্টমার" : "Customer"}</th>
              <th>{bn ? "স্টাফ" : "Staff"}</th>
              <th>{bn ? "বিক্রি" : "Sale"}</th>
              <th>{bn ? "লাভ" : "Profit"}</th>
              <th>{bn ? "বাকি" : "Due"}</th>
              <th aria-label={bn ? "ইনভয়েস" : "Invoice"}></th>
            </tr>
          </thead>
          <tbody>
            {sales.length ? (
              sales.map((sale) => (
                <tr key={sale.id}>
                  <td>{new Date(sale.date).toLocaleString(bn ? "bn-BD" : "en-US", { timeZone: "Asia/Dhaka", dateStyle: "short", timeStyle: "short" })}</td>
                  <td>{sale.items.map((item) => item.name).join(", ")}</td>
                  <td>{sale.customer || (bn ? "নগদ" : "Cash")}</td>
                  <td>{sale.staffName || "—"}</td>
                  <td>{money(sale.total)}</td>
                  <td>{money(saleProfit(sale))}</td>
                  <td>
                    {sale.returnedAt
                      ? (bn ? "ফেরত" : "Returned")
                      : isConditionSale(sale) &&
                    getConditionStatus(sale) !== "settled"
                      ? conditionStatusLabel(
                          getConditionStatus(sale),
                          lang,
                        )
                      : money(
                          Math.max(
                            0,
                            Number(sale.total || 0) -
                              Number(sale.paid || 0),
                          ),
                        )}
                  </td>
                  <td><button className="small-button" type="button" onClick={() => onInvoice(sale)}>{bn ? "ইনভয়েস" : "Invoice"}</button></td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="8">{bn ? "এখনও বিক্রয় নেই।" : "No sales yet."}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function cloudLabel(status, lang) {
  const bn = lang === "bn";
  if (status === "firebase") return bn ? "ক্লাউডে সংরক্ষিত" : "Cloud connected";
  if (status === "setup-error") return bn ? "Firebase সেটআপ অসম্পূর্ণ" : "Firebase setup incomplete";
  return bn ? "লোকাল ডেমো" : "Local demo";
}

const emptyProductForm = {
  id: "",
  name: "",
  kind: "product",
  category: "",
  buyPrice: "",
  sellPrice: "",
  stock: "",
  lowStock: "5",
  active: true,
};

const emptySaleForm = {
  productId: "",
  staffId: "",
  qty: "1",
  price: "",
  customer: "",
  customerPhone: "",
  customerAddress: "",
  paid: "",
  payment: "Cash",
  courierName: "",
  trackingNo: "",
  courierCharge: "",
};

