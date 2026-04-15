/**
 * Live EUR exchange rates via frankfurter.app (free, no key required).
 * Rates are cached for the calendar day to avoid hammering the API.
 */
const axios = require("axios");

let _cache = null;   // { date: "YYYY-MM-DD", rates: { USD: x, INR: y, … } }

async function getRates() {
  const today = new Date().toISOString().slice(0, 10);
  if (_cache && _cache.date === today) return _cache.rates;

  try {
    // Returns rates FROM EUR to all major currencies
    const res = await axios.get("https://api.frankfurter.app/latest?from=EUR", { timeout: 8000 });
    _cache = { date: today, rates: res.data.rates };
    console.log(`[forex] rates refreshed for ${today} (${Object.keys(_cache.rates).length} currencies)`);
    return _cache.rates;
  } catch (err) {
    console.warn("[forex] failed to fetch rates:", err.message);
    // Return stale cache if available, otherwise empty (will fallback to 1:1)
    return _cache ? _cache.rates : {};
  }
}

/**
 * Convert `amount` in `fromCurrency` to EUR.
 * If fromCurrency is already EUR (or unknown), returns amount as-is.
 */
async function toEUR(amount, fromCurrency) {
  if (!fromCurrency || fromCurrency.toUpperCase() === "EUR") return amount;
  const rates = await getRates();
  // rates[X] = how many X per 1 EUR  →  EUR = amount / rates[X]
  const rate = rates[fromCurrency.toUpperCase()];
  if (!rate) {
    console.warn(`[forex] no rate for ${fromCurrency}, returning original amount`);
    return amount;
  }
  return amount / rate;
}

module.exports = { toEUR, getRates };
