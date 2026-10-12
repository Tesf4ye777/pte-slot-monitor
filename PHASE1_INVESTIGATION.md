# PTE Slot Sniper — Phase 1 官网调查报告

调查日期：2026-10-11（Australia/Sydney）

## 结论摘要

- PTE Academic 的公开考位可以在未登录状态下查看。
- 官方入口最终跳转到 Pearson VUE 的 `Find an appointment` 页面。
- 悉尼搜索会返回多个考试中心；每个中心分别展示首个可用日期和该日的具体时间。
- 页面为服务端生成的 JSF/RichFaces 应用。初次查询通过表单 POST，后续月份与日期切换通过会话绑定的 RichFaces AJAX POST 加载。
- 没有发现公开、文档化、允许第三方自动轮询的考位 API。
- Pearson PTE 和 Pearson VUE 的现行官方条款都明确禁止未经事先书面许可的机器人、脚本、抓取或自动化监控。
- 因此，不应实现扩展自行每 5 分钟请求官网的轮询器，也不应直接调用或重放内部 JSF 请求。
- 合规 MVP 应采用“用户主动查询 + 当前官方页面 DOM 解析 + 页面变化监听 + 本地即时通知”的方式。扩展不主动刷新或请求考位数据。

## 1. 实际预约路径

从 `https://www.pearsonpte.com/` 首页开始：

1. 点击 `Check availability`。
2. 选择目的地 `Australia`。
3. 选择目标 `Migrate`。
4. 官网推荐 `PTE Academic`，并提供预约链接：
   `https://mypte.pearsonpte.com/test/search?destination=AU&goal=SET&examCode=PTE-A`
5. 页面随后跳转至 Pearson VUE 的公开 `Find an appointment` 页面。
6. 输入 `Sydney NSW Australia` 并点击 `Search`，即可查看考点、日期和时间。

### 登录要求

- 查看公开考点与考位：本次实测不需要登录。
- 完成预约：没有继续点击 `Book`，因为 Phase 1 不应创建或推进预约；预计后续流程会要求登录或创建账户，需在后续人工验证。

## 2. Sydney 实测结果快照

以下是 2026-10-11 的一次低频人工查询快照，只代表当时页面状态，不是持续监控结果：

| 考点 | 中心 ID | 当时显示的首个日期 | 当时显示的时间 |
| --- | ---: | --- | --- |
| Pearson Professional Centers-Sydney, Australia | 50482 | 2026-10-18 | 18:00、20:30 |
| Navitas English Test Centre- Sydney | 55509 | 2026-10-21 | 08:45、12:45 |
| Navitas English Test Centre- Sydney (Room 2) | 81391 | 2026-10-20 | 08:45、12:45 |
| Lateral Plains - Kensington | 86006 | 2026-10-15 | 12:15 |
| Macquarie University | 84642 | 2026-10-16 | 18:00 |
| Pearson Professional Centers-Parramatta NSW | 81598 | 2026-10-18 | 15:30、18:00、20:30 |

本次快照中，2026-10-11、2026-10-12、2026-10-13 均未显示可预约考位。查询失败与无考位必须在实现中严格区分；本次属于页面成功返回且目标日期显示为不可用。

`Show more` 会继续扩展搜索半径，出现 Newcastle、Canberra、Gold Coast 等远离 Sydney 的中心。因此“所有 Sydney 考点”不能简单等同于“无限展开所有结果”，后续应以城市/地址或允许的距离范围过滤，并允许用户勾选中心。

## 3. 日期与时间展示机制

### 日期选择器

- 每个考试中心有独立的日期输入框和日历按钮。
- 日历逐日标记 `Available` 或 `Unavailable`。
- 可用日期由每个中心页面脚本中的 JSON 初始化，例如：

```text
availableDatesJson = {
  "availableDates": ["10/18/2026", "10/20/2026", ...],
  "firstAvailableDate": "Sunday, 18 October 2026"
}
```

- 切换月份时会动态请求该中心、该年月的可用日期。

### 具体时间

- 每个中心的当前日期旁有原生 `<select>` 时间下拉框。
- 选择新的可用日期后，页面会动态请求该中心当天的考试时间，并更新下拉框。
- 页面明确提示应核对时间格式和时区；当前页面可在高级设置中调整 12/24 小时显示。

## 4. 数据获取机制

### 页面技术栈

- 服务端表单：JSF ViewState。
- 动态组件：RichFaces AJAX。
- 日历：jQuery UI datepicker。
- 地点：Google Maps/Geocoding 相关脚本。
- 页面还加载 `cdn.perfdrive.com/aperture/aperture.js`，说明存在边缘安全/流量防护组件，但本次正常低频操作未触发 CAPTCHA。

