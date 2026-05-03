const axios = require("axios");
const { buildDashboard } = require("./dashboard");

const OPENROUTER_BASE = "https://openrouter.ai/api/v1";
const MODEL = "anthropic/claude-3.5-sonnet";

function fmtEur(n) {
  return "€" + Math.round(Number(n) || 0).toLocaleString("pt-PT");
}

function buildContext(data) {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  const overdueItems = [];
  let largestOverdueClient = "—";
  let largestOverdueAmount = 0;
  for (const m of months) {
    for (const it of data.billed?.[m]?.items || []) {
      if (it.is_overdue) {
        overdueItems.push(`${it.client} ${fmtEur(it.amount)}`);
        if (it.amount > largestOverdueAmount) {
          largestOverdueAmount = it.amount;
          largestOverdueClient = it.client;
        }
      }
    }
  }

  const upcomingRenewals = (data.licence_pipeline?.annual_licences || [])
    .sort((a, b) => new Date(a.renewal_date) - new Date(b.renewal_date))
    .slice(0, 6)
    .map((l) => `${l.client} ${fmtEur(l.amount)} (${l.month})`);

  const monthlyActuals = months
    .slice(0, new Date().getMonth() + 1)
    .map((m) => `${m} ${fmtEur(data.paid?.[m]?.total || 0)}`)
    .join(", ");

  const planYtd = 20833 * (new Date().getMonth() + 1);
  const variance = (data.ytd_paid || 0) - planYtd;

  return {
    paid_total: fmtEur(data.ytd_paid || 0),
    billed_total: fmtEur(data.totals?.billed || 0),
    so_total: fmtEur(data.totals?.so_pending || 0),
    largest_overdue_client: largestOverdueClient,
    largest_overdue_amount: fmtEur(largestOverdueAmount),
    upcoming_renewals: upcomingRenewals.join(", ") || "nenhuma próxima",
    overdue_items: overdueItems.slice(0, 5).join(", ") || "nenhum",
    plan_ytd: fmtEur(planYtd),
    variance: fmtEur(variance),
    monthly_actuals: monthlyActuals,
    fixed_total: fmtEur(3071),
    fixed_base: fmtEur(1957),
    forecast_total: fmtEur(
      (data.totals?.paid || 0) +
        (data.totals?.billed || 0) +
        (data.totals?.so_pending || 0) +
        (data.totals?.licence_pipeline || 0)
    ),
  };
}

function buildActionsPrompt(ctx, date) {
  return `És um assistente financeiro a falar directamente com o Nuno Barreto, fundador da Transformatiive Lda, uma consultora Zoho portuguesa. Hoje é ${date}. Meta anual: €250.000.

SITUAÇÃO FINANCEIRA ACTUAL:
- Recebido YTD: ${ctx.paid_total}
- Faturado / por receber: ${ctx.billed_total} (maior: ${ctx.largest_overdue_client} ${ctx.largest_overdue_amount} em atraso)
- SOs abertas por faturar: ${ctx.so_total}
- Recorrentes mensais: HiFly €522, Unicenter €447, Yourbranding €87, ART €100
- Renovações grandes: ${ctx.upcoming_renewals}
- Cobranças em atraso: ${ctx.overdue_items}

CONTEXTO: As licenças Zoho são sempre refaturadas com 18% de margem garantida — não são um risco de margem. O risco é de timing de cashflow (paga ao Zoho antes de receber do cliente). Não mencionar licenças como problema de margem.

Fala directamente com o Nuno em português (tu). Dá 3-4 pontos concretos e accionáveis para esta semana. Foca no que está em risco, o que precisa de atenção imediata, e as 2-3 prioridades máximas para atingir €250k. Usa valores em euros. Sem conselhos genéricos. Sem introduções ou conclusões — vai directo aos pontos.`;
}

function buildPLPrompt(ctx, date) {
  return `És um assistente financeiro a falar directamente com o Nuno Barreto, fundador da Transformatiive Lda. Hoje é ${date}. Meta anual: €250.000.

RESUMO P&L:
- Recebido YTD: ${ctx.paid_total} vs plano ${ctx.plan_ytd} — variância: ${ctx.variance}
- Actuals por mês: ${ctx.monthly_actuals}
- Custos fixos/mês: ${ctx.fixed_total} (salário €1.114 + overhead ${ctx.fixed_base})
- Picos de saídas: IVA Q1 em Maio, IRC €5.300 em Maio, auto €8.000 em Junho
- Novembro: Leasys PT €67.449 receita, custo reseller ~€57k — cashflow exige ter esse capital antes de receber, mas margem de 18% é garantida
- Previsão receita total: ~${ctx.forecast_total}

CONTEXTO: As licenças Zoho são pass-through com 18% de margem garantida. O risco é exclusivamente de cashflow (timing). Focar nos riscos reais: ritmo de serviços, cashflow em Maio-Junho, gap para €250k, exposição de cashflow em Novembro.

Fala directamente com o Nuno em português (tu). Dá 3-4 pontos sobre meses de risco de cashflow, se a meta €250k é realista e o que precisas de fazer. Usa valores concretos. Sem introduções ou conclusões — vai directo aos pontos. Sem conselhos genéricos.`;
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
    res.write(`data: ${JSON.stringify({ text: "⚠ OPENROUTER_API_KEY não configurada em Replit Secrets." })}\n\n`);
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
