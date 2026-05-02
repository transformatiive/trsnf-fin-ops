module.exports = {
  annual_goal: 250000,
  fiscal_year: 2026,

  fixed_costs: [
    { name: "Leasys Renting", amount: 616,  frequency: "monthly",    start_month: "Jan" },
    { name: "Credibom",       amount: 341,  frequency: "monthly",    start_month: "Jan" },
    { name: "Via Verde",      amount: 79,   frequency: "monthly",    start_month: "Jan" },
    { name: "Tesla",          amount: 10,   frequency: "monthly",    start_month: "Jan" },
    { name: "NBiz",           amount: 369,  frequency: "monthly",    start_month: "Jan" },
    { name: "Comissões",      amount: 65,   frequency: "monthly",    start_month: "Jan" },
    { name: "Generali",       amount: 130,  frequency: "monthly",    start_month: "Jan" },
    { name: "AI/LLM",         amount: 128,  frequency: "monthly",    start_month: "Jan" },
    { name: "Dev Infra",      amount: 110,  frequency: "monthly",    start_month: "Jan" },
    { name: "SaaS",           amount: 101,  frequency: "monthly",    start_month: "Jan" },
    { name: "Moloni",         amount: 62,   frequency: "monthly",    start_month: "Jan" },
    { name: "Subscrições",    amount: 45,   frequency: "monthly",    start_month: "Jan" },
    { name: "Iberdrola",      amount: 15,   frequency: "monthly",    start_month: "Jan" },
  ],

  salary: 1114,
  iva_rate: 0.18,
  irc_rate: 0.21,

  one_off_costs: {
    May: [{ label: "IRC — Pagamento Por Conta", amount: 5300 }],
    Jun: [{ label: "Financiamento auto (entrada)", amount: 8000 }],
  },

  zoho_licence_margin: 1.18,

  monthly_clients: [
    { key: "hifly",        client: "Hi Fly",           service: "One",  monthly: 522.5,  start: "Jan" },
    { key: "unicenter",    client: "Unicenter (Bigin)", service: "Bigin",monthly: 447.03, start: "Jan" },
    { key: "yourbranding", client: "Yourbranding",      service: "One",  monthly: 87.08,  start: "Apr" },
    { key: "art",          client: "Automated RT",      service: "FSM",  monthly: 100.0,  start: "Jan" },
  ],
};
