import { DOMSlotProvider } from "../providers/dom-slot-provider";
import { mountFloatingWindow } from "./floating-window";
import type { ExtensionMessage, ProviderResult, ScanReason } from "../shared/types";

const provider = new DOMSlotProvider();
let lastRelevantSignature = "";
let lastPageChangeAt: string | undefined;
let debounceTimer: number | undefined;
const floatingWindowPromise = mountFloatingWindow();

function relevantSignature(): string {
  const cards = Array.from(document.querySelectorAll<HTMLElement>('[id^="result_card_"]'));
  const cardState = cards.map((card) => ({
    id: card.id,
    text: card.innerText,
    dates: Array.from(card.querySelectorAll<HTMLInputElement>('[id^="preferredDateShown_"]')).map(
      (input) => input.value
    ),
    times: Array.from(card.querySelectorAll<HTMLSelectElement>('[id^="appt_menu_"]')).map(
      (select) => Array.from(select.options).map((option) => option.textContent?.trim())
    )
  }));
  const progress = document.querySelector<HTMLElement>('#progressDialog, [aria-busy="true"]');
  return JSON.stringify({
    cardState,
    progress: progress
      ? `${progress.getAttribute("aria-hidden")}|${progress.getAttribute("style")}|${progress.textContent}`
      : ""
  });
}

async function scan(reason: ScanReason): Promise<ProviderResult> {
  const result = provider.parse(document, { now: new Date(), pageUrl: location.href });
  const message: ExtensionMessage = {
    type: "SCAN_RESULT",
    result,
    reason,
    lastPageChangeAt
  };
  try {
    await chrome.runtime.sendMessage(message);
  } catch {
    // The extension may have been reloaded while this old content script was alive.
  }
  return result;
}

function scheduleMutationScan(): void {
  window.clearTimeout(debounceTimer);
  debounceTimer = window.setTimeout(() => {
    const signature = relevantSignature();
    if (signature === lastRelevantSignature) return;
    lastRelevantSignature = signature;
    lastPageChangeAt = new Date().toISOString();
    void scan("page_change");
  }, 250);
}

const observer = new MutationObserver(scheduleMutationScan);
observer.observe(document.documentElement, {
  childList: true,
  subtree: true,
  attributes: true,
  attributeFilter: ["style", "class", "aria-busy", "aria-hidden", "value"]
});

chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
  if (message.type === "TRIGGER_SCAN") {
    void scan("manual").then((result) => sendResponse(result));
    return true;
  }
  if (message.type === "SHOW_FLOATING_WINDOW") {
    void floatingWindowPromise.then((floatingWindow) => floatingWindow.show()).then(() => sendResponse({ ok: true }));
    return true;
  }
  return false;
});

lastRelevantSignature = relevantSignature();
lastPageChangeAt = new Date().toISOString();
void scan("initial");
