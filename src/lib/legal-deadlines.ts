/**
 * Motor de prazos jurídicos (CPC art. 219, 183, 186, 180, 220).
 *
 * Regras:
 *  - Contagem em dias úteis (sábados, domingos e feriados não contam).
 *  - Início do prazo: começa a correr no 1º dia útil seguinte à intimação.
 *  - Suspensão forense: 20/12 a 20/01 (CPC art. 220) — não corre prazo.
 *  - Dobra de prazo (is_double_term=true): Fazenda Pública, Ministério Público,
 *    Defensoria Pública (CPC art. 183/186/180).
 *  - Feriados nacionais (lei 662/49 + 6.802/80 + 10.607/02) e Páscoa móvel.
 */

// ------- Feriados ----------------------------------------------------------

function easterSunday(year: number): Date {
  // Algoritmo de Meeus/Jones/Butcher
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function addDays(d: Date, days: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + days);
  return out;
}

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

const holidayCache = new Map<number, Set<string>>();

function getHolidays(year: number): Set<string> {
  const cached = holidayCache.get(year);
  if (cached) return cached;

  const easter = easterSunday(year);
  const carnavalTue = addDays(easter, -47);
  const carnavalMon = addDays(easter, -48);
  const goodFriday = addDays(easter, -2);
  const corpusChristi = addDays(easter, 60);

  const fixed: [number, number][] = [
    [1, 1], // Confraternização
    [4, 21], // Tiradentes
    [5, 1], // Dia do Trabalho
    [9, 7], // Independência
    [10, 12], // N. Sra. Aparecida
    [11, 2], // Finados
    [11, 15], // Proclamação da República
    [11, 20], // Consciência Negra (lei 14.759/23)
    [12, 25], // Natal
  ];

  const set = new Set<string>();
  for (const [m, d] of fixed) set.add(ymd(new Date(year, m - 1, d)));
  set.add(ymd(carnavalMon));
  set.add(ymd(carnavalTue));
  set.add(ymd(goodFriday));
  set.add(ymd(corpusChristi));

  holidayCache.set(year, set);
  return set;
}

// ------- Suspensão forense (CPC 220) ---------------------------------------

function isRecessoForense(d: Date): boolean {
  const m = d.getMonth() + 1;
  const day = d.getDate();
  // 20/12 a 31/12 OU 01/01 a 20/01
  return (m === 12 && day >= 20) || (m === 1 && day <= 20);
}

// ------- Núcleo ------------------------------------------------------------

export function isBusinessDay(d: Date): boolean {
  const dow = d.getDay();
  if (dow === 0 || dow === 6) return false;
  if (isRecessoForense(d)) return false;
  if (getHolidays(d.getFullYear()).has(ymd(d))) return false;
  return true;
}

/**
 * Adiciona N dias úteis a partir de `start`.
 * O 1º dia útil seguinte conta como dia 1.
 */
export function addBusinessDays(start: Date | string, days: number, doubleterm = false): Date {
  const d = typeof start === "string" ? new Date(start + "T00:00:00") : new Date(start);
  const total = doubleterm ? days * 2 : days;
  let added = 0;
  while (added < total) {
    d.setDate(d.getDate() + 1);
    if (isBusinessDay(d)) added++;
  }
  return d;
}

export function businessDaysBetween(from: Date, to: Date): number {
  if (to < from) return -businessDaysBetween(to, from);
  const a = new Date(from);
  a.setHours(0, 0, 0, 0);
  const b = new Date(to);
  b.setHours(0, 0, 0, 0);
  let count = 0;
  while (a < b) {
    a.setDate(a.getDate() + 1);
    if (isBusinessDay(a)) count++;
  }
  return count;
}

// ------- Alerta D-N --------------------------------------------------------

export type AlertLevel = "overdue" | "d1" | "d3" | "d5" | "ok";

export function getAlertLevel(dueDate: Date | string): AlertLevel {
  const due = typeof dueDate === "string" ? new Date(dueDate + "T00:00:00") : new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (due < today) return "overdue";
  const remaining = businessDaysBetween(today, due);
  if (remaining <= 1) return "d1";
  if (remaining <= 3) return "d3";
  if (remaining <= 5) return "d5";
  return "ok";
}

export function alertLabel(level: AlertLevel): string {
  return {
    overdue: "Atrasado",
    d1: "Vence amanhã",
    d3: "D-3",
    d5: "D-5",
    ok: "No prazo",
  }[level];
}

export function alertToneClass(level: AlertLevel): string {
  return {
    overdue: "bg-rose-500/15 text-rose-600 border-rose-500/30",
    d1: "bg-rose-500/10 text-rose-600 border-rose-500/20",
    d3: "bg-amber-500/10 text-amber-600 border-amber-500/20",
    d5: "bg-amber-500/10 text-amber-700 border-amber-500/20",
    ok: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  }[level];
}