### 初次搜索

地点搜索通过同一会话下的表单 POST 完成，表单 action 形如：

```text
/testtaker/registration/CombinedTestCenterSearchPage/PEARSONLANGUAGE/{conversationId}
```

响应 HTML 中直接包含：

- 考点名称、地址、距离、内部中心 ID；
- 每个中心的首个可用日期；
- 当前日期对应的时间下拉选项；
- 每个中心当月可用日期的 JSON；
- 后续 AJAX 组件定义。

### 后续动态请求

页面定义了会话内 RichFaces AJAX 方法，逻辑形态为：

```text
getAvailableDaysAjax(year, month, testCenterId)
getAppointmentTimesForDayAjax(selectedDay, testCenterId)
```

这些请求依赖：

- 当前 `conversationId`；
- JSF `javax.faces.ViewState`；
- 当前页面动态生成的组件 ID、队列 ID 和实例编号；
- 当前浏览器会话和页面状态。

因此它们不是稳定、公开的 API。直接重放会很脆弱，也属于条款所禁止的自动化访问。

## 5. CAPTCHA、限流与错误状态

- 本次一次正常公开查询未出现 CAPTCHA。
- 页面未公开明确的请求频率上限，也未在正常操作中返回 429。
- 不能据此推断没有限流或反机器人措施。
- 页面加载了流量防护脚本；高频或自动化访问可能触发验证、封禁或其他限制。
- 后续扩展必须把以下情况视为错误或需要人工处理，绝不能显示为“无考位”：
  - 登录页或会话过期；
  - CAPTCHA / verification 页面；
  - 429 或其他限流响应；
  - 处理请求对话框长时间不消失；
  - 页面结构变化、缺少预期字段；
  - 某个考点日期或时间加载失败。

## 6. 官方条款约束

### Pearson PTE

PTE 的 End User Licence Agreement 明确表示，未经事先书面许可，不得在网站任何部分使用数据挖掘、机器人、抓取或类似的数据收集/提取方法：

`https://www.pearsonpte.com/policy-center/user-agreement/`

### Pearson VUE

Pearson VUE Terms of Service 同样明确禁止未经事先书面许可，使用 robots、bots、spiders、crawlers、scripts、code、software 或其他自动手段抓取、获取、收集或监控网站及相关应用的信息：

`https://www.pearsonvue.com/us/en/legal/terms-of-service.html`

由此得出：除非用户先取得 Pearson 的书面许可，否则不能实现自动刷新、后台周期性查询、直接调用内部接口或自动化页面搜索。

## 7. 推荐的后续技术方案

选择方案 A 的受限版本：Chrome Extension + 当前页面 DOM Monitoring。

允许的 MVP 行为：

1. 用户亲自打开官方 `Find an appointment` 页面并完成一次 Sydney 搜索。
2. 扩展只读取当前标签页中已经由官网呈现的考点、日期和时间。
3. 使用 `MutationObserver` 监听用户操作后页面自身发生的变化。
4. 对已呈现的数据做本地日期过滤、去重、排序和通知。
5. 提供 `打开官方查询页`、`解析当前页面` 和 `重新检查当前 DOM` 按钮。
6. 发现目标日期时触发桌面通知和声音；点击通知聚焦已有官方标签页或打开官方公开入口。
7. 绝不自动点击 `Book`、自动登录、自动提交订单或付款。

默认禁用的行为：

- `chrome.alarms` 周期性刷新官网；
- 后台 `fetch` / XHR 查询；
- 重放 RichFaces/JSF 内部 AJAX；
- 自动输入地点和点击搜索；
- CAPTCHA 处理或绕过；
- 绕过 429、WAF 或会话限制。

如果后续获得 Pearson 的明确书面许可，可再设计有速率上限、退避和 429 停止机制的自动查询模式；在此之前，界面不应声称“后台实时自动监控”。

## 8. Phase 2 所需验证

后续实现前或实现过程中仍需验证：

- 用户点击 `Book` 后的登录/账户要求和跳转行为（由用户手动完成，不自动预约）。
- 普通 Chrome 中 content script 对 Pearson VUE 页面 DOM 的可访问性。
- CSP、跨域 iframe 或 shadow DOM 是否影响解析。
- 官方页面结构在不同语言、屏幕尺寸和登录状态下是否一致。
- 浏览器通知与声音权限的实际体验。
- DOM 结构变化时的明确解析失败提示。

