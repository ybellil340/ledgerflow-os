// supabase/functions/_shared/eventParser.ts
// Provider-agnostic event normalizer.
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
    | "card.frozen_by_provider"
    | "card.unfrozen_by_provider"
    | "card.limit_breach"
    | "unknown";
  txStatus: TxStatus | null;
  providerTxId: string | null;
  providerCardId: string | null;
  amountCents: number | null;
  currency: string | null;
  merchantName: string | null;
  merchantMcc: string | null;
  eventTimestamp: string | null;
}

function parseMock(payload: Record<string, unknown>): NormalizedEvent {
  const type = payload["type"] as string | undefined;
  const base: Partial<NormalizedEvent> = {
    providerTxId:   payload["provider_tx_id"] as string ?? null,
    providerCardId: payload["provider_card_id"] as string ?? null,
    amountCents:    typeof payload["amount_cents"] === "number" ? payload["amount_cents"] : null,
    currency:       payload["currency"] as string ?? "EUR",
    merchantName:   payload["merchant_name"] as string ?? null,
    merchantMcc:    payload["merchant_mcc"] as string ?? null,
    eventTimestamp: payload["timestamp"] as string ?? new Date().toISOString(),
  };
  switch (type) {
    case "mock.transaction.authorized":
      return { ...base, eventClass: "transaction.authorized", txStatus: "authorized" } as NormalizedEvent;
    case "mock.transaction.cleared":
      return { ...base, eventClass: "transaction.cleared",    txStatus: "cleared"    } as NormalizedEvent;
    case "mock.transaction.settled":
      return { ...base, eventClass: "transaction.settled",    txStatus: "settled"    } as NormalizedEvent;
    case "mock.transaction.failed":
      return { ...base, eventClass: "transaction.failed",     txStatus: "failed"     } as NormalizedEvent;
    case "mock.transaction.reversed":
      return { ...base, eventClass: "transaction.reversed",   txStatus: "reversed"   } as NormalizedEvent;
    case "mock.card.limit_breach":
      return { ...base, eventClass: "card.limit_breach",      txStatus: null         } as NormalizedEvent;
    default:
      return { ...base, eventClass: "unknown",                txStatus: null         } as NormalizedEvent;
  }
}

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
        eventClass: "unknown", txStatus: null, providerTxId: null,
        providerCardId: null, amountCents: null, currency: null,
        merchantName: null, merchantMcc: null, eventTimestamp: null,
      };
  }
}
