// Currencies commonly relevant to study-abroad budgeting. Currency codes are
// language-agnostic (ISO 4217), so unlike countries there's no need to
// localize the label — we just pair the code with its usual symbol.
export const CURRENCIES = [
  { code: "USD", symbol: "$" },
  { code: "EUR", symbol: "€" },
  { code: "GBP", symbol: "£" },
  { code: "JPY", symbol: "¥" },
  { code: "KRW", symbol: "₩" },
  { code: "CNY", symbol: "¥" },
  { code: "CAD", symbol: "$" },
  { code: "AUD", symbol: "$" },
  { code: "CHF", symbol: "Fr" },
  { code: "SGD", symbol: "$" },
  { code: "HKD", symbol: "$" },
  { code: "NZD", symbol: "$" },
  { code: "INR", symbol: "₹" },
  { code: "AED", symbol: "د.إ" },
  { code: "SEK", symbol: "kr" },
  { code: "NOK", symbol: "kr" },
  { code: "DKK", symbol: "kr" },
  { code: "MXN", symbol: "$" },
  { code: "BRL", symbol: "R$" },
  { code: "MYR", symbol: "RM" },
  { code: "THB", symbol: "฿" },
  { code: "TWD", symbol: "NT$" },
  { code: "ZAR", symbol: "R" },
  { code: "PLN", symbol: "zł" },
] as const;

export type CurrencyCode = (typeof CURRENCIES)[number]["code"];
