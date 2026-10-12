import type {
  ProviderContext,
  ProviderResult,
  PTESlot,
  SlotProvider
} from "../shared/types";

const RESULT_CARD_SELECTOR = '[id^="result_card_"]';
const MONTHS: Record<string, string> = {
  january: "01",
  february: "02",
  march: "03",
  april: "04",
  may: "05",
  june: "06",
  july: "07",
  august: "08",
  september: "09",
  october: "10",
  november: "11",
  december: "12"
};

export class DOMSlotProvider implements SlotProvider {
  readonly id = "dom" as const;

  parse(document: Document, context: ProviderContext): ProviderResult {
    const checkedAt = context.now.toISOString();
    if (!/findseats\.pearsonvue\.com$/i.test(new URL(context.pageUrl).hostname)) {
      return result("unsupported", checkedAt, "Open the official Pearson VUE appointment page.");
    }

    const initialBodyText = clean(document.body?.textContent ?? "");
    if (
      document.querySelector('iframe[src*="captcha" i], .g-recaptcha, [id*="captcha" i], [class*="captcha" i]') ||
      /verify (that )?you are human|security check|complete the verification|captcha/i.test(initialBodyText)
    ) {
      return result(
        "verification_required",
        checkedAt,
        "Pearson requires manual verification. Automatic refresh has been paused."
      );
    }
    if (/too many requests|rate limit|error\s*429|request limit exceeded/i.test(initialBodyText)) {
      return result(
        "rate_limited",
        checkedAt,
        "Pearson reported a request limit. Automatic refresh has been paused."
      );
    }

    if (isPageLoading(document)) {
      return result("loading", checkedAt, "Pearson VUE is processing the page. Existing results were not replaced.");
    }

    const bodyText = clean(document.body?.textContent ?? "");
    const examText = clean(
      document.querySelector("#tagAlongAriaId")?.textContent ??
        document.querySelector("#TagAlongLink")?.textContent ??
        ""
    );
    const cards = Array.from(document.querySelectorAll<HTMLElement>(RESULT_CARD_SELECTOR));
    const hasResultContext = Boolean(
      document.querySelector("#searchResultsLabelHeader, #search-results-label-header") ||
        /Search has returned available test centres/i.test(bodyText)
    );

    if (!cards.length && !hasResultContext) {
      if (document.querySelector("#testCentersNearAddress")) {
        return result(
          "waiting_for_search",
          checkedAt,
          "Enter Sydney on the official page and run the search manually."
        );
      }
      return result("parse_error", checkedAt, "The expected Pearson VUE search controls were not found.", {
        error: "Unsupported or changed Pearson VUE page structure"
      });
    }

    if (examText && !/PTE-A\s*:\s*PTE Academic|PTE Academic/i.test(examText)) {
      return result("unsupported", checkedAt, "The open page is not a PTE Academic search.");
    }

    if (!cards.length) {
      if (/no (test centres|appointments|results).*(available|found)|0 results/i.test(bodyText)) {
        return result("success", checkedAt, "The official page returned no centers.");
      }
      return result("parse_error", checkedAt, "Search results were announced but no result cards could be parsed.", {
        error: "Result card structure changed"
      });
    }

    const slots: PTESlot[] = [];
    let parsedCenters = 0;
    const cardErrors: string[] = [];

    for (const card of cards) {
      const componentId = card.id.match(/result_card_(\d+)/)?.[1];
      if (!componentId) {
        cardErrors.push(`Unrecognized card id: ${card.id || "(missing)"}`);
        continue;
      }

      const centerName = clean(
        card.querySelector(`#test-center-info-link_${componentId}`)?.textContent ??
          card.querySelector('[id^="tc_name_"]')?.textContent ??
          ""
      );
      const addressElement = card.querySelector<HTMLElement>('[id^="tc_address_"]');
      const address = clean(addressElement?.textContent ?? "");
      const centerId =
        addressElement?.id.match(/tc_address_(\d+)/)?.[1] ??
        card.querySelector<HTMLElement>('[id^="tc_distance_"]')?.id.match(/tc_distance_(\d+)/)?.[1] ??
        "";

      if (!centerName || !centerId) {
        cardErrors.push(`Card ${componentId} is missing its center name or center id.`);
        continue;
      }

      parsedCenters += 1;
      const distanceText = clean(
        card.querySelector(`[id^="tc_distance_"]`)?.textContent ?? ""
      );
      const distanceMatch = distanceText.match(/(\d+(?:\.\d+)?)/);
      const distanceMiles = distanceMatch ? Number(distanceMatch[1]) : undefined;
      const dateInput = card.querySelector<HTMLInputElement>(
        `#preferredDateShown_${componentId}, input[id^="preferredDateShown_"]`
      );
      const date = parseEnglishDate(dateInput?.value ?? dateInput?.getAttribute("value") ?? "");
      const timeSelect = card.querySelector<HTMLSelectElement>(
        `#appt_menu_${componentId}, select[id^="appt_menu_"]`
      );

      if (!date || !timeSelect) continue;

      for (const option of Array.from(timeSelect.options)) {
        const displayTime = clean(option.textContent ?? option.label ?? "");
        const time = parseTime(displayTime);
        if (!time) continue;
        slots.push({
          id: `${centerId}|${date}|${time}`,
          testCenterId: centerId,
          testCenterName: centerName,
          city: "Sydney",
          examType: "PTE Academic",
          date,
          time,
          displayTime,
          timezone: "Australia/Sydney",
          bookingUrl: context.pageUrl,
          detectedAt: checkedAt,
          address,
          distanceMiles
        });
      }
    }

    if (!parsedCenters || cardErrors.length === cards.length) {
      return result("parse_error", checkedAt, "Pearson VUE results were present but could not be parsed safely.", {
        centerCount: parsedCenters,
        error: cardErrors.join(" ") || "No valid result cards"
      });
    }

    return result(
      "success",
      checkedAt,
      `Parsed ${parsedCenters} center${parsedCenters === 1 ? "" : "s"} from the current page.`,
      { slots: dedupe(slots), centerCount: parsedCenters }
    );
  }
}

