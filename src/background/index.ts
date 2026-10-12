import {
  DEFAULT_CONFIG,
  INITIAL_STATE,
  OFFICIAL_SEARCH_URL,
  STORAGE_KEYS
} from "../shared/constants";
import { clampRefreshInterval } from "../shared/monitor-config";
import { filterTargetSlots, reconcileActiveSlots } from "../shared/slot-detection";
import type {
  ExtensionMessage,
  MonitorConfig,
  MonitorState,
  PTESlot,
  ScanResultMessage
} from "../shared/types";

const AUTO_REFRESH_ALARM = "pte-auto-refresh";

chrome.runtime.onInstalled.addListener(() => void initializeAndSchedule());
chrome.runtime.onStartup.addListener(() => void initializeAndSchedule());
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === AUTO_REFRESH_ALARM) void runAutomaticRefresh();
});
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local") return;
  const configChange = changes[STORAGE_KEYS.config];
  if (!configChange) return;
  const before = configChange.oldValue as Partial<MonitorConfig> | undefined;
  const after = configChange.newValue as Partial<MonitorConfig> | undefined;
  void chrome.action.setTitle({
    title: after?.uiLanguage === "zh-CN" ? "PTE 考位监控" : "PTE Slot Monitor"
  });
  if (
    before?.autoRefreshEnabled !== after?.autoRefreshEnabled ||
    before?.refreshIntervalMinutes !== after?.refreshIntervalMinutes
  ) {
    void syncAutoRefreshAlarm();
  }
});

chrome.runtime.onMessage.addListener((message: ExtensionMessage, sender, sendResponse) => {
  if (message.type === "SCAN_RESULT") {
    void handleScanResult(message, sender.tab).then(() => sendResponse({ ok: true }));
    return true;
  }
  if (message.type === "SCAN_ACTIVE_TAB") {
    void scanActivePearsonTab().then(sendResponse);
    return true;
  }
  if (message.type === "OPEN_BOOKING_PAGE") {
    void openBookingPage(message.url).then(() => sendResponse({ ok: true }));
    return true;
  }
  if (message.type === "SHOW_FLOATING_WINDOW") {
    void showFloatingWindow().then(sendResponse);
    return true;
  }
  if (message.type === "GET_STATE") {
    void getStored().then(sendResponse);
    return true;
  }
  return false;
});

chrome.notifications.onClicked.addListener((notificationId) => void openNotificationTarget(notificationId));
chrome.notifications.onButtonClicked.addListener((notificationId) =>
  void openNotificationTarget(notificationId)
);

async function ensureInitialized(): Promise<void> {
  const stored = await chrome.storage.local.get([STORAGE_KEYS.config, STORAGE_KEYS.state]);
  const updates: Record<string, unknown> = {};
  if (!stored[STORAGE_KEYS.config]) {
    updates[STORAGE_KEYS.config] = DEFAULT_CONFIG;
  } else {
    const storedConfig = stored[STORAGE_KEYS.config] as Partial<MonitorConfig>;
    const normalizedInterval = clampRefreshInterval(
      storedConfig.refreshIntervalMinutes ?? DEFAULT_CONFIG.refreshIntervalMinutes
    );
    if (storedConfig.refreshIntervalMinutes !== normalizedInterval) {
      updates[STORAGE_KEYS.config] = {
        ...DEFAULT_CONFIG,
        ...storedConfig,
        refreshIntervalMinutes: normalizedInterval
      };
    }
  }
  if (!stored[STORAGE_KEYS.state]) updates[STORAGE_KEYS.state] = INITIAL_STATE;
  if (Object.keys(updates).length) await chrome.storage.local.set(updates);
}

async function initializeAndSchedule(): Promise<void> {
  await ensureInitialized();
  const { config } = await getStored();
  await chrome.action.setTitle({
    title: config.uiLanguage === "zh-CN" ? "PTE 考位监控" : "PTE Slot Monitor"
  });
  await syncAutoRefreshAlarm();
}

