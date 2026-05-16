"use client";

import React, { useEffect, useMemo, useState } from "react";

type OutletKind = "petrol" | "diesel";
type OutletReading = {
  id: string;
  label: string;
  opening: number | "";
  closing: number | "";
  rate: number | "";
};

type DailyRecord = {
  date: string;
  shift: "day" | "night";
  petrolRate: number;
  dieselRate: number;
  petrolDip: number;
  dieselDip: number;
  petrolOutlets: OutletReading[];
  dieselOutlets: OutletReading[];
  petrolWorker?: string;
  dieselWorker?: string;
};

const PETROL_OUTLETS = ["Nozzle 1", "Nozzle 2", "Nozzle 3"];
const DIESEL_OUTLETS = ["Nozzle 1", "Nozzle 2", "Nozzle 3"];
const LOCAL_KEY = "daily-records";

const DIP_TABLE: { dip: number; volume: number; diff: number }[] = `
1,12.06,1.21
2,34.06,2.2
3,62.48,2.84
4,96.05,3.36
5,134.04,3.8
6,175.95,4.19
7,221.4,4.54
8,270.1,4.87
9,321.82,5.17
10,376.37,5.45
11,433.57,5.72
12,493.29,5.97
13,555.39,6.21
14,619.76,6.44
15,686.31,6.65
16,754.94,6.86
17,825.56,7.06
18,898.11,7.25
19,972.51,7.44
20,1048.69,7.62
21,1126.59,7.79
22,1206.17,7.96
23,1287.35,8.12
24,1370.1,8.27
25,1454.36,8.43
26,1540.1,8.57
27,1627.26,8.72
28,1715.81,8.85
29,1805.71,8.99
30,1896.92,9.12
31,1989.4,9.25
32,2083.13,9.37
33,2178.07,9.49
34,2274.18,9.61
35,2371.44,9.73
36,2469.82,9.84
37,2569.29,9.95
38,2669.82,10.05
39,2771.39,10.16
40,2873.97,10.26
41,2977.53,10.36
42,3082.06,10.45
43,3187.52,10.55
44,3293.9,10.64
45,3401.16,10.73
46,3509.3,10.81
47,3618.29,10.9
48,3728.11,10.98
49,3838.73,11.06
50,3950.15,11.14
51,4062.34,11.22
52,4175.28,11.29
53,4288.96,11.37
54,4403.37,11.44
55,4518.49,11.51
56,4634.3,11.58
57,4750.8,11.65
58,4867.95,11.72
59,4985.76,11.78
60,5104.2,11.84
61,5223.27,11.91
62,5342.95,11.97
63,5463.23,12.03
64,5584.1,12.09
65,5705.55,12.15
66,5827.56,12.2
67,5950.13,12.26
68,6073.24,12.31
69,6196.89,12.37
70,6321.07,12.42
71,6445.76,12.47
72,6570.96,12.52
73,6696.66,12.57
74,6822.84,12.62
75,6949.5,12.67
76,7076.64,12.71
77,7204.24,12.76
78,7332.3,12.81
79,7460.81,12.85
80,7589.76,12.9
81,7701.2,12.76
82,7848.9,14.77
83,7998.85,14.99
84,8151.02,15.22
85,8305.37,15.44
86,8461.89,15.65
87,8620.53,15.86
88,8781.26,16.07
89,8944.05,16.28
90,9108.86,16.48
91,9275.67,16.68
92,9444.43,16.88
93,9615.11,17.07
94,9787.68,17.26
95,9962.1,17.44
96,10138.34,17.62
97,10316.37,17.8
98,10496.14,17.98
99,10677.62,18.15
100,10860.79,18.32
`
  .trim()
  .split("\n")
  .map((line) => {
    const [dip, volume, diff] = line.split(",").map(Number);
    return { dip, volume, diff };
  });

function createInitialOutlets(labels: string[], rate: number | ""): OutletReading[] {
  return labels.map((label, idx) => ({
    id: `${label}-${idx}`,
    label,
    opening: "",
    closing: "",
    rate,
  }));
}

function calcQuantity(opening: number | "", closing: number | "") {
  if (opening === "" || closing === "") return 0;
  return Number(closing) - Number(opening);
}

function calcAmount(qty: number, rate: number | "") {
  if (rate === "") return 0;
  return +(qty * Number(rate)).toFixed(2);
}

