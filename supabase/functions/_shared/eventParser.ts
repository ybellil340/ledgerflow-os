// supabase/functions/_shared/eventParser.ts
// Provider-agnostic event normalizer.
// Phase A patch: adds transaction.declined, card.updated, account.updated.
// Add a new `case "railsr":` / `case "stripe":` block when onboarding a real provider.

export type TxStatus =
  | "pending"
  | "authorized"
  | "cleared"
  | "settled"
  | "failed"
  | "reversed"
  | "disputed";

export interface NormalizedEvent {
  eventClass:
    | "transaction.authorized"
    | "transaction.cleared"
    | "transaction.settled"
    | "transaction.failed"
    | "transaction.reversed"
    | "transaction.disputed"
    | "transaction.declined"       // Phase A: declined = failed at authorization stage
    | "card.frozen_by_provider"
    | "card.unfrozen_by_provider"
    | "card.limit_breach"
    | "card.updated"               // Phase A: spend limit or status change on card
    | "account.updated"            // Phase A: account-level status / balance change
    | "unknown";

  // Transaction fields
  txStatus: TxStatus | null;
  providerTxId: string | null;
  amountCents: number | null;
  currency: string | null;
  merchantName: string | null;
  merchantMcc: string | null;

  // Card fields
  providerCardId: string | null;
  newLimitCents: number | null;    // Phase A: populated for card.updated events

  // Account fields (Phase A)
  providerAccountId: string | null;
  accountStatus: string | null;    // Phase A: new account status string

  // Shared
  eventTimestamp: string | null;
}

// ── Mock provider ─────────────────────────────────────────────────────────────

function parseMock(payload: Record<string, unknown>): NormalizedEvent {
  const type = payload["type"] as string | undefined;

  const base: Partial<NormalizedEvent> = {
    providerTxId:      payload["provider_tx_id"]      as string ?? null,
    providerCardId:    payload["provider_card_id"]     as string ?? null,
    providerAccountId: payload["provider_account_id"]  as string ?? null,
    amountCents:       typeof payload["amount_cents"] === "number"
                         ? payload["amount_cents"] as number
                         : null,
    currency:          payload["currency"]             as string ?? "EUR",
    merchantName:      payload["merchant_name"]        as string ?? null,
    merchantMcc:       payload["merchant_mcc"]         as string ?? null,
    newLimitCents:     typeof payload["new_limit_cents"] === "number"
                         ? payload["new_limit_cents"] as number
                         : null,
    accountStatus:     payload["account_status"]       as string ?? null,
    eventTimestamp:    payload["timestamp"]            as string ?? new Date().toISOString(),
  };

  switch (type) {
    // ── Transaction lifecycle ─────────────────────────────────────────────────
    case "mock.transaction.authorized":
      return { ...base, eventClass: "transaction.authorized", txStatus: "authorized" } as NormalizedEvent;

    case "mock.transaction.cleared":
      return { ...base, eventClass: "transaction.cleared",    txStatus: "cleared" }    as NormalizedEvent;

    case "mock.transaction.settled":
      return { ...base, eventClass: "transaction.settled",    txStatus: "settled" }    as NormalizedEvent;

    case "mock.transaction.failed":
      return { ...base, eventClass: "transaction.failed",     txStatus: "failed" }     as NormalizedEvent;

    case "mock.transaction.reversed":
      return { ...base, eventClas: "transaction.reversed",   txStatus: "reversed" }   as NormalizedEvent;

    case "mock.transaction.disputed":
      return { ...base, eventClass: "transaction.disputed",   txStatus: "disputed" }   as NormalizedEvent;

    // Phase A: declined = authorization refused → maps to failed status
    case "mock.transaction.declined":
      return { ...base, eventClass: "transaction.declined",   txStatus: "failed" }     as NormalizedEvent;

    // ── Card events ───────────────────────────────────────────────────────────
    case "mock.card.limit_breach":
      return { ...base, eventClass: "card.limit_breach",          txStatus: null }     as NormalizedEvent;

    case "mock.card.frozen_by_provider":
      return { ...base, eventClass: "card.frozen_by_provider",    txStatus: null }     as NormalizedEvent;

    case "mock.card.unfrozen_by_provider":
      return { ...base, eventClass: "card.unfrozen_by_provider",  txStatus: null }     as NormalizedEvent;

    // Phase A: limit or metadata change on an existing card
    case "mock.card.updated":
      return { ...base, eventClass: "card.updated",               txStatus: null }     as NormalizedEvent;

    // Phase A: account-level status / balance event
    case "mock.account.updated":
      return { ...base, eventClass: "account.updated",             txStatus: null }     as NormalizedEvent;

    default:
      return { ...base, eventClass: "unknown",                    txStatus: null }     as NormalizedEvent;
  }
}

// ── Public entry point ────────────────────────────────────────────────────────

export function parseWebhookEvent(
  provider: string,
  payload: Record<string, unknown>
): NormalizedEvent {
  switch (provider) {
    case "mock":
      return parseMock(payload);
    // case "railsr":  return parseRailsr(payload);
    // case "stripe":  return parseStripe(payload);
    default:
      return {
        eventClass:        "unknown",
        txStatus:          null,
        providerTxId:      null,
        providerCardId:    null,
        providerAccountId: null,
        amountCents:       null,
        currency:          null,
        merchantName:      null,
        merchantMcc:       null,
        newLimitCents:     null,
        accountStatus:     null,
        eventTimestamp:    null,
      };
  }
}
