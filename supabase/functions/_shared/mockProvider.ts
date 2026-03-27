// _shared/mockProvider.ts
// DEV-ONLY mock bank provider.
// Generates deterministic fake card data — no Math.random anywhere.
// Safe to use in CI/staging; never ships real PANs.

import type { BankProvider, IssueCardParams, CardProviderResult } from "./bankProvider.ts";

export class MockProvider implements BankProvider {
  readonly name = "mock";

  async issueCard(params: IssueCardParams): Promise<CardProviderResult> {
    const providerCardId = `mock_${crypto.randomUUID()}`;
    // last_four derived from UUID tail — no Math.random
    const lastFour = providerCardId.slice(-4).replace(/[^0-9]/g, "0");
    const now = new Date();
    return {
      providerCardId,
      lastFour,
      expiryMonth: now.getMonth() + 1,
      expiryYear: now.getFullYear() + 3,
    };
  }

  async freezeCard(_providerCardId: string): Promise<void> {
    // no-op: mock always succeeds
  }

  async unfreezeCard(_providerCardId: string): Promise<void> {
    // no-op
  }

  async updateLimit(_providerCardId: string, _limitCents: number): Promise<void> {
    // no-op
  }

  async cancelCard(_providerCardId: string): Promise<void> {
    // no-op
  }
}