function dipToLiters(dipValue: number | "") {
  if (dipValue === "" || Number.isNaN(Number(dipValue))) return 0;

  const value = Number(dipValue);
  if (value <= 0) return 0;

  const intPart = Math.floor(value);
  const decimalPart = value - intPart;

  const baseRow = DIP_TABLE.find((r) => r.dip === intPart);
  if (!baseRow) {
    const max = DIP_TABLE[DIP_TABLE.length - 1];
    if (value > max.dip) return max.volume + (value - max.dip) * max.diff;
    return 0;
  }

  const nextRow = DIP_TABLE.find((r) => r.dip === intPart + 1) ?? baseRow;
  const interpolated = baseRow.volume + decimalPart * 10 * baseRow.diff;
  const upper = Math.max(baseRow.volume, nextRow.volume);

  return +Math.min(interpolated, upper).toFixed(2);
}

function loadRecords(): DailyRecord[] {
  if (typeof window === "undefined") return [];

  const raw = localStorage.getItem(LOCAL_KEY);
  if (!raw) return [];

  try {
    return JSON.parse(raw) as DailyRecord[];
  } catch {
    return [];
  }
}

function saveRecords(records: DailyRecord[]) {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(records));
}

function deriveDayState(date: string, shift: "day" | "night", records: DailyRecord[]) {
  const current = records.find((r) => r.date === date && r.shift === shift);

  if (current) {
    return {
      shift: current.shift,
      petrolRate: current.petrolRate,
      dieselRate: current.dieselRate,
      petrolDip: current.petrolDip,
      dieselDip: current.dieselDip,
      petrolOutlets: current.petrolOutlets,
      dieselOutlets: current.dieselOutlets,
      petrolWorker: current.petrolWorker ?? "",
      dieselWorker: current.dieselWorker ?? "",
    };
  }

  const prev = [...records]
    .filter((r) => r.date < date)
    .sort((a, b) => (a.date < b.date ? 1 : -1))[0];

  const prevPetrolRate = prev?.petrolRate ?? "";
  const prevDieselRate = prev?.dieselRate ?? "";

  return {
    shift,
    petrolRate: prevPetrolRate,
    dieselRate: prevDieselRate,
    petrolDip: "",
    dieselDip: "",
    petrolOutlets: createInitialOutlets(PETROL_OUTLETS, prevPetrolRate),
    dieselOutlets: createInitialOutlets(DIESEL_OUTLETS, prevDieselRate),
    petrolWorker: "",
    dieselWorker: "",
  };
}

