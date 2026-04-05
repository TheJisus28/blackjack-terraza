export const CHIP_VALUES = [10, 25, 50, 100, 250, 500];

export const CHIP_COLORS: Record<number, string> = {
  10: "from-blue-500 to-blue-700 border-blue-300",
  25: "from-green-500 to-green-700 border-green-300",
  50: "from-red-500 to-red-700 border-red-300",
  100: "from-gray-800 to-gray-950 border-gray-500",
  250: "from-purple-500 to-purple-700 border-purple-300",
  500: "from-amber-500 to-amber-700 border-amber-300",
};

/** Teclas 1–6 = fichas (misma fila que apuesta normal) */
export const KEY_TO_CHIP: Record<string, number> = {
  "1": 10,
  "2": 25,
  "3": 50,
  "4": 100,
  "5": 250,
  "6": 500,
};
