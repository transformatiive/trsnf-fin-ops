const axios = require("axios");
const { buildDashboard } = require("./dashboard");

const OPENROUTER_BASE = "https://openrouter.ai/api/v1";
const MODEL = process.env.OPENROUTER_MODEL || "anthropic/claude-sonnet-5";

function fmtEur(n) {
  return "€" + Math.round(Number(n) || 0).toLocaleString("pt-PT");
}

function buildContext(data) {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const t = data.totals || {};

  const overdueItems = [];
  let largestOverdueClient = "—";
  let largestOverdueAmount = 0;
  for (const m of months) {
    for (const it of data.receivable?.by_due_month?.[m]?.items || []) {
      if (it.is_overdue) {
        overdueItems.push(`${it.client} ${fmtEur(it.amount)}`);
        if (it.amount > largestOverdueAmount) {
          largestOverdueAmount = it.amount;
          largestOverdueClient = it.client;
        }
      }
    }
  }

  const upcomingRenewals = (data.licence_renewals?.items || [])
    .filter((l) => !l.already_in_books)
    .sort((a, b) => new Date(a.renewal_date) - new Date(b.renewal_date))
    .slice(0, 6)
    .map((l) => `${l.client} ${fmtEur(l.amount)} (${l.month})`);

  const monthlyActuals = months
    .slice(0, new Date().getMonth() + 1)
    .map((m) => `${m} ${fmtEur(data.invoiced?.[m]?.total || 0)}`)
    .join(", ");

  // Renovações Zoho SEM SO — precisam que o Nuno gere os SOs para faturar o
  // cliente ANTES de pagar ao Zoho (risco de pagar sem ter faturado/recebido).
  const now = Date.now();
  const noSo = (data.licence_renewals?.calendar || [])
    .filter((r) => !r.is_own && !r.already_in_books && !r.is_recurring && r.client_in > 0)
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  const noSoTotal = noSo.reduce((a, r) => a + r.client_in, 0);
  const noSoZoho = noSo.reduce((a, r) => a + r.zoho_out, 0);
  const noSoList = noSo.slice(0, 8).map((r) => {
    const dd = Math.round((new Date(r.date.includes("T") ? r.date : r.date + "T00:00:00Z") - now) / 86400000);
    return `${r.client} ${fmtEur(r.client_in)} a faturar (paga Zoho ${fmtEur(r.zoho_out)} em ${r.date}, ${dd}d)`;
  });

  const planYtd = 20833 * (new Date().getMonth() + 1);
  const variance = (t.invoiced || 0) - planYtd;

  return {
    renewals_no_so_count: noSo.length,
    renewals_no_so_total: fmtEur(noSoTotal),
    renewals_no_so_zoho: fmtEur(noSoZoho),
    renewals_no_so_list: noSoList.join("; ") || "nenhuma",
    paid_total: fmtEur(t.paid || 0),
    invoiced_total: fmtEur(t.invoiced || 0),
    receivable_total: fmtEur(t.receivable || 0),
    receivable_overdue: fmtEur(t.receivable_overdue || 0),
    so_total: fmtEur(t.to_invoice || 0),
    so_services: fmtEur(t.to_invoice_services || 0),
    so_licences: fmtEur(t.to_invoice_licences || 0),
    largest_overdue_client: largestOverdueClient,
    largest_overdue_amount: fmtEur(largestOverdueAmount),
    upcoming_renewals: upcomingRenewals.join(", ") || "nenhuma próxima",
    overdue_items: overdueItems.slice(0, 5).join(", ") || "nenhum",
    plan_ytd: fmtEur(planYtd),
    variance: fmtEur(variance),
    monthly_actuals: monthlyActuals,
    expenses_total: fmtEur(t.expenses_actual || 0),
    forecast_total: fmtEur(t.forecast_billing || 0),
  };
}

function buildActionsPrompt(ctx, date) {
  return `És um assistente financeiro a falar directamente com o Nuno Barreto, fundador da Transformatiive Lda, uma consultora Zoho portuguesa. Hoje é ${date}. Meta anual: €250.000.

SITUAÇÃO FINANCEIRA ACTUAL:
- Faturado YTD: ${ctx.invoiced_total} · Recebido: ${ctx.paid_total}
- A receber (contas por cobrar): ${ctx.receivable_total} (em atraso: ${ctx.receivable_overdue}; maior: ${ctx.largest_overdue_client} ${ctx.largest_overdue_amount})
- SOs abertas por faturar: ${ctx.so_total} (serviços ${ctx.so_services} · licenças ${ctx.so_licences})
- Recorrentes mensais: HiFly €522, Unicenter €447, Yourbranding €87, ART €100
- Cobranças em atraso: ${ctx.overdue_items}

⚠️ RENOVAÇÕES ZOHO SEM SO (${ctx.renewals_no_so_count}): ${ctx.renewals_no_so_total} a faturar, mas SEM Sales Order criado. O Nuno paga ${ctx.renewals_no_so_zoho} ao Zoho nestas renovações — se não gerar os SOs e faturar o cliente ANTES, paga ao Zoho sem ter recebido. Casos: ${ctx.renewals_no_so_list}.

CONTEXTO: As licenças Zoho são sempre refaturadas com 18% de margem garantida — não são risco de margem. O risco é de timing de cashflow (paga ao Zoho antes de receber do cliente).

Fala directamente com o Nuno em português (tu). Dá 3-4 pontos concretos e accionáveis para esta semana. INCLUI SEMPRE um alerta específico sobre as renovações Zoho SEM SO acima — diz-lhe quais os SOs que tem de gerar já (por data de pagamento ao Zoho) para faturar o cliente a tempo. Foca no que está em risco e nas prioridades para €250k. Usa valores em euros. Sem introduções nem conclusões — vai directo aos pontos.`;
}

