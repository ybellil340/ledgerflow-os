// src/lib/cardActions.ts
// Frontend wrappers for card edge functions.
// All card mutations MUST go through here — never direct supabase.from("cards").insert().

import { supabase } from "@/integrations/supabase/client";

export interface IssueCardParams {
  orgId: string;
  holderId?: string;
  cardName: string;
  cardType?: "virtual" | "physical";
  spendingLimit?: number;
  spendPeriod?: "daily" | "monthly";
  walletId?: string;
  allowedCategoryIds?: string[];
  allowedCountries?: string[];
}

export async function issueCard(params: IssueCardParams) {
  const { data, error } = await supabase.functions.invoke("card-issue", { body: params });
  if (error) throw error;
  return data as { card: Record<string, unknown> };
}

export async function freezeCard(cardId: string, orgId: string) {
  const { data, error } = await supabase.functions.invoke("card-freeze", {
    body: { cardId, orgId },
  });
  if (error) throw error;
  return data as { cardId: string; status: string };
}

export async function unfreezeCard(cardId: string, orgId: string) {
  const { data, error } = await supabase.functions.invoke("card-unfreeze", {
    body: { cardId, orgId },
  });
  if (error) throw error;
  return data as { cardId: string; status: string };
}

export async function updateCardLimit(
  cardId: string,
  orgId: string,
  spendingLimit: number,
  spendPeriod?: "daily" | "monthly"
) {
  const { data, error } = await supabase.functions.invoke("card-update-limit", {
    body: { cardId, orgId, spendingLimit, spendPeriod },
  });
  if (error) throw error;
  return data as { cardId: string; spendingLimit: number; spendPeriod: string };
}

export async function cancelCard(cardId: string, orgId: string) {
  const { data, error } = await supabase.functions.invoke("card-cancel", {
    body: { cardId, orgId },
  });
  if (error) throw error;
  return data as { cardId: string; status: string };
}
