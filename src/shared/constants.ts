import type { FloatingWindowState, MonitorConfig, MonitorState } from "./types";

export const OFFICIAL_SEARCH_URL =
  "https://mypte.pearsonpte.com/test/search?destination=AU&goal=SET&examCode=PTE-A";

export const MIN_REFRESH_INTERVAL_MINUTES = 1;
export const MAX_REFRESH_INTERVAL_MINUTES = 180;

export const DEFAULT_CONFIG: MonitorConfig = {
  uiLanguage: "en",
  examType: "PTE Academic",
  city: "Sydney",
  dateFrom: "2026-10-11",
  dateTo: "2026-10-13",
  timezone: "Australia/Sydney",
  notificationsEnabled: true,
  soundEnabled: true,
  autoRefreshEnabled: true,
  refreshIntervalMinutes: 10,
  maxDistanceMiles: 50
};

export const INITIAL_STATE: MonitorState = {
  status: "idle",
  parsedCenters: 0,
  checksCompleted: 0,
  autoRefreshCount: 0,
  currentSlots: [],
  activeSlotIds: [],
  history: []
};

export const DEFAULT_FLOATING_WINDOW_STATE: FloatingWindowState = {
  visible: true,
  minimized: false
};

export const STORAGE_KEYS = {
  config: "monitorConfig",
  state: "monitorState",
  floatingWindow: "floatingWindowState",
  notificationTargets: "notificationTargets"
} as const;
