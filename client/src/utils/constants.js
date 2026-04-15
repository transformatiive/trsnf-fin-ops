export const C = {
  bg: "#f7f6f3",
  surface: "#ffffff",
  border: "#e5e2db",
  borderStrong: "#c8c4bc",
  text: "#1a1a1a",
  muted: "#6b6760",
  faint: "#9e9b95",
  green: "#15803d",
  greenLight: "#dcfce7",
  greenText: "#166534",
  greenBorder: "#86efac",
  blue: "#2563eb",
  blueLight: "#dbeafe",
  blueText: "#1d4ed8",
  blueBorder: "#93c5fd",
  amber: "#d97706",
  amberLight: "#fef9c3",
  amberText: "#854d0e",
  amberBorder: "#fcd34d",
  red: "#dc2626",
  redLight: "#fef2f2",
  purple: "#7c3aed",
  purpleLight: "#f5f3ff",
  orange: "#ea580c",
};

export const ST = {
  paid: { bg: C.greenLight, fg: C.greenText, border: C.greenBorder, label: "Pago" },
  billed: { bg: C.blueLight, fg: C.blueText, border: C.blueBorder, label: "Faturado" },
  pending: { bg: C.amberLight, fg: C.amberText, border: C.amberBorder, label: "Pendente" },
  none: { bg: "transparent", fg: C.faint, border: "transparent", label: "—" },
};

export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const MONTHS_PT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export const SECTION_COLORS = {
  paid: { bg: C.greenLight, border: C.greenBorder, text: C.greenText, label: "Pago" },
  billed: { bg: C.blueLight, border: C.blueBorder, text: C.blueText, label: "Faturado / Por Pagar" },
  so: { bg: C.amberLight, border: C.amberBorder, text: C.amberText, label: "SOs Por Faturar" },
  licences: { bg: C.amberLight, border: C.amberBorder, text: C.amberText, label: "Licenças Pipeline" },
};
