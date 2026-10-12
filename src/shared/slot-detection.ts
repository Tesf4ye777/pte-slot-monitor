import type { MonitorConfig, PTESlot } from "./types";

const SYDNEY_METRO_ADDRESS =
  /\b(Sydney|Kensington|Macquarie Park|Parramatta|Chatswood|Hurstville|Burwood|Blacktown|Liverpool|North Sydney|Ultimo|Haymarket)\b/i;

export function filterTargetSlots(
  slots: PTESlot[],
  config: MonitorConfig,
  now: Date
): PTESlot[] {
  const current = sydneyDateAndTime(now);

  return slots
    .filter((slot) => slot.examType === config.examType)
    .filter((slot) => slot.date >= config.dateFrom && slot.date <= config.dateTo)
    .filter((slot) => isSydneyAreaSlot(slot, config.maxDistanceMiles))
    .filter((slot) => {
      if (slot.date > current.date) return true;
      if (slot.date < current.date) return false;
      return slot.time > current.time;
    })
    .sort((a, b) =>
      a.date === b.date ? a.time.localeCompare(b.time) : a.date.localeCompare(b.date)
    );
}

export function reconcileActiveSlots(
  previousActiveIds: readonly string[],
  currentSlots: readonly PTESlot[]
): { newlyAvailable: PTESlot[]; activeIds: string[] } {
  const previous = new Set(previousActiveIds);
  const activeIds = currentSlots.map((slot) => slot.id);
  return {
    newlyAvailable: currentSlots.filter((slot) => !previous.has(slot.id)),
    activeIds
  };
}

function isSydneyAreaSlot(slot: PTESlot, maxDistanceMiles: number): boolean {
  if (typeof slot.distanceMiles === "number") {
    return slot.distanceMiles <= maxDistanceMiles;
  }
  return SYDNEY_METRO_ADDRESS.test(`${slot.testCenterName} ${slot.address ?? ""}`);
}

function sydneyDateAndTime(now: Date): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Sydney",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";
  return {
    date: `${part("year")}-${part("month")}-${part("day")}`,
    time: `${part("hour")}:${part("minute")}`
  };
}
