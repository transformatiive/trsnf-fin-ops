module.exports = {
  annual_goal: 250000,
  fiscal_year: 2026,

  fixed_costs: {
    "Leasys Renting": 616,
    "Credibom": 341,
    "Via Verde": 79,
    "Tesla": 10,
    "NBiz": 369,
    "Comissões": 65,
    "Generali": 130,
    "AI/LLM": 128,
    "Dev Infra": 110,
    "SaaS": 101,
    "Moloni": 62,
    "Subscrições": 45,
    "Iberdrola": 15,
  },
  salary: 1114, // starts Feb (Jan excluded)

  iva_rate: 0.18, // effective VAT rate (23% out - 5% in)
  irc_rate: 0.21, // corporate tax rate

  one_off_costs: {
    May: [
      { label: "IRC — Pagamento Por Conta", amount: 5300 },
    ],
    Jun: [
      { label: "Financiamento auto (entrada)", amount: 8000 },
    ],
  },

  zoho_licence_margin: 1.18,

  monthly_clients: [
    { key: "hifly", client: "Hi Fly", service: "One", monthly: 522.5, start: "Jan" },
    { key: "unicenter", client: "Unicenter (Bigin)", service: "Bigin", monthly: 447.03, start: "Jan" },
    { key: "yourbranding", client: "Yourbranding", service: "One", monthly: 87.08, start: "Apr" },
    { key: "art", client: "Automated RT", service: "FSM", monthly: 100.0, start: "Jan" },
  ],
};
