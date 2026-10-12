# PTE Slot Monitor

一个适用于 Chrome 和 Microsoft Edge 的 PTE Academic 考位监控扩展。

## 主要功能

- 监控 Pearson VUE 页面中已经显示的悉尼考点、日期和时间。
- 自动刷新当前考位页面，刷新间隔可设置为 1–180 分钟。
- 自定义目标日期范围，并优先显示最早的符合考位。
- 发现新考位时发送桌面通知和声音提醒，同一考位不会重复通知。
- 支持可拖动的页面悬浮窗以及中英文界面。
- 遇到页面加载、验证码、访问限制或解析失败时会明确提示，不会误报“没有考位”。

## 快速安装

1. 下载或克隆本仓库。
2. 在 Edge 打开 `edge://extensions`，开启“开发人员模式”。
3. 点击“加载解压缩的扩展”，选择仓库中的 `dist` 文件夹。
4. 打开 Pearson PTE 官方考位页面并手动搜索 Sydney。
5. 在插件中设置日期范围和刷新间隔，点击“确认”。

> 本插件只读取和刷新用户已经打开的 Pearson 页面，不会自动点击搜索、预约或付款，不会绕过验证码，也不会重放 Pearson 内部请求。自动化监控可能受到 Pearson 使用条款限制，请自行确认并遵守相关条款。

## Development

Chrome Manifest V3 extension that refreshes the user's open Pearson VUE appointment page at a user-configured interval and detects PTE Academic slots loaded after each refresh.

> Automatic refresh is optional and enabled by default. The extension reloads only the already-open official results tab; it does not replay JSF/RichFaces calls, automatically click Search/Book, bypass verification, or make payments. Pearson's terms restrict automated monitoring without prior written permission; use the auto-refresh option only if you accept that constraint or have permission.

## What it does

- Watches the open Pearson VUE appointment results DOM with `MutationObserver`.
- Uses `chrome.alarms` to reload the monitored results tab at a configurable 1–180 minute interval (10 minutes by default), even while the popup is closed.
- Parses the real JSF/RichFaces result-card structure observed during Phase 1.
- Detects visible Sydney-area PTE Academic appointments within a user-selected date range (11–13 October 2026 by default).
- Saves the selected dates and refresh interval to `chrome.storage.local` only after the user presses **Apply / 确认**.
- Sorts matching slots by earliest date and time.
- Sends a persistent Chrome desktop notification for newly appearing slots.
- Plays a local alert using a Manifest V3 offscreen audio document.
- Avoids duplicate notifications while the same slot remains visible.
- Allows a slot to notify again after it disappears and later reappears.
- Stores configuration, current state, recent results and history in `chrome.storage.local`.
- Supports an English/简体中文 popup switch and remembers the selected language; desktop slot notifications use the same language.
- Adds a draggable in-page floating monitor on the Pearson results page, with minimize, close and saved position controls.
- Preserves the last known results during loading or parser errors and never reports those failures as “no slots”.
- Automatically disables refresh if a CAPTCHA/verification page or request-limit message is detected.

## Architecture

```text
Configurable chrome.alarm (1–180 minutes)
    ↓ reload existing Pearson tab
Pearson page DOM
    ↓ MutationObserver / manual Scan button
DOMSlotProvider
    ↓ ProviderResult (success, loading, waiting, parse_error…)
Target slot filter
    ↓ Sydney + selected date range + future time
Background state machine
    ├─ chrome.storage.local
    ├─ Chrome notification
    ├─ offscreen alert audio
    └─ Popup UI
```

`SlotProvider` is defined in `src/shared/types.ts`. `DOMSlotProvider` is the only implementation. A future authorized source can implement the same interface without changing filtering, storage, notifications or UI.

## Install dependencies

Requirements: Node.js 20 or newer and npm.

```powershell
npm install
```

## Test and build

```powershell
npm run check
```

The installable extension is written to `dist/`.

Individual commands:

```powershell
npm run typecheck
npm test
npm run build
```

## Load in Chrome Developer Mode

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select this project's `dist` directory.
5. Pin **PTE Slot Monitor** to the toolbar.

