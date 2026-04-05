"use client";

const CHIP_DEFS = [
  { value: 500, bg: "from-amber-500 to-amber-700", border: "border-amber-300", text: "text-amber-950" },
  { value: 250, bg: "from-purple-500 to-purple-700", border: "border-purple-300", text: "text-purple-100" },
  { value: 100, bg: "from-gray-700 to-gray-900", border: "border-gray-400", text: "text-gray-200" },
  { value: 50, bg: "from-red-500 to-red-700", border: "border-red-300", text: "text-red-100" },
  { value: 25, bg: "from-green-500 to-green-700", border: "border-green-300", text: "text-green-100" },
  { value: 10, bg: "from-blue-500 to-blue-700", border: "border-blue-300", text: "text-blue-100" },
] as const;

function decompose(amount: number): { value: number; count: number }[] {
  const result: { value: number; count: number }[] = [];
  let remaining = amount;
  for (const def of CHIP_DEFS) {
    const count = Math.floor(remaining / def.value);
    if (count > 0) {
      result.push({ value: def.value, count: Math.min(count, 4) });
      remaining -= def.value * count;
    }
  }
  return result;
}

interface ChipStackProps {
  amount: number;
}

export function ChipStack({ amount }: ChipStackProps) {
  if (amount <= 0) return null;

  const chips = decompose(amount);

  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className="relative flex flex-col-reverse items-center">
        {chips.map((chip, ci) => {
          const def = CHIP_DEFS.find((d) => d.value === chip.value)!;
          return Array.from({ length: chip.count }, (_, i) => (
            <div
              key={`${chip.value}-${i}`}
              className={`w-6 h-[7px] sm:w-7 sm:h-2 lg:w-8 lg:h-2.5 rounded-full bg-gradient-to-b ${def.bg} border ${def.border}
                shadow-sm -mt-[3px] first:mt-0`}
              style={{
                zIndex: ci * 4 + i,
              }}
            />
          ));
        })}
      </div>
      <span className="text-[9px] sm:text-[10px] lg:text-xs font-bold text-yellow-300 tabular-nums drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
        ${amount}
      </span>
    </div>
  );
}