async function handleScanResult(message: ScanResultMessage, tab?: chrome.tabs.Tab): Promise<void> {
  const { config, state } = await getStored();
  const { result } = message;
  const base: MonitorState = {
    ...state,
    providerStatus: result.status,
    lastParsedAt: result.checkedAt,
    lastPageChangeAt: message.lastPageChangeAt ?? state.lastPageChangeAt,
    providerMessage: result.message,
    monitoredTabId: tab?.id ?? state.monitoredTabId,
    monitoredUrl: tab?.url ?? state.monitoredUrl
  };

  if (result.status !== "success") {
    const status: MonitorState["status"] =
      result.status === "loading"
        ? "checking"
        : result.status === "waiting_for_search"
          ? "waiting_for_search"
          : result.status === "verification_required"
            ? "verification_required"
            : result.status === "rate_limited"
              ? "rate_limited"
          : result.status === "unsupported"
            ? "unsupported"
            : "parse_error";
    await saveState({
      ...base,
      status,
      lastError: result.error,
      history: appendHistory(state, message, 0)
    });
    if (result.status === "verification_required" || result.status === "rate_limited") {
      await pauseAutomaticRefresh(result.message);
    }
    return;
  }

  const matchingSlots = filterTargetSlots(result.slots, config, new Date(result.checkedAt));
  const { newlyAvailable, activeIds } = reconcileActiveSlots(state.activeSlotIds, matchingSlots);
  const nextState: MonitorState = {
    ...base,
    status: matchingSlots.length ? "slot_found" : "watching",
    lastSuccessfulParseAt: result.checkedAt,
    lastError: undefined,
    parsedCenters: result.centerCount,
    checksCompleted: state.checksCompleted + 1,
    currentSlots: matchingSlots,
    activeSlotIds: activeIds,
    history: appendHistory(state, message, matchingSlots.length)
  };
  await saveState(nextState);

  if (newlyAvailable.length && config.notificationsEnabled) {
    await notifySlots(newlyAvailable, config);
  }
}

async function syncAutoRefreshAlarm(): Promise<void> {
  const { config, state } = await getStored();
  await chrome.alarms.clear(AUTO_REFRESH_ALARM);
  if (!config.autoRefreshEnabled) {
    await saveState({ ...state, nextAutoRefreshAt: undefined });
    return;
  }
  const interval = clampRefreshInterval(config.refreshIntervalMinutes);
  await chrome.alarms.create(AUTO_REFRESH_ALARM, {
    delayInMinutes: interval,
    periodInMinutes: interval
  });
  await saveState({
    ...state,
    nextAutoRefreshAt: new Date(Date.now() + interval * 60_000).toISOString(),
    autoRefreshPausedReason: undefined
  });
}

async function runAutomaticRefresh(): Promise<void> {
  const { config, state } = await getStored();
  if (!config.autoRefreshEnabled || !state.monitoredTabId) return;

  const interval = clampRefreshInterval(config.refreshIntervalMinutes);
  const now = new Date();
  try {
    const tab = await chrome.tabs.get(state.monitoredTabId);
    if (!tab.url?.startsWith("https://findseats.pearsonvue.com/")) return;
    await saveState({
      ...state,
      status: "checking",
      providerStatus: "loading",
      providerMessage: `Refreshing the official Pearson page on the ${interval}-minute schedule.`,
      lastAutoRefreshAt: now.toISOString(),
      nextAutoRefreshAt: new Date(now.getTime() + interval * 60_000).toISOString(),
      autoRefreshCount: state.autoRefreshCount + 1
    });
    await chrome.tabs.reload(tab.id!, { bypassCache: false });
  } catch (error) {
    await saveState({
      ...state,
      status: "error",
      lastError: error instanceof Error ? error.message : "Automatic refresh failed",
      lastAutoRefreshAt: now.toISOString(),
      autoRefreshCount: state.autoRefreshCount + 1,
      nextAutoRefreshAt: new Date(now.getTime() + interval * 60_000).toISOString()
    });
  }
}

async function pauseAutomaticRefresh(reason: string): Promise<void> {
  const { config, state } = await getStored();
  await chrome.alarms.clear(AUTO_REFRESH_ALARM);
  await chrome.storage.local.set({
    [STORAGE_KEYS.config]: { ...config, autoRefreshEnabled: false },
    [STORAGE_KEYS.state]: {
      ...state,
      nextAutoRefreshAt: undefined,
      autoRefreshPausedReason: reason
    }
  });
}

function appendHistory(
  state: MonitorState,
  message: ScanResultMessage,
  matchingSlotCount: number
): MonitorState["history"] {
  return [
    {
      checkedAt: message.result.checkedAt,
      status: message.result.status,
      centerCount: message.result.centerCount,
      matchingSlotCount,
      reason: message.reason,
      error: message.result.error
    },
    ...state.history
  ].slice(0, 100);
}

async function notifySlots(slots: PTESlot[], config: MonitorConfig): Promise<void> {
  const targetsResult = await chrome.storage.local.get(STORAGE_KEYS.notificationTargets);
  const targets = (targetsResult[STORAGE_KEYS.notificationTargets] ?? {}) as Record<string, string>;
  for (const slot of slots.slice(0, 3)) {
    const notificationId = `pte-slot-${hash(slot.id)}-${Date.now()}`;
    targets[notificationId] = slot.bookingUrl ?? OFFICIAL_SEARCH_URL;
    await chrome.notifications.create(notificationId, {
      type: "basic",
      iconUrl: chrome.runtime.getURL("icons/icon128.png"),
      title: config.uiLanguage === "zh-CN" ? "发现可预约的 PTE 考位！" : "PTE AVAILABLE SLOT!",
      message: `${formatDate(slot.date, config.uiLanguage)} · ${slot.displayTime}\n${slot.testCenterName}`,
      priority: 2,
      requireInteraction: true,
      buttons: [{ title: config.uiLanguage === "zh-CN" ? "打开官网页面" : "OPEN OFFICIAL PAGE" }]
    });
  }
  await chrome.storage.local.set({ [STORAGE_KEYS.notificationTargets]: targets });
  if (config.soundEnabled) await playAlert();
}