After rebuilding, click the extension's **Reload** button on `chrome://extensions`, then reload an already-open Pearson VUE tab once so the updated content script attaches.

Microsoft Edge is also supported: use `edge://extensions`, enable **Developer mode**, choose **Load unpacked**, and select the same `dist` directory.

## Use it

1. Click **Open booking page** in the popup, or visit:
   `https://mypte.pearsonpte.com/test/search?destination=AU&goal=SET&examCode=PTE-A`
2. On the official Pearson VUE page, manually search for `Sydney NSW Australia`.
3. Leave that results tab open.
4. Keep **Automatic refresh** enabled and choose an interval from 5 to 180 minutes.
5. The extension reloads that tab at the selected interval and parses the results after the page changes.
6. Use **Scan current page** to re-read the current DOM immediately without waiting for the next cycle.
7. If a target slot is shown, use the notification or popup button to return to the official page and complete booking manually.

Use the **中文 / EN** button in the popup header to switch languages. The choice is saved locally and remains active the next time the popup opens.

The floating monitor appears directly on the supported Pearson VUE results page. Drag its top bar to move it, use **− / +** to minimize or restore it, and use **×** to close it. Its position and state survive page refreshes. After closing it, reopen the toolbar popup and choose **Show floating window / 显示悬浮窗**.

The popup distinguishes:

- no monitored page;
- waiting for the user to search;
- Pearson page currently loading;
- successful parse with no matching target slot;
- matching slot found;
- parser/page-structure error.

“Scan current page” only reparses the DOM. The configured alarm performs the actual page reload. The popup displays a live `MM:SS` countdown, the automatic refresh count, the last automatic refresh time, the last observed page change and the last successful DOM parse.

## Notification and sound test

Automated tests cover the notification decision using the real card IDs and fields from Phase 1. For an end-to-end Chrome test without pretending mock data is live Pearson data:

1. Run `npm test` to verify the fixture scenarios.
2. Load the extension from `dist/`.
3. Open a local copy of the fixture only during development if you need to visually exercise the popup. Do not interpret it as live availability.

Chrome notifications must be permitted by the operating system. Sound can be toggled with the speaker button in the popup header.

## Tests

The desensitized HTML fixture reproduces the observed identifiers:

- `result_card_N`
- `test-center-info-link_N`
- `tc_address_CENTER_ID`
- `tc_distance_CENTER_ID`
- `preferredDateShown_N`
- `appt_menu_N`
- `progressDialog`

Verified scenarios:

1. No visible 11–13 October slot produces no target match.
2. A newly visible 12 October 09:30 slot is detected.
3. A continuously visible slot is not notified twice.
4. Changed date/time DOM after a month/date switch is reparsed.
5. A processing/loading page is not treated as no availability.
6. Changed result-card structure produces `parse_error`.
7. A slot that disappears and reappears can notify again.

## Real-site verification status

Verified during Phase 1 on 11 October 2026:

- public PTE Academic availability search did not require login;
- Sydney returned multiple center result cards;
- first available date and time options were rendered per card;
- opening a calendar exposed per-day Available/Unavailable states;
- changing month/date uses session-bound RichFaces/JSF AJAX;
- no target slot for 11–13 October was present in the one-time observation.

Still requiring ordinary user-environment verification:

- extension content-script access after loading it into the user's normal Chrome profile;
- OS-level notification permission and audible alert volume;
- behavior after Pearson changes its production markup;
- the account/login flow after the user manually clicks Book.

See `PHASE1_INVESTIGATION.md` for the complete investigation and terms constraints.

## Privacy and compliance

- No PTE credentials, cookies or authentication tokens are stored.
- No page data is sent to a third party.
- No Telegram integration is included in this MVP.
- The extension requests host access only for the official Pearson PTE/Pearson VUE pages used by this workflow.
- Automatic refresh uses `chrome.alarms` at a user-selected 1–180 minute interval and can be disabled from the popup. The popup reports an error only when a submitted value is outside that range; the limits are not shown as persistent helper text. This guardrail does not constitute Pearson authorization.
- It never automatically clicks a booking or payment control.