function buildPLPrompt(ctx, date) {
  return `És um assistente financeiro a falar directamente com o Nuno Barreto, fundador da Transformatiive Lda. Hoje é ${date}. Meta anual: €250.000.

RESUMO P&L:
- Faturado YTD: ${ctx.invoiced_total} vs plano ${ctx.plan_ytd} — variância: ${ctx.variance}
- Faturação por mês: ${ctx.monthly_actuals}
- Despesa real YTD (Books): ${ctx.expenses_total}
- Picos de saídas: IVA Q1 em Maio, IRC €5.300 em Maio, auto €8.000 em Junho
- Previsão receita total: ~${ctx.forecast_total}

⚠️ RENOVAÇÕES ZOHO SEM SO (${ctx.renewals_no_so_count}): ${ctx.renewals_no_so_total} a faturar sem Sales Order. Paga-se ${ctx.renewals_no_so_zoho} ao Zoho nestas — sem SO, o cliente não é faturado a tempo e paga-se ao Zoho antes de receber. Casos: ${ctx.renewals_no_so_list}.

CONTEXTO: As licenças Zoho são pass-through com 18% de margem garantida. O risco é exclusivamente de cashflow (timing). Ex.: para a renovação Leasys de Jan'27 (paga-se ~€57k ao Zoho), o SO/fatura ao cliente deve ser gerado em Nov/Dez 2026 — senão paga-se ao Zoho sem ter faturado.

Fala directamente com o Nuno em português (tu). Dá 3-4 pontos sobre meses de risco de cashflow e a meta €250k. INCLUI SEMPRE um alerta sobre as renovações Zoho SEM SO — indica quais os SOs a gerar e em que mês faturar (antes da data de pagamento ao Zoho). Usa valores concretos. Sem introduções nem conclusões.`;
}

async function streamAnalysis(req, res) {
  const tab = req.query.tab === "pl" ? "pl" : "actions";

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  if (typeof res.flushHeaders === "function") res.flushHeaders();

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    res.write(`data: ${JSON.stringify({ text: "⚠ OPENROUTER_API_KEY não configurada nas variáveis de ambiente do serviço." })}\n\n`);
    res.write("data: [DONE]\n\n");
    return res.end();
  }

  try {
    const data = await buildDashboard();
    const ctx = buildContext(data);
    const today = new Date().toLocaleDateString("pt-PT", { day: "2-digit", month: "long", year: "numeric" });
    const prompt = tab === "pl" ? buildPLPrompt(ctx, today) : buildActionsPrompt(ctx, today);

    const response = await axios({
      method: "post",
      url: `${OPENROUTER_BASE}/chat/completions`,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://transformatiive.pt",
        "X-Title": "Transformatiive Financial Dashboard",
      },
      data: {
        model: MODEL,
        max_tokens: 800,
        messages: [{ role: "user", content: prompt }],
        stream: true,
      },
      responseType: "stream",
    });

    let buf = "";
    response.data.on("data", (chunk) => {
      buf += chunk.toString();
      const lines = buf.split("\n");
      buf = lines.pop();
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data: ")) continue;
        const raw = trimmed.slice(6);
        if (raw === "[DONE]") {
          res.write("data: [DONE]\n\n");
          res.end();
          return;
        }
        try {
          const parsed = JSON.parse(raw);
          const text = parsed.choices?.[0]?.delta?.content;
          if (text) res.write(`data: ${JSON.stringify({ text })}\n\n`);
        } catch (_) {}
      }
    });

    response.data.on("end", () => {
      res.write("data: [DONE]\n\n");
      res.end();
    });

    response.data.on("error", (err) => {
      console.error("OpenRouter stream error:", err.message);
      res.write(`data: ${JSON.stringify({ text: `\n\n[Erro de stream: ${err.message}]` })}\n\n`);
      res.write("data: [DONE]\n\n");
      res.end();
    });
  } catch (err) {
    const msg = err.response?.data?.error?.message || err.message;
    console.error("Analysis error:", msg);
    res.write(`data: ${JSON.stringify({ text: `\n\n[Erro: ${msg}]` })}\n\n`);
    res.write("data: [DONE]\n\n");
    res.end();
  }
}

module.exports = { streamAnalysis };