async function playAlert(): Promise<void> {
  if (!(await chrome.offscreen.hasDocument())) {
    await chrome.offscreen.createDocument({
      url: "offscreen.html",
      reasons: [chrome.offscreen.Reason.AUDIO_PLAYBACK],
      justification: "Play a short local alert when a newly visible target slot is detected."
    });
  }
  await chrome.runtime.sendMessage({ type: "PLAY_ALERT" } satisfies ExtensionMessage);
}

async function scanActivePearsonTab(): Promise<{ ok: boolean; error?: string }> {
  const tabs = await chrome.tabs.query({ url: "https://findseats.pearsonvue.com/*" });
  const tab = tabs.find((candidate) => candidate.active) ?? tabs.at(0);
  if (!tab?.id) return { ok: false, error: "No open Pearson VUE appointment page was found." };
  try {
    await chrome.tabs.sendMessage(tab.id, { type: "TRIGGER_SCAN" } satisfies ExtensionMessage);
    return { ok: true };
  } catch {
    return {
      ok: false,
      error: "The Pearson page is open, but the monitor is not attached. Reload that tab once."
    };
  }
}

async function showFloatingWindow(): Promise<{ ok: boolean; error?: string }> {
  const tabs = await chrome.tabs.query({ url: "https://findseats.pearsonvue.com/*" });
  const tab = tabs.find((candidate) => candidate.active) ?? tabs.at(0);
  if (!tab?.id) return { ok: false, error: "No open Pearson VUE appointment page was found." };
  try {
    await chrome.tabs.sendMessage(tab.id, { type: "SHOW_FLOATING_WINDOW" } satisfies ExtensionMessage);
    return { ok: true };
  } catch {
    return {
      ok: false,
      error: "The Pearson page is open, but the monitor is not attached. Reload that tab once."
    };
  }
}

async function openNotificationTarget(notificationId: string): Promise<void> {
  const stored = await chrome.storage.local.get(STORAGE_KEYS.notificationTargets);
  const targets = (stored[STORAGE_KEYS.notificationTargets] ?? {}) as Record<string, string>;
  await openBookingPage(targets[notificationId]);
  await chrome.notifications.clear(notificationId);
}

async function openBookingPage(url?: string): Promise<void> {
  const { state } = await getStored();
  if (state.monitoredTabId) {
    try {
      const tab = await chrome.tabs.get(state.monitoredTabId);
      if (tab.id) {
        await chrome.tabs.update(tab.id, { active: true });
        if (tab.windowId) await chrome.windows.update(tab.windowId, { focused: true });
        return;
      }
    } catch {
      // The observed tab was closed; open the official URL below.
    }
  }
  await chrome.tabs.create({ url: url ?? OFFICIAL_SEARCH_URL, active: true });
}

async function getStored(): Promise<{ config: MonitorConfig; state: MonitorState }> {
  const stored = await chrome.storage.local.get([STORAGE_KEYS.config, STORAGE_KEYS.state]);
  const mergedConfig = {
    ...DEFAULT_CONFIG,
    ...(stored[STORAGE_KEYS.config] as Partial<MonitorConfig> | undefined)
  };
  return {
    config: {
      ...mergedConfig,
      refreshIntervalMinutes: clampRefreshInterval(mergedConfig.refreshIntervalMinutes)
    },
    state: { ...INITIAL_STATE, ...(stored[STORAGE_KEYS.state] as Partial<MonitorState> | undefined) }
  };
}

async function saveState(state: MonitorState): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.state]: state });
  await chrome.action.setBadgeText({ text: state.currentSlots.length ? String(state.currentSlots.length) : "" });
  await chrome.action.setBadgeBackgroundColor({ color: "#36d399" });
}

function formatDate(date: string, locale: MonitorConfig["uiLanguage"]): string {
  return new Intl.DateTimeFormat(locale === "zh-CN" ? "zh-CN" : "en-AU", {
    timeZone: "Australia/Sydney",
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(new Date(`${date}T12:00:00+11:00`));
}

function hash(value: string): string {
  let output = 0;
  for (let index = 0; index < value.length; index += 1) {
    output = (output * 31 + value.charCodeAt(index)) >>> 0;
  }
  return output.toString(36);
}
