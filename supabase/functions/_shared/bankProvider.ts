// _shared/bankProvider.ts
// Bank provider interface + factory.
// Add real providers (Marqeta, Lithic, Stripe Issuing…) here later.
// For now only "mock" is available.

import { MockProvider } from "./mockProvider.ts";

export interface IssueCardParams {
  orgId: string;
  holderId: string;
  cardName: string;
  cardType: "virtual" | "physical";
  spendingLimitCents: number; // always in cents
  spendPeriod: "daily" | "monthly";
  walletId?: string;
  allowedCategoryIds?: string[];
  allowedCountries?: string[];
}

export interface CardProviderResult {
  providerCardId: string;
  lastFour: string;
  expiryMonth: number;
  expiryYear: number;
}

export interface BankProvider {
  readonly name: string;
  issueCard(params: IssueCardParams): Promise<CardProviderResult>;
  freezeCard(providerCardId: string): Promise<void>;
  unfreezeCard(providerCardId: string): Promise<void>;
  updateLimit(providerCardId: string, limitCents: number): Promise<void>;
  cancelCard(providerCardId: string): Promise<void>;
}

export function getBankProvider(provider = "mock"): BankProvider {
  switch (provider) {
    case "mock":
      return new MockProvider();
    default:
      throw new Error(`Unknown bank provider: "${provider}". Valid: mock`);
  }
}
