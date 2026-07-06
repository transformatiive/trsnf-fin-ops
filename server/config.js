module.exports = {
  annual_goal: 250000,
  fiscal_year: 2026,

  // Fixed / recurring costs. These are used as the FORECAST baseline for future
  // months (months for which we have no actual Books expenses yet) and as the
  // comparison baseline against real spend. Past/current months use real Books
  // bills+expenses instead (see server/api/dashboard.js).
  fixed_costs: [
    // Viatura (agrupado logicamente — pesa ~€1.176/mês)
    { name: "Leasys Renting", amount: 616,  frequency: "monthly", start_month: "Jan", group: "Viatura" },
    { name: "Credibom",       amount: 341,  frequency: "monthly", start_month: "Jan", group: "Viatura" },
    { name: "Via Verde",      amount: 79,   frequency: "monthly", start_month: "Jan", group: "Viatura" },
    { name: "Generali",       amount: 130,  frequency: "monthly", start_month: "Jan", group: "Viatura" },
    { name: "Tesla",          amount: 10,   frequency: "monthly", start_month: "Jan", group: "Viatura" },
    // Operação
    { name: "NBiz",           amount: 369,  frequency: "monthly", start_month: "Jan", group: "Operação" },
    { name: "AI/LLM",         amount: 128,  frequency: "monthly", start_month: "Jan", group: "Software" },
    { name: "Dev Infra",      amount: 110,  frequency: "monthly", start_month: "Jan", group: "Software" },
    { name: "SaaS",           amount: 101,  frequency: "monthly", start_month: "Jan", group: "Software" },
    { name: "Moloni",         amount: 62,   frequency: "monthly", start_month: "Jan", group: "Software" },
    { name: "Subscrições",    amount: 45,   frequency: "monthly", start_month: "Jan", group: "Software" },
    { name: "Comissões",      amount: 65,   frequency: "monthly", start_month: "Jan", group: "Operação" },
    { name: "Iberdrola",      amount: 15,   frequency: "monthly", start_month: "Jan", group: "Operação" },
  ],

  salary: 1114,
  salary_start_month: "Feb", // salário começa a ser pago em Fevereiro
  iva_rate: 0.23,            // IVA standard PT (era 0.18, corrigido)
  irc_rate: 0.21,

  one_off_costs: {
    May: [{ label: "IRC — Pagamento Por Conta", amount: 5300 }],
    Jun: [{ label: "Financiamento auto (entrada)", amount: 8000 }],
  },

  zoho_licence_margin: 1.18,

  // Palavras-chave para classificar linhas de SO/fatura como LICENÇA (o resto é
  // tratado como SERVIÇO por omissão — trabalho/consultoria não tem COGS).
  licence_keywords: [
    "zoho", "licen", "licence", "license", "subscription", "subscri", "renova",
    "renewal", "crm", "bigin", "books", "desk", "projects", "people", "recruit",
    "fsm", "analytics", "campaigns", "marketing plus", "workdrive", "sign",
    "vault", "assist", "salesiq", "creator", "one plan", "zoho one", "cliq",
    "flow", "forms", "survey", "social", "backstage", "commerce",
  ],

  // Clientes com receita recorrente contratada (avença mensal). Usados só como
  // PREVISÃO para meses futuros ainda não faturados — nunca somados a meses já
  // faturados (evita dupla contagem com o faturado real do Books).
  // licence_share = fração da avença que é licença Zoho pass-through (o resto é
  // serviço/gestão sem COGS).
  monthly_clients: [
    { key: "hifly",        client: "Hi Fly",            service: "One",   monthly: 522.5,  start: "Jan", licence_share: 1.0 },
    { key: "unicenter",    client: "Unicenter (Bigin)", service: "Bigin", monthly: 447.03, start: "Jan", licence_share: 1.0 },
    { key: "yourbranding", client: "Yourbranding",      service: "One",   monthly: 87.08,  start: "Apr", licence_share: 1.0 },
    { key: "art",          client: "Automated RT",      service: "FSM",   monthly: 100.0,  start: "Jan", licence_share: 1.0 },
  ],
};
