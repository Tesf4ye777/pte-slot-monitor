import React, { useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  DEFAULT_CONFIG,
  INITIAL_STATE,
  STORAGE_KEYS
} from "../shared/constants";
import {
  clampRefreshInterval,
  isValidDateRange,
  isValidRefreshInterval
} from "../shared/monitor-config";
import { countdownTo, relativeTime } from "../shared/time-display";
import type { ExtensionMessage, MonitorConfig, MonitorState, PTESlot } from "../shared/types";
import { COPY } from "./copy";
import "./styles.css";

const IS_FLOATING_MODE = new URLSearchParams(window.location.search).get("mode") === "floating";
if (IS_FLOATING_MODE) document.documentElement.classList.add("floating-mode");

function App(): React.JSX.Element {
  const [state, setState] = useState<MonitorState>(INITIAL_STATE);
  const [config, setConfig] = useState<MonitorConfig>(DEFAULT_CONFIG);
  const [actionError, setActionError] = useState<string>();
  const [scanning, setScanning] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [dateFromDraft, setDateFromDraft] = useState(DEFAULT_CONFIG.dateFrom);
  const [dateToDraft, setDateToDraft] = useState(DEFAULT_CONFIG.dateTo);
  const [refreshIntervalDraft, setRefreshIntervalDraft] = useState(
    String(DEFAULT_CONFIG.refreshIntervalMinutes)
  );
  const [settingsError, setSettingsError] = useState<string>();
  const [settingsApplied, setSettingsApplied] = useState(false);
  const locale = config.uiLanguage;
  const copy = COPY[locale];

  useEffect(() => {
    void chrome.storage.local
      .get([STORAGE_KEYS.state, STORAGE_KEYS.config])
      .then((stored) => {
        setState({ ...INITIAL_STATE, ...(stored[STORAGE_KEYS.state] as Partial<MonitorState>) });
        const loadedConfig = {
          ...DEFAULT_CONFIG,
          ...(stored[STORAGE_KEYS.config] as Partial<MonitorConfig>)
        };
        setConfig({
          ...loadedConfig,
          refreshIntervalMinutes: clampRefreshInterval(loadedConfig.refreshIntervalMinutes)
        });
      });

    const handleChange = (changes: Record<string, chrome.storage.StorageChange>) => {
      const stateChange = changes[STORAGE_KEYS.state];
      const configChange = changes[STORAGE_KEYS.config];
      if (stateChange?.newValue) setState({ ...INITIAL_STATE, ...stateChange.newValue });
      if (configChange?.newValue) {
        const changedConfig = { ...DEFAULT_CONFIG, ...configChange.newValue };
        setConfig({
          ...changedConfig,
          refreshIntervalMinutes: clampRefreshInterval(changedConfig.refreshIntervalMinutes)
        });
      }
    };
    chrome.storage.onChanged.addListener(handleChange);
    return () => chrome.storage.onChanged.removeListener(handleChange);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  useEffect(() => {
    setDateFromDraft(config.dateFrom);
    setDateToDraft(config.dateTo);
    setRefreshIntervalDraft(String(config.refreshIntervalMinutes));
  }, [config.dateFrom, config.dateTo, config.refreshIntervalMinutes]);

  const scanPage = useCallback(async () => {
    setScanning(true);
    setActionError(undefined);
    const response = (await chrome.runtime.sendMessage({
      type: "SCAN_ACTIVE_TAB"
    } satisfies ExtensionMessage)) as { ok: boolean; error?: string };
    if (!response.ok) setActionError(response.error);
    setScanning(false);
  }, []);

  const showFloatingWindow = useCallback(async () => {
    setActionError(undefined);
    const response = (await chrome.runtime.sendMessage({
      type: "SHOW_FLOATING_WINDOW"
    } satisfies ExtensionMessage)) as { ok: boolean; error?: string };
    if (!response.ok) setActionError(response.error);
  }, []);

  const toggleSound = useCallback(async () => {
    const next = { ...config, soundEnabled: !config.soundEnabled };
    setConfig(next);
    await chrome.storage.local.set({ [STORAGE_KEYS.config]: next });
  }, [config]);

  const toggleLanguage = useCallback(async () => {
    const next = { ...config, uiLanguage: config.uiLanguage === "zh-CN" ? "en" : "zh-CN" } satisfies MonitorConfig;
    setConfig(next);
    await chrome.storage.local.set({ [STORAGE_KEYS.config]: next });
  }, [config]);

  const toggleAutoRefresh = useCallback(async () => {
    const next = { ...config, autoRefreshEnabled: !config.autoRefreshEnabled };
    setConfig(next);
    await chrome.storage.local.set({ [STORAGE_KEYS.config]: next });
  }, [config]);

  const applySettings = useCallback(async () => {
    setSettingsApplied(false);
    const interval = Number(refreshIntervalDraft);
    if (!isValidRefreshInterval(interval)) {
      setSettingsError(copy.invalidInterval);
      return;
    }
    if (!isValidDateRange(dateFromDraft, dateToDraft)) {
      setSettingsError(copy.invalidDateRange);
      return;
    }

    setSettingsError(undefined);
    const next = {
      ...config,
      dateFrom: dateFromDraft,
      dateTo: dateToDraft,
      refreshIntervalMinutes: interval
    };
    setConfig(next);
    await chrome.storage.local.set({ [STORAGE_KEYS.config]: next });
    setSettingsApplied(true);
    const response = (await chrome.runtime.sendMessage({
      type: "SCAN_ACTIVE_TAB"
    } satisfies ExtensionMessage)) as { ok: boolean; error?: string };
    if (!response.ok) setActionError(response.error);
  }, [config, copy.invalidDateRange, copy.invalidInterval, dateFromDraft, dateToDraft, refreshIntervalDraft]);

  const view = statusView(state, locale);
  const firstSlot = state.currentSlots[0];

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <h1>{copy.appTitle}</h1>
        </div>
        <div className="header-actions">
          <button
            className="language-toggle"
            onClick={toggleLanguage}
            aria-label={copy.switchLanguageLabel}
            title={copy.switchLanguageLabel}
          >
            {locale === "zh-CN" ? "EN" : "中文"}
          </button>
          <button
            className={`sound-toggle ${config.soundEnabled ? "is-on" : ""}`}
            onClick={toggleSound}
            aria-label={config.soundEnabled ? copy.disableSound : copy.enableSound}
            title={config.soundEnabled ? copy.disableSound : copy.enableSound}
          >
            <SoundIcon muted={!config.soundEnabled} />
          </button>
        </div>
      </header>

      <section className="connection-strip" aria-live="polite">
        <span className={`status-dot ${view.tone}`} />
        <div>
          <strong>{view.connection}</strong>
          <span>{state.monitoredTabId ? copy.pearsonSydney : copy.openOfficialSearch}</span>
        </div>
      </section>

      <section className="settings-panel">
        <div className="settings-heading">
          <strong>{copy.monitorSettings}</strong>
          <label className="auto-toggle">
            <span>{copy.autoRefresh}</span>
            <button
              className="switch-button"
              onClick={toggleAutoRefresh}
              aria-pressed={config.autoRefreshEnabled}
              aria-label={copy.autoRefresh}
            >
              <span className={`switch ${config.autoRefreshEnabled ? "is-on" : ""}`} aria-hidden="true"><span /></span>
            </button>
          </label>
        </div>
        <div className="date-range-inputs">
          <label>
            <span>{copy.startDate}</span>
            <input
              type="date"
              value={dateFromDraft}
              aria-label={copy.startDate}
              onChange={(event) => {
                setDateFromDraft(event.target.value);
                setSettingsApplied(false);
                setSettingsError(undefined);
              }}
            />
          </label>
          <span className="range-separator" aria-hidden="true">—</span>
          <label>
            <span>{copy.endDate}</span>
            <input
              type="date"
              value={dateToDraft}
              aria-label={copy.endDate}
              onChange={(event) => {
                setDateToDraft(event.target.value);
                setSettingsApplied(false);
                setSettingsError(undefined);
              }}
            />
          </label>
        </div>
        <div className="settings-bottom-row">
          <label className="interval-control">
          <span>{copy.refreshInterval}</span>
          <span className="interval-input-wrap">
            <input
              type="number"
              step="1"
              value={refreshIntervalDraft}
              onChange={(event) => {
                setRefreshIntervalDraft(event.target.value);
                setSettingsApplied(false);
                setSettingsError(undefined);
              }}
            />
            <span>{copy.minutes}</span>
          </span>
          </label>
          <button className={`apply-settings ${settingsApplied ? "is-applied" : ""}`} onClick={() => void applySettings()}>
            {settingsApplied ? copy.settingsApplied : copy.applySettings}
          </button>
        </div>
        {settingsError ? <p className="settings-error" role="alert">{settingsError}</p> : null}
        <div className="refresh-summary">
          <span>{config.autoRefreshEnabled ? `${copy.nextRefresh} ${countdownTo(state.nextAutoRefreshAt, nowMs)}` : pausedText(state, locale)}</span>
          <span>{refreshEvidence(state, nowMs, locale)}</span>
        </div>
      </section>

      <section className={`status-panel ${view.tone}`}>
        <div className="panel-heading">
          <span>{copy.currentStatus}</span>
          <time>{copy.pageChanged(relativeTime(state.lastPageChangeAt, nowMs, locale))}</time>
        </div>

        {firstSlot ? (
          <SlotCard slot={firstSlot} extraCount={state.currentSlots.length - 1} locale={locale} />
        ) : (
          <div className="empty-state">
            <StatusIcon tone={view.tone} />
            <div>
              <h2>{view.title}</h2>
              {view.description ? <p>{view.description}</p> : null}
            </div>
          </div>
        )}

        {actionError ? <p className="inline-error">{localizeActionError(actionError, locale)}</p> : null}

        <dl className="metrics">
          <div>
            <dt>{copy.parsedCenters}</dt>
            <dd>{state.parsedCenters}</dd>
          </div>
          <div>
            <dt>{copy.lastSuccessfulParse}</dt>
            <dd>{relativeTime(state.lastSuccessfulParseAt, nowMs, locale)}</dd>
          </div>
        </dl>
      </section>

      <button className="primary-action" onClick={scanPage} disabled={scanning}>
        <RefreshIcon />
        {scanning ? copy.scanning : copy.scanCurrentPage}
      </button>
      {!IS_FLOATING_MODE ? (
        <button className="secondary-action" onClick={showFloatingWindow}>
          <FloatingIcon />
          {copy.showFloatingWindow}
        </button>
      ) : null}
    </main>
  );
}

function SlotCard({
  slot,
  extraCount,
  locale
}: {
  slot: PTESlot;
  extraCount: number;
  locale: MonitorConfig["uiLanguage"];
}): React.JSX.Element {
  const copy = COPY[locale];
  return (
    <div className="slot-card">
      <div className="slot-date">
        <span>{formatDate(slot.date, locale)}</span>
        <strong>{slot.displayTime}</strong>
      </div>
      <h2>{slot.testCenterName}</h2>
      <p>{slot.address}</p>
      {extraCount > 0 ? <span className="more-slots">{copy.moreSlots(extraCount)}</span> : null}
    </div>
  );
}

function refreshEvidence(
  state: MonitorState,
  nowMs: number,
  locale: MonitorConfig["uiLanguage"]
): string {
  const last = state.lastAutoRefreshAt
    ? relativeTime(state.lastAutoRefreshAt, nowMs, locale)
    : undefined;
  if (locale === "zh-CN") {
    return `${state.autoRefreshCount} 次 · ${last ?? "尚未刷新"}`;
  }
  return `${state.autoRefreshCount} refreshes · ${last ?? "Not yet"}`;
}

function pausedText(state: MonitorState, locale: MonitorConfig["uiLanguage"]): string {
  if (locale !== "zh-CN") return state.autoRefreshPausedReason ?? "Paused";
  if (state.status === "verification_required") return "因需要人工验证而暂停";
  if (state.status === "rate_limited") return "因官网访问频率限制而暂停";
  return "已暂停";
}

function localizeActionError(
  error: string,
  locale: MonitorConfig["uiLanguage"]
): string {
  if (locale !== "zh-CN") return error;
  if (error.includes("No open Pearson VUE")) return "没有找到已打开的 Pearson VUE 考位页面。";
  if (error.includes("monitor is not attached")) return "官网页面已打开，但插件尚未连接。请手动刷新该标签页一次。";
  return "无法扫描当前页面，请确认 Pearson VUE 考位页面仍然打开。";
}

function statusView(
  state: MonitorState,
  locale: MonitorConfig["uiLanguage"]
): {
  connection: string;
  title: string;
  description?: string;
  tone: "healthy" | "warning" | "danger" | "muted";
} {
  const zh = locale === "zh-CN";
  switch (state.status) {
    case "slot_found":
      return {
        connection: zh ? "正在监控此页面" : "Watching this page",
        title: zh ? "发现符合条件的考位" : "Matching slot available",
        tone: "healthy"
      };
    case "watching":
      return {
        connection: zh ? "正在监控此页面" : "Watching this page",
        title: zh ? "当前页面没有符合条件的考位" : "No matching slots on this page",
        tone: "healthy"
      };
    case "checking":
      return {
        connection: zh ? "官网页面正在加载" : "Official page is loading",
        title: zh ? "正在等待 Pearson VUE" : "Waiting for Pearson VUE",
        tone: "warning"
      };
    case "parse_error":
    case "error":
      return {
        connection: zh ? "页面解析需要处理" : "Parser needs attention",
        title: zh ? "无法安全解析当前页面" : "Could not safely parse the page",
        description: zh ? "官网页面结构可能已经变化。本次检测不会报告为没有考位。" : state.lastError ?? "The official page structure may have changed. No availability conclusion was made.",
        tone: "danger"
      };
    case "waiting_for_search":
      return {
        connection: zh ? "等待你手动搜索" : "Ready for your search",
        title: zh ? "请在 Pearson VUE 搜索悉尼" : "Search Sydney on Pearson VUE",
        tone: "warning"
      };
    case "verification_required":
      return {
        connection: zh ? "需要人工验证" : "Manual verification required",
        title: zh ? "自动刷新已暂停" : "Automatic refresh paused",
        description: zh ? "请手动完成 Pearson 验证，然后重新开启自动刷新。" : "Complete Pearson's verification manually, then enable auto refresh again.",
        tone: "danger"
      };
    case "rate_limited":
      return {
        connection: zh ? "检测到访问频率限制" : "Request limit detected",
        title: zh ? "自动刷新已暂停" : "Automatic refresh paused",
        description: zh ? "插件已停止刷新，并且不会尝试绕过 Pearson 的访问限制。" : "The extension stopped refreshing and will not attempt to bypass Pearson's limit.",
        tone: "danger"
      };
    case "unsupported":
      return {
        connection: zh ? "当前页面不受支持" : "Unsupported page",
        title: zh ? "请打开 PTE Academic 考位页面" : "Open the PTE Academic appointment page",
        tone: "warning"
      };
    default:
      return {
        connection: zh ? "尚未连接监控页面" : "No monitored page",
        title: zh ? "请打开官网预约页面" : "Open the official booking page",
        tone: "muted"
      };
  }
}

function formatDate(value: string, locale: MonitorConfig["uiLanguage"]): string {
  return new Intl.DateTimeFormat(locale === "zh-CN" ? "zh-CN" : "en-AU", {
    timeZone: "Australia/Sydney",
    weekday: "short",
    day: "numeric",
    month: "short"
  }).format(new Date(`${value}T12:00:00+11:00`));
}

function SvgIcon({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <svg viewBox="0 0 24 24" aria-hidden="true">{children}</svg>;
}

function SoundIcon({ muted }: { muted: boolean }): React.JSX.Element {
  return (
    <SvgIcon>
      <path d="M11 5 6.8 8.4H3.5v7.2h3.3L11 19V5Z" />
      {muted ? <path d="m16 9 5 5m0-5-5 5" /> : <path d="M15 8.5a5 5 0 0 1 0 7M18 5.8a8.5 8.5 0 0 1 0 12.4" />}
    </SvgIcon>
  );
}

function RefreshIcon(): React.JSX.Element {
  return <SvgIcon><path d="M20 7v5h-5M4 17v-5h5M6.1 8.5A7 7 0 0 1 18.8 7M5.2 17A7 7 0 0 0 17.9 15.5" /></SvgIcon>;
}

function FloatingIcon(): React.JSX.Element {
  return <SvgIcon><rect x="4" y="5" width="16" height="14" rx="2" /><path d="M8 9h8M8 13h5" /></SvgIcon>;
}

function StatusIcon({ tone }: { tone: string }): React.JSX.Element {
  if (tone === "danger") return <SvgIcon><path d="M12 8v5m0 3h.01M10.2 4.6 3.5 17a2 2 0 0 0 1.8 3h13.4a2 2 0 0 0 1.8-3L13.8 4.6a2 2 0 0 0-3.6 0Z" /></SvgIcon>;
  if (tone === "warning") return <SvgIcon><path d="M12 3v3m0 12v3M3 12h3m12 0h3M5.6 5.6l2.1 2.1m8.6 8.6 2.1 2.1m0-12.8-2.1 2.1m-8.6 8.6-2.1 2.1" /></SvgIcon>;
  return <SvgIcon><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></SvgIcon>;
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode><App /></React.StrictMode>
);
