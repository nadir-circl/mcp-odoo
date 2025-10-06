export const STAGES = {
  NEW: 25,
  IN_PROGRESS: 26,
  WAITING_ON_CUSTOMER: 35,
  SOLVED: 27
} as const;

export const CATEGORY_DB_VALUES = {
  "Product/Service Issues & Requests": "product_issue",
  "Billing & Subscription Issues": "billing_issue",
  "General Inquiries & Admin Issues": "general_inq",
  "Incident Reports": "theft_or_acc",
  "Subscription Cancellation": "subscription_issue"
} as const;

export type CategoryName = keyof typeof CATEGORY_DB_VALUES;

export function toCategoryDbValue(name: string): string | null {
  const key = Object.keys(CATEGORY_DB_VALUES).find(k => k.toLowerCase() === name.toLowerCase());
  return key ? CATEGORY_DB_VALUES[key as CategoryName] : null;
}

export function fromCategoryDbValue(dbValue: string | null | undefined): string | null {
  if (!dbValue) return null;
  const entry = Object.entries(CATEGORY_DB_VALUES).find(([, value]) => value === dbValue);
  return entry ? entry[0] : null;
}
