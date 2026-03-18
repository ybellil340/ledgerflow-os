// Frankfurter API: free, no API key, historical rates available
// https://www.frankfurter.app/docs

export async function getFxRate(
  from: string,
  to: string,
  date: string // YYYY-MM-DD
): Promise<number> {
  if (!from || !to || from === to) return 1;
  
  // Frankfurter doesn't support TND or some exotic currencies - fallback to 1
  const supported = ["EUR","USD","GBP","JPY","AUD","CAD","CHF","CNY","SEK","NOK","DKK","NZD","MXN","SGD","HKD","KRW","TRY","INR","BRL","ZAR","PLN","CZK","HUF","ILS","AED","SAR","MYR","PHP","THB","IDR"];
  if (!supported.includes(from) || !supported.includes(to)) {
    // Fallback: try anyway, return 1 if fails
    try {
      const res = await fetch(`https://api.frankfurter.app/${date}?from=${from}&to=${to}`);
      if (!res.ok) return 1;
      const data = await res.json();
      return data.rates?.[to] ?? 1;
    } catch { return 1; }
  }

  try {
    const res = await fetch(`https://api.frankfurter.app/${date}?from=${from}&to=${to}`);
    if (!res.ok) return 1;
    const data = await res.json();
    return data.rates?.[to] ?? 1;
  } catch {
    return 1;
  }
}
