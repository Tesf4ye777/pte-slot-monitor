import { describe, expect, it } from "vitest";
import { DOMSlotProvider } from "../src/providers/dom-slot-provider";
import { DEFAULT_CONFIG } from "../src/shared/constants";
import { filterTargetSlots, reconcileActiveSlots } from "../src/shared/slot-detection";
import { center, pearsonPage } from "./fixtures/pearson-page";

const provider = new DOMSlotProvider();
const pageUrl = "https://findseats.pearsonvue.com/testtaker/registration/CombinedTestCenterSearchPage/PEARSONLANGUAGE?conversationId=fixture";
const now = new Date("2026-10-11T00:00:00+11:00");

function parse(html: string) {
  const document = new DOMParser().parseFromString(html, "text/html");
  return { document, result: provider.parse(document, { now, pageUrl }) };
}

describe("DOMSlotProvider", () => {
  it("does not produce a target match when 11–13 October have no visible slot", () => {
    const { result } = parse(pearsonPage([center()]));
    expect(result.status).toBe("success");
    expect(filterTargetSlots(result.slots, DEFAULT_CONFIG, now)).toEqual([]);
  });

  it("detects a newly visible 12 October slot with its concrete time", () => {
    const { result } = parse(
      pearsonPage([center({ date: "12 October 2026", times: ["9:30 AM"] })])
    );
    const matches = filterTargetSlots(result.slots, DEFAULT_CONFIG, now);
    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({ date: "2026-10-12", time: "09:30", displayTime: "9:30 AM" });
  });

  it("applies a user-selected target date range", () => {
    const { result } = parse(
      pearsonPage([center({ date: "12 October 2026", times: ["9:30 AM"] })])
    );
    const excludesDate = { ...DEFAULT_CONFIG, dateFrom: "2026-10-13", dateTo: "2026-10-20" };
    const includesDate = { ...DEFAULT_CONFIG, dateFrom: "2026-10-12", dateTo: "2026-10-20" };
    expect(filterTargetSlots(result.slots, excludesDate, now)).toHaveLength(0);
    expect(filterTargetSlots(result.slots, includesDate, now)).toHaveLength(1);
  });

  it("does not notify twice while the same slot remains visible", () => {
    const { result } = parse(
      pearsonPage([center({ date: "12 October 2026", times: ["9:30 AM"] })])
    );
    const matches = filterTargetSlots(result.slots, DEFAULT_CONFIG, now);
    const first = reconcileActiveSlots([], matches);
    const second = reconcileActiveSlots(first.activeIds, matches);
    expect(first.newlyAvailable).toHaveLength(1);
    expect(second.newlyAvailable).toHaveLength(0);
  });

  it("reparses the selected date and times after the page switches month/date", () => {
    const { document } = parse(pearsonPage([center()]));
    const input = document.querySelector<HTMLInputElement>("#preferredDateShown_1")!;
    const select = document.querySelector<HTMLSelectElement>("#appt_menu_1")!;
    input.value = "12 October 2026";
    select.innerHTML = "<option>9:30 AM</option><option>1:15 PM</option>";
    const updated = provider.parse(document, { now, pageUrl });
    const matches = filterTargetSlots(updated.slots, DEFAULT_CONFIG, now);
    expect(matches.map((slot) => slot.time)).toEqual(["09:30", "13:15"]);
  });

  it("reports loading without replacing it with a no-slot success", () => {
    const { result } = parse(`<!doctype html><body>
      <div id="progressDialog">Processing request <span>Please Wait...</span></div>
      ${pearsonPage([center({ date: "12 October 2026", times: ["9:30 AM"] })])}
    </body>`);
    expect(result.status).toBe("loading");
    expect(result.slots).toEqual([]);
  });

  it("ignores Pearson's progress dialog when a parent hides it with stylesheet CSS", () => {
    document.open();
    document.write(`<!doctype html><html><head>
      <style>.ui-dialog-hidden { display: none; }</style>
    </head><body>
      <div class="ui-dialog-hidden"><div id="progressDialog">Processing request Please Wait...</div></div>
      ${pearsonPage([center({ date: "12 October 2026", times: ["9:30 AM"] })])}
    </body></html>`);
    document.close();
    const result = provider.parse(document, { now, pageUrl });
    expect(result.status).toBe("success");
    expect(filterTargetSlots(result.slots, DEFAULT_CONFIG, now)).toHaveLength(1);
  });

  it("still reports loading when the progress dialog and its ancestors are visible", () => {
    const { result } = parse(`<!doctype html><body>
      <div class="ui-dialog-visible"><div id="progressDialog">Processing request Please Wait...</div></div>
      ${pearsonPage([center({ date: "12 October 2026", times: ["9:30 AM"] })])}
    </body>`);
    expect(result.status).toBe("loading");
  });

  it("detects verification pages so automatic refresh can pause", () => {
    const { result } = parse(`<!doctype html><body><h1>Verify you are human</h1></body>`);
    expect(result.status).toBe("verification_required");
  });

  it("detects request limits so automatic refresh can pause", () => {
    const { result } = parse(`<!doctype html><body><h1>Error 429</h1><p>Too many requests</p></body>`);
    expect(result.status).toBe("rate_limited");
  });

  it("reports a parser error when result card structure changes", () => {
    const { result } = parse(`<!doctype html><body>
      <span id="tagAlongAriaId">PTE-A: PTE Academic</span>
      <div id="searchResultsLabelHeader">Search Results</div>
      <article id="result_card_changed">Unexpected replacement markup</article>
    </body>`);
    expect(result.status).toBe("parse_error");
    expect(result.error).toMatch(/card|valid/i);
  });

  it("allows a disappeared slot to notify again if it reappears", () => {
    const { result } = parse(
      pearsonPage([center({ date: "12 October 2026", times: ["9:30 AM"] })])
    );
    const matches = filterTargetSlots(result.slots, DEFAULT_CONFIG, now);
    const appeared = reconcileActiveSlots([], matches);
    const disappeared = reconcileActiveSlots(appeared.activeIds, []);
    const reappeared = reconcileActiveSlots(disappeared.activeIds, matches);
    expect(reappeared.newlyAvailable).toHaveLength(1);
  });
});
