# সহজ ERP

হোটেল, রেস্টুরেন্ট, সুপার শপ, মোবাইল শো-রুম এবং ছোট দোকানের জন্য React + Vite ভিত্তিক বাংলা ERP/POS ডেমো।

## চালানোর নিয়ম

```bash
npm install
npm run dev
```

তারপর ব্রাউজারে Vite যে লোকাল URL দেখাবে সেটি খুলুন।

## Firebase চালু করা

ডিফল্টভাবে অ্যাপ demo/local mode-এ চলে। Firebase ব্যবহার করতে:

1. `.env.example` কপি করে `.env` বানান।
2. `VITE_FIREBASE_ENABLED=true` করুন।
3. Firebase project config বসান।
4. Firestore Database enable করুন।

ডেটা একটি document-এ সেভ হয়: collection `VITE_FIREBASE_COLLECTION`, document `main-store`।

## GitHub Pages

এই project GitHub Pages-ready।

```bash
npm run build
```

GitHub Actions workflow `.github/workflows/deploy.yml` দেওয়া আছে। repo Settings থেকে Pages source হিসেবে GitHub Actions select করলে `main` branch push করলেই deploy হবে।

ম্যানুয়াল deploy করতে চাইলে:

```bash
npm run deploy
```

## ফিচার

- পণ্য, category, ক্রয় মূল্য, বিক্রয় মূল্য, stock
- দ্রুত বিক্রয়
- daily sales, daily profit, monthly sales, monthly profit
- due tracking ও due payment
- expense tracking
- low-stock alert
- backup/export ও import
- business preset: hotel, restaurant, supershop, mobile showroom
