import { supabase } from "@/integrations/supabase/client";

const VAT_CODES = [
  { code: "USt0", description: "Steuerfreie Umsätze (0%)", rate: 0 },
  { code: "USt7", description: "Ermäßigter Steuersatz (7%)", rate: 7 },
  { code: "USt19", description: "Regelsteuersatz (19%)", rate: 19 },
];

const EXPENSE_CATEGORIES = [
  { name: "Reisekosten", code: "TRAVEL" },
  { name: "Büromaterial", code: "OFFICE" },
  { name: "Software & IT", code: "SOFTWARE" },
  { name: "Marketing & Werbung", code: "MARKETING" },
  { name: "Bewirtung", code: "MEALS" },
  { name: "Telefon & Internet", code: "TELECOM" },
  { name: "Fortbildung", code: "TRAINING" },
  { name: "Fahrzeugkosten", code: "VEHICLE" },
  { name: "Versicherungen", code: "INSURANCE" },
  { name: "Sonstiges", code: "OTHER" },
];

// SKR04 — condensed standard accounts
const SKR04_ACCOUNTS = [
  // Anlage- und Kapitalkonten (0)
  { account_number: "0100", name: "Grundstücke und Gebäude", account_type: "asset" },
  { account_number: "0200", name: "Technische Anlagen und Maschinen", account_type: "asset" },
  { account_number: "0300", name: "Andere Anlagen, Betriebs- und Geschäftsausstattung", account_type: "asset" },
  { account_number: "0400", name: "Finanzanlagen", account_type: "asset" },
  { account_number: "0500", name: "Immaterielle Vermögensgegenstände", account_type: "asset" },
  // Umlaufvermögen (1)
  { account_number: "1000", name: "Kasse", account_type: "asset" },
  { account_number: "1200", name: "Bank", account_type: "asset" },
  { account_number: "1400", name: "Forderungen aus Lieferungen und Leistungen", account_type: "asset" },
  { account_number: "1500", name: "Sonstige Vermögensgegenstände", account_type: "asset" },
  { account_number: "1600", name: "Vorsteuer", account_type: "asset" },
  { account_number: "1700", name: "Vorsteuer nach § 13b UStG", account_type: "asset" },
  // Eigenkapital (2)
  { account_number: "2000", name: "Gezeichnetes Kapital", account_type: "equity" },
  { account_number: "2100", name: "Kapitalrücklage", account_type: "equity" },
  { account_number: "2900", name: "Jahresüberschuss/Jahresfehlbetrag", account_type: "equity" },
  // Verbindlichkeiten (3)
  { account_number: "3000", name: "Verbindlichkeiten aus Lieferungen und Leistungen", account_type: "liability" },
  { account_number: "3100", name: "Verbindlichkeiten gegenüber Kreditinstituten", account_type: "liability" },
  { account_number: "3300", name: "Sonstige Verbindlichkeiten", account_type: "liability" },
  { account_number: "3400", name: "Erhaltene Anzahlungen", account_type: "liability" },
  { account_number: "3500", name: "Rückstellungen", account_type: "liability" },
  { account_number: "3800", name: "Umsatzsteuer", account_type: "liability" },
  // Erlöse (4)
  { account_number: "4000", name: "Umsatzerlöse Inland", account_type: "revenue" },
  { account_number: "4100", name: "Umsatzerlöse EU", account_type: "revenue" },
  { account_number: "4200", name: "Umsatzerlöse Drittland", account_type: "revenue" },
  { account_number: "4300", name: "Sonstige betriebliche Erträge", account_type: "revenue" },
  { account_number: "4400", name: "Erträge aus Beteiligungen", account_type: "revenue" },
  { account_number: "4500", name: "Zinserträge", account_type: "revenue" },
  // Materialaufwand (5)
  { account_number: "5000", name: "Wareneinkauf", account_type: "expense" },
  { account_number: "5100", name: "Fremdleistungen", account_type: "expense" },
  { account_number: "5200", name: "Bezugsnebenkosten", account_type: "expense" },
  // Personalkosten (6)
  { account_number: "6000", name: "Löhne und Gehälter", account_type: "expense" },
  { account_number: "6100", name: "Soziale Abgaben", account_type: "expense" },
  { account_number: "6200", name: "Altersversorgung", account_type: "expense" },
  // Sonstige betriebliche Aufwendungen (6-7)
  { account_number: "6300", name: "Abschreibungen", account_type: "expense" },
  { account_number: "6400", name: "Miete und Raumkosten", account_type: "expense" },
  { account_number: "6500", name: "Versicherungen", account_type: "expense" },
  { account_number: "6600", name: "Reparaturen und Instandhaltung", account_type: "expense" },
  { account_number: "6700", name: "Reisekosten", account_type: "expense" },
  { account_number: "6800", name: "Porto und Telefon", account_type: "expense" },
  { account_number: "6810", name: "Bürobedarf", account_type: "expense" },
  { account_number: "6820", name: "Rechts- und Beratungskosten", account_type: "expense" },
  { account_number: "6830", name: "Werbekosten", account_type: "expense" },
  { account_number: "6850", name: "Bewirtungskosten (70%)", account_type: "expense" },
  { account_number: "6855", name: "Bewirtungskosten (nicht abzugsfähig)", account_type: "expense" },
  { account_number: "6900", name: "Sonstige betriebliche Aufwendungen", account_type: "expense" },
  // Zinsaufwand (7)
  { account_number: "7000", name: "Zinsaufwendungen", account_type: "expense" },
  { account_number: "7100", name: "Sonstige Zinsen und ähnliche Aufwendungen", account_type: "expense" },
  // Steuern (7)
  { account_number: "7600", name: "Körperschaftsteuer", account_type: "expense" },
  { account_number: "7610", name: "Solidaritätszuschlag", account_type: "expense" },
  { account_number: "7620", name: "Gewerbesteuer", account_type: "expense" },
];

export async function seedGermanDefaults(orgId: string): Promise<{ success: boolean; message: string }> {
  try {
    // Seed VAT codes
    const { error: vatError } = await supabase.from("vat_codes").insert(
      VAT_CODES.map((v) => ({ org_id: orgId, ...v }))
    );
    if (vatError && !vatError.message.includes("duplicate")) throw vatError;

    // Seed expense categories
    const { error: catError } = await supabase.from("expense_categories").insert(
      EXPENSE_CATEGORIES.map((c) => ({ org_id: orgId, ...c }))
    );
    if (catError && !catError.message.includes("duplicate")) throw catError;

    // Seed chart of accounts (SKR04)
    const { error: coaError } = await supabase.from("chart_of_accounts").insert(
      SKR04_ACCOUNTS.map((a) => ({ org_id: orgId, ...a }))
    );
    if (coaError && !coaError.message.includes("duplicate")) throw coaError;

    return { success: true, message: "3 VAT codes, 10 expense categories, and 42 SKR04 accounts created." };
  } catch (err: any) {
    return { success: false, message: err.message };
  }
}
