export interface PTESlot {
  id: string;
  testCenterId: string;
  testCenterName: string;
  city: string;
  examType: "PTE Academic";
  date: string;
  time: string;
  displayTime: string;
  timezone: "Australia/Sydney";
  bookingUrl?: string;
  detectedAt: string;
  address?: string;
  distanceMiles?: number;
}

export type ProviderStatus =
  | "success"
  | "loading"
  | "waiting_for_search"
  | "verification_required"
  | "rate_limited"
  | "unsupported"
  | "parse_error";

export interface ProviderResult {
  provider: "dom";
  status: ProviderStatus;
  checkedAt: string;
  slots: PTESlot[];
  centerCount: number;
  message: string;
  error?: string;
}

export interface SlotProvider {
  readonly id: "dom";
  parse(document: Document, context: ProviderContext): ProviderResult;
}

export interface ProviderContext {
  now: Date;
  pageUrl: string;
}

export interface MonitorConfig {
  uiLanguage: "en" | "zh-CN";
  examType: "PTE Academic";
  city: "Sydney";
  dateFrom: string;
  dateTo: string;
  timezone: "Australia/Sydney";
  notificationsEnabled: boolean;
  soundEnabled: boolean;
  autoRefreshEnabled: boolean;
  refreshIntervalMinutes: number;
  maxDistanceMiles: number;
}

export interface FloatingWindowState {
  visible: boolean;
  minimized: boolean;
  x?: number;
  y?: number;
}

export type MonitorStatus =
  | "idle"
  | "watching"
  | "checking"
  | "slot_found"
  | "waiting_for_search"
  | "verification_required"
  | "rate_limited"
  | "parse_error"
  | "unsupported"
  | "error";

export interface HistoryEntry {
  checkedAt: string;
  status: ProviderStatus;
  centerCount: number;
  matchingSlotCount: number;
  reason: ScanReason;
  error?: string;
}

export interface MonitorState {
  status: MonitorStatus;
  providerStatus?: ProviderStatus;
  lastParsedAt?: string;
  lastPageChangeAt?: string;
  lastSuccessfulParseAt?: string;
  lastAutoRefreshAt?: string;
  nextAutoRefreshAt?: string;
  autoRefreshCount: number;
  autoRefreshPausedReason?: string;
  lastError?: string;
  providerMessage?: string;
  parsedCenters: number;
  checksCompleted: number;
  currentSlots: PTESlot[];
  activeSlotIds: string[];
  history: HistoryEntry[];
  monitoredTabId?: number;
  monitoredUrl?: string;
}

export type ScanReason = "initial" | "page_change" | "manual";

export interface ScanResultMessage {
  type: "SCAN_RESULT";
  result: ProviderResult;
  reason: ScanReason;
  lastPageChangeAt?: string;
}

export type ExtensionMessage =
  | ScanResultMessage
  | { type: "TRIGGER_SCAN" }
  | { type: "SCAN_ACTIVE_TAB" }
  | { type: "OPEN_BOOKING_PAGE"; url?: string }
  | { type: "SHOW_FLOATING_WINDOW" }
  | { type: "PLAY_ALERT" }
  | { type: "GET_STATE" };