export default function Home() {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const initialRecords = useMemo(() => loadRecords(), []);
  const initialDayState = useMemo(
    () => deriveDayState(today, "day", initialRecords),
    [today, initialRecords]
  );

  const [selectedDate, setSelectedDate] = useState<string>(today);
  const [shift, setShift] = useState<"day" | "night">(initialDayState.shift ?? "day");
  const [records, setRecords] = useState<DailyRecord[]>(initialRecords);
  const [petrolRate, setPetrolRate] = useState<number | "">(initialDayState.petrolRate ?? "");
  const [dieselRate, setDieselRate] = useState<number | "">(initialDayState.dieselRate ?? "");
  const [petrolDip, setPetrolDip] = useState<number | "">(
    initialDayState.petrolDip === "" ? "" : Number(initialDayState.petrolDip)
  );
  const [dieselDip, setDieselDip] = useState<number | "">(
    initialDayState.dieselDip === "" ? "" : Number(initialDayState.dieselDip)
  );
  const [petrolOutlets, setPetrolOutlets] = useState<OutletReading[]>(initialDayState.petrolOutlets);
  const [dieselOutlets, setDieselOutlets] = useState<OutletReading[]>(initialDayState.dieselOutlets);
  const [petrolWorker, setPetrolWorker] = useState<string>(initialDayState.petrolWorker ?? "");
  const [dieselWorker, setDieselWorker] = useState<string>(initialDayState.dieselWorker ?? "");
  const [message, setMessage] = useState<string>("");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  const weekdayName = useMemo(() => {
    if (!selectedDate) return "";
    const parsedDate = new Date(selectedDate + "T00:00:00");
    return parsedDate.toLocaleDateString("en-US", { weekday: "long" });
  }, [selectedDate]);

  const totals = useMemo(() => {
    const petrolQuantities = petrolOutlets.map((o) => calcQuantity(o.opening, o.closing));
    const dieselQuantities = dieselOutlets.map((o) => calcQuantity(o.opening, o.closing));

    const petrolRateNumber = petrolRate === "" ? 0 : Number(petrolRate);
    const dieselRateNumber = dieselRate === "" ? 0 : Number(dieselRate);

    const petrolAmounts = petrolQuantities.map((qty) => calcAmount(qty, petrolRateNumber));
    const dieselAmounts = dieselQuantities.map((qty) => calcAmount(qty, dieselRateNumber));

    const petrolQtyTotal = petrolQuantities.reduce((a, b) => a + b, 0);
    const dieselQtyTotal = dieselQuantities.reduce((a, b) => a + b, 0);
    const petrolAmtTotal = petrolAmounts.reduce((a, b) => a + b, 0);
    const dieselAmtTotal = dieselAmounts.reduce((a, b) => a + b, 0);

    return {
      petrolQuantities,
      dieselQuantities,
      petrolAmounts,
      dieselAmounts,
      petrolQtyTotal,
      dieselQtyTotal,
      petrolAmtTotal,
      dieselAmtTotal,
      combinedQty: petrolQtyTotal + dieselQtyTotal,
      combinedAmount: petrolAmtTotal + dieselAmtTotal,
    };
  }, [petrolOutlets, dieselOutlets, petrolRate, dieselRate]);

  const petrolStock = dipToLiters(petrolDip);
  const dieselStock = dipToLiters(dieselDip);

  const focusOrder = useMemo(
    () => [
      "rate-petrol",
      "rate-diesel",
      "dip-petrol",
      "dip-diesel",
      "worker-petrol",
      ...PETROL_OUTLETS.flatMap((_, idx) => [`petrol-${idx}-opening`, `petrol-${idx}-closing`]),
      "worker-diesel",
      ...DIESEL_OUTLETS.flatMap((_, idx) => [`diesel-${idx}-opening`, `diesel-${idx}-closing`]),
    ],
    []
  );

  const handleEnter =
    (key: string, onEmptySetZero: () => void) =>
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key !== "Enter") return;
      e.preventDefault();

      if (e.currentTarget.value === "") {
        onEmptySetZero();
      }

      const idx = focusOrder.indexOf(key);
      const nextId = focusOrder[idx + 1];
      const nextEl = document.querySelector<HTMLInputElement>(`[data-focus-id="${nextId}"]`);

      if (nextEl) nextEl.focus();
    };

  const updateOutlet = (
    kind: OutletKind,
    id: string,
    field: keyof OutletReading,
    value: number | ""
  ) => {
    const setter = kind === "petrol" ? setPetrolOutlets : setDieselOutlets;
    setter((prev) => prev.map((o) => (o.id === id ? { ...o, [field]: value } : o)));
  };

  const applyDayState = (state: ReturnType<typeof deriveDayState>) => {
    setShift(state.shift ?? "day");
    setPetrolRate(state.petrolRate ?? "");
    setDieselRate(state.dieselRate ?? "");
    setPetrolDip(state.petrolDip === "" ? "" : Number(state.petrolDip));
    setDieselDip(state.dieselDip === "" ? "" : Number(state.dieselDip));
    setPetrolOutlets(state.petrolOutlets);
    setDieselOutlets(state.dieselOutlets);
    setPetrolWorker(state.petrolWorker ?? "");
    setDieselWorker(state.dieselWorker ?? "");
  };

  const handleDateShiftChange = (date: string, newShift: "day" | "night") => {
    setSelectedDate(date);
    setShift(newShift);
    applyDayState(deriveDayState(date, newShift, records));
  };

  const incrementDate = (date: string) => {
    const d = new Date(date + "T00:00:00");
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  };

  const handleSave = () => {
    if (!selectedDate) {
      setMessage("Date is required");
      return;
    }

    if (petrolRate === "" || dieselRate === "") {
      setMessage("Both petrol and diesel rates are required");
      return;
    }

    const newRecord: DailyRecord = {
      date: selectedDate,
      shift,
      petrolRate: Number(petrolRate),
      dieselRate: Number(dieselRate),
      petrolDip: petrolDip === "" ? 0 : Number(petrolDip),
      dieselDip: dieselDip === "" ? 0 : Number(dieselDip),
      petrolOutlets: petrolOutlets.map((o) => ({ ...o, rate: Number(petrolRate) })),
      dieselOutlets: dieselOutlets.map((o) => ({ ...o, rate: Number(dieselRate) })),
      petrolWorker,
      dieselWorker,
    };

    const filtered = records.filter((r) => !(r.date === selectedDate && r.shift === shift));
    const nextRecords = [...filtered, newRecord];

    const nextShift = shift === "day" ? "night" : "day";
    const nextDate = shift === "day" ? selectedDate : incrementDate(selectedDate);

    const draftNext: DailyRecord = {
      date: nextDate,
      shift: nextShift,
      petrolRate: Number(petrolRate),
      dieselRate: Number(dieselRate),
      petrolDip: 0,
      dieselDip: 0,
      petrolOutlets: petrolOutlets.map((o) => ({
        ...o,
        opening: o.closing === "" ? 0 : o.closing,
        closing: "",
      })),
      dieselOutlets: dieselOutlets.map((o) => ({
        ...o,
        opening: o.closing === "" ? 0 : o.closing,
        closing: "",
      })),
      petrolWorker: "",
      dieselWorker: "",
    };

    const withoutDraft = nextRecords.filter((r) => !(r.date === nextDate && r.shift === nextShift));
    const withDraft = [...withoutDraft, draftNext].sort((a, b) => (a.date > b.date ? -1 : 1));

    setRecords(withDraft);
    saveRecords(withDraft);
    applyDayState(deriveDayState(selectedDate, shift, withDraft));
    setMessage("Saved locally and prepared next shift");
  };

  const goToNextShift = () => {
    const nextShift = shift === "day" ? "night" : "day";
    const nextDate = shift === "day" ? selectedDate : incrementDate(selectedDate);
    handleDateShiftChange(nextDate, nextShift);
  };

  const exportCsv = () => {
    const rows: string[] = [];
    rows.push("Section,Outlet,Opening,Closing,Quantity,Rate,Amount,Date");

    petrolOutlets.forEach((o, idx) => {
      rows.push(["Petrol", o.label, o.opening, o.closing, totals.petrolQuantities[idx], petrolRate, totals.petrolAmounts[idx], selectedDate].join(","));
    });

    dieselOutlets.forEach((o, idx) => {
      rows.push(["Diesel", o.label, o.opening, o.closing, totals.dieselQuantities[idx], dieselRate, totals.dieselAmounts[idx], selectedDate].join(","));
    });

    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");

    a.href = url;
    a.download = `sales-${selectedDate}.csv`;
    a.click();

    URL.revokeObjectURL(url);
  };

  const exportPdf = () => {
    const style = document.createElement("style");
    style.innerHTML = `@page { size: A4; margin: 12mm; }`;
    document.head.appendChild(style);
    window.print();
    document.head.removeChild(style);
  };

  const handleEditCurrentRecord = () => {
    const existing = records.find((r) => r.date === selectedDate && r.shift === shift);

    if (!existing) {
      setMessage("No saved record for this date/shift");
      return;
    }

    applyDayState({
      shift: existing.shift,
      petrolRate: existing.petrolRate,
      dieselRate: existing.dieselRate,
      petrolDip: existing.petrolDip,
      dieselDip: existing.dieselDip,
      petrolOutlets: existing.petrolOutlets,
      dieselOutlets: existing.dieselOutlets,
      petrolWorker: existing.petrolWorker ?? "",
      dieselWorker: existing.dieselWorker ?? "",
    });

    setMessage("Loaded saved record for edit");
  };

  const renderOutletTable = (
    kind: OutletKind,
    outlets: OutletReading[],
    quantities: number[],
    amounts: number[],
    rateValue: number | "",
    workerName: string,
    onWorkerChange: (v: string) => void
  ) => {
    const isPetrol = kind === "petrol";
    const bgContainerColor = isPetrol
      ? "bg-emerald-50/60 border-emerald-100"
      : "bg-blue-50/80 border-blue-100";
    const bgHeaderColor = isPetrol ? "border-emerald-200/60" : "border-blue-200/60";
    const bgThColor = isPetrol ? "bg-emerald-100/50 text-emerald-800" : "bg-blue-100 text-blue-900";
    const textTitleColor = isPetrol ? "text-emerald-900" : "text-blue-950";
    const borderRowColor = isPetrol ? "divide-emerald-100/40" : "divide-blue-100/50";
    const hoverRowClass = isPetrol ? "hover:bg-emerald-100/30" : "hover:bg-blue-100/40";
    const totalRowBg = isPetrol ? "bg-emerald-100/40 text-emerald-900" : "bg-blue-100/70 text-blue-950";

    return (
      <div className={`overflow-hidden rounded-xl border shadow-sm ${bgContainerColor}`}>
        <div className={`flex items-center justify-between border-b px-4 py-3 ${bgHeaderColor}`}>
          <div className={`text-lg font-bold capitalize tracking-wide ${textTitleColor}`}>
            {kind} sales
          </div>

          <div className={`flex items-center gap-2 text-sm ${isPetrol ? "text-emerald-700" : "text-blue-800"}`}>
            <span>Worker Name</span>
            <input
              type="text"
              value={workerName}
              onChange={(e) => onWorkerChange(e.target.value)}
              data-focus-id={isPetrol ? "worker-petrol" : "worker-diesel"}
              onKeyDown={handleEnter(isPetrol ? "worker-petrol" : "worker-diesel", () => {})}
              className="rounded border border-slate-200 bg-white px-3 py-1 text-sm text-slate-800"
              placeholder="Enter name"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className={`${bgThColor} text-left`}>
              <tr>
                <th className="px-4 py-2 font-medium">Outlet</th>
                <th className="px-4 py-2 font-medium">Opening Reading</th>
                <th className="px-4 py-2 font-medium">Closing Reading</th>
                <th className="px-4 py-2 font-medium">Quantity (L)</th>
                <th className="px-4 py-2 font-medium">Rate</th>
                <th className="px-4 py-2 font-medium">Amount</th>
              </tr>
            </thead>

            <tbody className={`divide-y bg-white/70 ${borderRowColor}`}>
              {outlets.map((o, idx) => (
                <tr key={o.id} className={hoverRowClass}>
                  <td className="px-4 py-2 font-medium text-slate-800">{o.label}</td>

                  <td className="px-4 py-2">
                    <input
                      type="number"
                      className="w-28 rounded border border-slate-200 bg-white px-2 py-1 text-right text-slate-800"
                      value={o.opening}
                      data-focus-id={`${kind}-${idx}-opening`}
                      onKeyDown={handleEnter(`${kind}-${idx}-opening`, () => updateOutlet(kind, o.id, "opening", 0))}
                      onChange={(e) => updateOutlet(kind, o.id, "opening", e.target.value === "" ? "" : Number(e.target.value))}
                    />
                  </td>

                  <td className="px-4 py-2">
                    <input
                      type="number"
                      className="w-28 rounded border border-slate-200 bg-white px-2 py-1 text-right text-slate-800"
                      value={o.closing}
                      data-focus-id={`${kind}-${idx}-closing`}
                      onKeyDown={handleEnter(`${kind}-${idx}-closing`, () => updateOutlet(kind, o.id, "closing", 0))}
                      onChange={(e) => updateOutlet(kind, o.id, "closing", e.target.value === "" ? "" : Number(e.target.value))}
                    />
                  </td>

                  <td className="px-4 py-2 text-right font-semibold text-slate-800">
                    {quantities[idx].toLocaleString()}
                  </td>

                  <td className="px-4 py-2">
                    <input
                      type="number"
                      className="w-24 rounded border border-slate-200 bg-slate-50/80 px-2 py-1 text-right text-slate-600"
                      value={rateValue === "" ? "" : rateValue}
                      readOnly
                    />
                  </td>

                  <td className={`px-4 py-2 text-right font-semibold ${isPetrol ? "text-emerald-700" : "text-blue-700"}`}>
                    {amounts[idx].toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
            </tbody>

            <tfoot className={totalRowBg}>
              <tr>
                <td className="px-4 py-2 font-semibold" colSpan={3}>
                  Total {isPetrol ? "Petrol" : "Diesel"}
                </td>
                <td className="px-4 py-2 text-right font-semibold">
                  {isPetrol ? totals.petrolQtyTotal.toLocaleString() : totals.dieselQtyTotal.toLocaleString()}
                </td>
                <td className="px-4 py-2" />
                <td className={`px-4 py-2 text-right font-bold ${isPetrol ? "text-emerald-800" : "text-blue-900"}`}>
                  {(isPetrol ? totals.petrolAmtTotal : totals.dieselAmtTotal).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                  })}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    );
  };

  const netSummary = [
    { label: "Total Petrol Qty", value: totals.petrolQtyTotal, tone: "neutral" },
    { label: "Total Diesel Qty", value: totals.dieselQtyTotal, tone: "neutral" },
    { label: "Combined Qty", value: totals.combinedQty, tone: "neutral" },
    { label: "Total Petrol Amount", value: totals.petrolAmtTotal, tone: "money" },
    { label: "Total Diesel Amount", value: totals.dieselAmtTotal, tone: "money" },
    { label: "Combined Revenue", value: totals.combinedAmount, tone: "money" },
  ] as const;

  if (!hydrated) {
    return <div className="min-h-screen bg-slate-50" />;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8">
        <header className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-orange-600">Shree Petroleum KSK</h1>
              <p className="text-sm uppercase text-slate-500">Mahora</p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => handleDateShiftChange(e.target.value, shift)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-slate-900"
              />

              {weekdayName && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-900">
                  {weekdayName}
                </div>
              )}

              <select
                value={shift}
                onChange={(e) => handleDateShiftChange(selectedDate, e.target.value as "day" | "night")}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-900"
              >
                <option value="day">Day</option>
                <option value="night">Night</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <RateField label="Petrol Rate" value={petrolRate} onChange={setPetrolRate} focusId="rate-petrol" onEnter={handleEnter("rate-petrol", () => setPetrolRate(0))} />
            <RateField label="Diesel Rate" value={dieselRate} onChange={setDieselRate} focusId="rate-diesel" onEnter={handleEnter("rate-diesel", () => setDieselRate(0))} />
            <DipField label="Petrol Dip" value={petrolDip} onChange={setPetrolDip} focusId="dip-petrol" onEnter={handleEnter("dip-petrol", () => setPetrolDip(0))} />
            <DipField label="Diesel Dip" value={dieselDip} onChange={setDieselDip} focusId="dip-diesel" onEnter={handleEnter("dip-diesel", () => setDieselDip(0))} />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <StatCard title="Available Petrol Stock (L)" value={petrolStock} tone="stock" />
            <StatCard title="Available Diesel Stock (L)" value={dieselStock} tone="stock" />
          </div>
        </header>

        {renderOutletTable("petrol", petrolOutlets, totals.petrolQuantities, totals.petrolAmounts, petrolRate, petrolWorker, setPetrolWorker)}
        {renderOutletTable("diesel", dieselOutlets, totals.dieselQuantities, totals.dieselAmounts, dieselRate, dieselWorker, setDieselWorker)}

        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {netSummary.map((item) => (
            <StatCard key={item.label} title={item.label} value={item.value} tone={item.tone} />
          ))}
        </section>

        <div className="flex flex-wrap items-center gap-3">
          <button onClick={handleSave} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700">
            Save Record
          </button>

          <button onClick={goToNextShift} className="ml-auto rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50">
            Next
          </button>

          {message && <span className="text-sm text-emerald-600">{message}</span>}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button onClick={exportCsv} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50">
            Export CSV
          </button>

          <button onClick={exportPdf} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50">
            Export PDF
          </button>

          <button onClick={handleEditCurrentRecord} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50">
            Edit Report
          </button>
        </div>
      </div>
    </div>
  );
}

