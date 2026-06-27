/**
 * Utilities for mapping weekdays across UI, plans, and database records.
 */

export const dayMap: Record<string, number> = {
  L: 1,
  M: 2,
  Mi: 3,
  J: 4,
  V: 5,
  S: 6,
  D: 7,
};

export const dayNames: Record<string, string> = {
  L: "Lunes",
  M: "Martes",
  Mi: "Miercoles",
  J: "Jueves",
  V: "Viernes",
  S: "Sabado",
  D: "Domingo",
};

export const dayNamesShort: Record<number, string> = {
  1: "L",
  2: "M",
  3: "Mi",
  4: "J",
  5: "V",
  6: "S",
  0: "D",
};

export const dayNumberToName: Record<number, string> = {
  1: "Lunes",
  2: "Martes",
  3: "Miercoles",
  4: "Jueves",
  5: "Viernes",
  6: "Sabado",
  0: "Domingo",
  7: "Domingo",
};

export function planDayToName(dayNum: number): string {
  const mapping: Record<number, string> = {
    1: "Lunes",
    2: "Martes",
    3: "Miercoles",
    4: "Jueves",
    5: "Viernes",
    6: "Sabado",
    7: "Domingo",
  };

  return mapping[dayNum] || `Dia ${dayNum}`;
}

export function planDayToShort(dayNum: number): string {
  const mapping: Record<number, string> = {
    1: "L",
    2: "M",
    3: "Mi",
    4: "J",
    5: "V",
    6: "S",
    7: "D",
  };

  return mapping[dayNum] || `${dayNum}`;
}

export function getDateDayName(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const dayOfWeek = d.getDay();
  return dayNumberToName[dayOfWeek] || "Desconocido";
}

export function getDateDayShort(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const dayOfWeek = d.getDay();
  return dayNamesShort[dayOfWeek] || "?";
}
