import {
  DEFAULT_CONFIG,
  DEFAULT_FLOATING_WINDOW_STATE,
  STORAGE_KEYS
} from "../shared/constants";
import type { FloatingWindowState, MonitorConfig } from "../shared/types";

const HOST_ID = "pte-slot-monitor-floating-host";
const WINDOW_WIDTH = 414;
const EDGE_GAP = 12;
const HEADER_HEIGHT = 40;

export function clampFloatingPosition(
  x: number,
  y: number,
  viewportWidth: number,
  viewportHeight: number
): { x: number; y: number } {
  return {
    x: Math.min(Math.max(EDGE_GAP, x), Math.max(EDGE_GAP, viewportWidth - WINDOW_WIDTH - EDGE_GAP)),
    y: Math.min(Math.max(EDGE_GAP, y), Math.max(EDGE_GAP, viewportHeight - HEADER_HEIGHT - EDGE_GAP))
  };
}

export async function mountFloatingWindow(): Promise<{ show: () => Promise<void> }> {
  document.getElementById(HOST_ID)?.remove();

  const stored = await chrome.storage.local.get([
    STORAGE_KEYS.floatingWindow,
    STORAGE_KEYS.config
  ]);
  let floatingState: FloatingWindowState = {
    ...DEFAULT_FLOATING_WINDOW_STATE,
    ...(stored[STORAGE_KEYS.floatingWindow] as Partial<FloatingWindowState> | undefined)
  };
  let config: MonitorConfig = {
    ...DEFAULT_CONFIG,
    ...(stored[STORAGE_KEYS.config] as Partial<MonitorConfig> | undefined)
  };

  const host = document.createElement("div");
  host.id = HOST_ID;
  host.style.all = "initial";
  const shadow = host.attachShadow({ mode: "closed" });
  shadow.innerHTML = `
    <style>
      :host { all: initial; }
      .window {
        position: fixed;
        z-index: 2147483647;
        width: ${WINDOW_WIDTH}px;
        height: min(720px, calc(100vh - 24px));
        display: flex;
        flex-direction: column;
        overflow: hidden;
        border: 1px solid #344150;
        border-radius: 14px;
        background: #0d1117;
        box-shadow: 0 18px 55px rgba(0, 0, 0, .38);
        color: #e8edf4;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      .window.is-hidden { display: none; }
      .window.is-minimized { height: ${HEADER_HEIGHT}px; }
      .window.is-minimized iframe { display: none; }
      .bar {
        height: ${HEADER_HEIGHT}px;
        flex: 0 0 ${HEADER_HEIGHT}px;
        display: flex;
        align-items: center;
        gap: 9px;
        padding: 0 8px 0 13px;
        border-bottom: 1px solid #27313d;
        background: #151b23;
        cursor: move;
        user-select: none;
        touch-action: none;
      }
      .window.is-minimized .bar { border-bottom: 0; }
      .grip { color: #657285; font-size: 15px; letter-spacing: -2px; }
      .title { flex: 1; font-size: 12px; font-weight: 700; }
      button {
        width: 27px;
        height: 27px;
        display: grid;
        place-items: center;
        padding: 0;
        border: 1px solid #344150;
        border-radius: 8px;
        color: #9ba7b7;
        background: #10161d;
        font: 700 16px/1 system-ui, sans-serif;
        cursor: pointer;
      }
      button:hover { color: #ffffff; border-color: #4c5d70; }
      button:focus-visible { outline: 2px solid #84e7c2; outline-offset: 1px; }
      iframe { width: 100%; min-height: 0; flex: 1; border: 0; background: #0d1117; }
      @media (max-width: 460px) {
        .window { width: calc(100vw - 24px); }
      }
    </style>
    <section class="window" role="dialog" aria-label="PTE Slot Monitor">
      <header class="bar">
        <span class="grip" aria-hidden="true">⠿</span>
        <span class="title"></span>
        <button class="minimize" type="button"></button>
        <button class="close" type="button">×</button>
      </header>
      <iframe title="PTE Slot Monitor"></iframe>
    </section>
  `;
  (document.body ?? document.documentElement).appendChild(host);

  const panel = shadow.querySelector<HTMLElement>(".window")!;
  const bar = shadow.querySelector<HTMLElement>(".bar")!;
  const title = shadow.querySelector<HTMLElement>(".title")!;
  const minimizeButton = shadow.querySelector<HTMLButtonElement>(".minimize")!;
  const closeButton = shadow.querySelector<HTMLButtonElement>(".close")!;
  const iframe = shadow.querySelector<HTMLIFrameElement>("iframe")!;
  iframe.src = `${chrome.runtime.getURL("popup/index.html")}?mode=floating`;

  function copy(): { title: string; minimize: string; restore: string; close: string } {
    return config.uiLanguage === "zh-CN"
      ? { title: "PTE 考位监控", minimize: "最小化", restore: "恢复窗口", close: "关闭悬浮窗" }
      : { title: "PTE Slot Monitor", minimize: "Minimize", restore: "Restore", close: "Close floating window" };
  }

  function render(): void {
    const labels = copy();
    panel.classList.toggle("is-hidden", !floatingState.visible);
    panel.classList.toggle("is-minimized", floatingState.minimized);
    title.textContent = labels.title;
    minimizeButton.textContent = floatingState.minimized ? "+" : "−";
    minimizeButton.title = floatingState.minimized ? labels.restore : labels.minimize;
    minimizeButton.setAttribute("aria-label", minimizeButton.title);
    closeButton.title = labels.close;
    closeButton.setAttribute("aria-label", labels.close);

    const fallbackX = window.innerWidth - WINDOW_WIDTH - 24;
    const position = clampFloatingPosition(
      floatingState.x ?? fallbackX,
      floatingState.y ?? 24,
      window.innerWidth,
      window.innerHeight
    );
    floatingState = { ...floatingState, ...position };
    panel.style.left = `${position.x}px`;
    panel.style.top = `${position.y}px`;
  }

  async function persist(): Promise<void> {
    await chrome.storage.local.set({ [STORAGE_KEYS.floatingWindow]: floatingState });
  }

  minimizeButton.addEventListener("click", (event) => {
    event.stopPropagation();
    floatingState = { ...floatingState, minimized: !floatingState.minimized, visible: true };
    render();
    void persist();
  });

  closeButton.addEventListener("click", (event) => {
    event.stopPropagation();
    floatingState = { ...floatingState, visible: false };
    render();
    void persist();
  });

  bar.addEventListener("pointerdown", (event) => {
    if ((event.target as HTMLElement).closest("button")) return;
    event.preventDefault();
    const startX = event.clientX;
    const startY = event.clientY;
    const originX = floatingState.x ?? panel.offsetLeft;
    const originY = floatingState.y ?? panel.offsetTop;

    const move = (moveEvent: PointerEvent) => {
      const position = clampFloatingPosition(
        originX + moveEvent.clientX - startX,
        originY + moveEvent.clientY - startY,
        window.innerWidth,
        window.innerHeight
      );
      floatingState = { ...floatingState, ...position };
      panel.style.left = `${position.x}px`;
      panel.style.top = `${position.y}px`;
    };
    const end = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      void persist();
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end, { once: true });
  });

  window.addEventListener("resize", () => {
    render();
    void persist();
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local") return;
    if (changes[STORAGE_KEYS.config]?.newValue) {
      config = {
        ...DEFAULT_CONFIG,
        ...(changes[STORAGE_KEYS.config].newValue as Partial<MonitorConfig>)
      };
      render();
    }
  });

  render();
  return {
    show: async () => {
      floatingState = { ...floatingState, visible: true };
      render();
      await persist();
    }
  };
}