function result(
  status: ProviderResult["status"],
  checkedAt: string,
  message: string,
  extra: Partial<ProviderResult> = {}
): ProviderResult {
  return {
    provider: "dom",
    status,
    checkedAt,
    slots: [],
    centerCount: 0,
    message,
    ...extra
  };
}

function isPageLoading(document: Document): boolean {
  const candidates = Array.from(
    document.querySelectorAll<HTMLElement>(
      '#progressDialog, [aria-busy="true"], .processing-request'
    )
  );
  return candidates.some((element) => {
    if (!isActuallyVisible(element, document)) return false;
    const text = clean(element.textContent ?? "");
    return (
      element.getAttribute("aria-busy") === "true" ||
      /processing request|please wait|loading/i.test(text)
    );
  });
}

function isActuallyVisible(element: HTMLElement, document: Document): boolean {
  const view = document.defaultView;
  let current: HTMLElement | null = element;

  while (current && current !== document.body) {
    if (current.hidden || current.getAttribute("aria-hidden") === "true") return false;

    const inlineStyle = current.getAttribute("style") ?? "";
    if (/display\s*:\s*none|visibility\s*:\s*(hidden|collapse)/i.test(inlineStyle)) {
      return false;
    }

    if (view) {
      const computed = view.getComputedStyle(current);
      if (
        computed.display === "none" ||
        computed.visibility === "hidden" ||
        computed.visibility === "collapse" ||
        computed.opacity === "0"
      ) {
        return false;
      }
    }

    current = current.parentElement;
  }
  return true;
}

function parseEnglishDate(value: string): string | null {
  const normalized = clean(value);
  if (!normalized || /select a date/i.test(normalized)) return null;

  const numeric = normalized.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (numeric) return `${numeric[3]}-${pad(numeric[1])}-${pad(numeric[2])}`;

  const words = normalized.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  if (!words) return null;
  const month = MONTHS[words[2].toLowerCase()];
  return month ? `${words[3]}-${month}-${pad(words[1])}` : null;
}

function parseTime(value: string): string | null {
  const normalized = clean(value);
  const twelveHour = normalized.match(/^(\d{1,2}):(\d{2})\s*([AP]M)$/i);
  if (twelveHour) {
    let hour = Number(twelveHour[1]);
    const minute = twelveHour[2];
    const period = twelveHour[3].toUpperCase();
    if (hour === 12) hour = 0;
    if (period === "PM") hour += 12;
    return `${pad(String(hour))}:${minute}`;
  }
  const twentyFourHour = normalized.match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
  return twentyFourHour ? `${pad(twentyFourHour[1])}:${twentyFourHour[2]}` : null;
}

function clean(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function pad(value: string): string {
  return value.padStart(2, "0");
}

function dedupe(slots: PTESlot[]): PTESlot[] {
  return Array.from(new Map(slots.map((slot) => [slot.id, slot])).values());
}
