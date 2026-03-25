// Shared TypeScript types — single source of truth
export interface Organization { id:string; name:string; base_currency:string; country:string|null; tax_id:string|null; }
export interface OrgMember { id:string; user_id:string; org_id:string; role:string; is_active:boolean; }
export interface ExpenseCategory { id:string; org_id:string; name:string; code:string; is_active:boolean; }
export interface Expense {
  id:string; org_id:string; user_id:string; title:string; description:string|null;
  amount:number; currency:string; base_amount:number|null; base_currency:string|null; fx_rate:number|null;
  expense_date:string; category_id:string|null; vat_amount:number|null; vat_rate:number|null;
  tax_registration_number:string|null; receipt_url:string|null; status:string;
  expense_categories?:ExpenseCategory|null; created_at:string; updated_at:string|null;
}
export interface ScanResult {
  merchant_name:string; amount:number; currency:string; date:string; description:string;
  category_suggestion:string; vat_amount:number; vat_rate:number; tax_registration_number:string;
}
export interface FxRateResult { rate:number; from:string; to:string; date:string; }
export interface Budget { id:string; org_id:string; name:string; amount:number; currency:string; period:string; category_id:string|null; start_date:string; end_date:string; }
export const CATEGORY_CODE_MAP: Record<string,string> = {
  "travel":"TRAVEL","software & saas":"SOFTWARE","meals & entertainment":"MEALS",
  "equipment":"EQUIPMENT","marketing":"MARKETING","office supplies":"OFFICE",
  "utilities":"TELECOM","professional services":"TRAINING","other":"OTHER",
};
export const EXPENSE_STATUSES = ["draft","submitted","approved","rejected","reimbursed"] as const;
export type ExpenseStatus = typeof EXPENSE_STATUSES[number];