function RateField({
  label,
  value,
  onChange,
  focusId,
  onEnter,
}: {
  label: string;
  value: number | "";
  onChange: (v: number | "") => void;
  focusId?: string;
  onEnter?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm text-slate-700">
      <span className="font-semibold">{label}</span>
      <input
        type="number"
        value={value}
        data-focus-id={focusId}
        onKeyDown={onEnter}
        onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
        placeholder="Auto-fills from previous day"
        className="rounded-lg border border-slate-200 px-3 py-2 text-slate-800"
      />
    </label>
  );
}

function DipField({
  label,
  value,
  onChange,
  focusId,
  onEnter,
}: {
  label: string;
  value: number | "";
  onChange: (v: number | "") => void;
  focusId?: string;
  onEnter?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm text-slate-700">
      <span className="font-semibold">{label} (dip)</span>
      <input
        type="number"
        value={value}
        data-focus-id={focusId}
        onKeyDown={onEnter}
        onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
        placeholder="Enter dip reading"
        className="rounded-lg border border-slate-200 px-3 py-2 text-slate-800"
      />
    </label>
  );
}

function StatCard({
  title,
  value,
  tone = "neutral",
}: {
  title: string;
  value: number;
  tone?: "neutral" | "money" | "stock";
}) {
  const color =
    tone === "money" ? "text-emerald-700" : tone === "stock" ? "text-sky-700" : "text-slate-800";

  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <p className="text-xs uppercase tracking-wide text-slate-500">{title}</p>
      <p className={`text-2xl font-bold ${color}`}>
        {tone === "money" ? "₹" : ""}
        {value.toLocaleString(undefined, {
          minimumFractionDigits: tone === "money" ? 2 : 0,
        })}
      </p>
    </div>
  );
}