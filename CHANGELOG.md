# 变更日志

本文件记录正念木鱼项目的发布历史。版本号对应 `sw.js` 的 `CACHE_NAME`。

## [1.3.0] - 2026-04-28

### 修复（严重）
- **关闭"自动敲击木鱼"开关时按钮状态错误**：之前会把按钮文案改回"开始修行"并移除 active class，但实际仍在冥想状态。现在切换该开关只影响自动敲击 interval，不再误改按钮 UI。
- **离线 fallback 路径错误**：之前 SW fallback 指向 `/index.html`，但项目部署在 `/woodenfish/` 子路径下且 `index.html` 未预缓存，离线导航必失败。现在预缓存 HTML/CSS/JS/manifest，fallback 指向 `/woodenfish/index.html`。

### 修复（中等）
- 删除 `script.js` 中 `hitWoodfish()` 和 `stopAutoHit()` 的重复定义（第二份覆盖第一份的死代码）。
- 修复 `dailyData` 变量遮蔽：`getTodayData()` 内部的 `const dailyData` 遮蔽了外层 `let`，读写不一致；现在统一使用闭包顶层变量。
- 修复"梵音环绕"关闭时状态分裂：之前只清 DOM active 和 audio src，不清 `currentMusic` / `localStorage.selectedMusic`，导致后续按钮误判存在背景音乐。现在三处状态一并清理。
- 移除 `index.html` 中重复的音乐选择 / 音量 / `play()` monkey-patch 逻辑，统一由 `script.js` 管理。`backgroundMusic.play` 现在只被包装一次。
- `localStorage.selectedMusic` 不再被拼进 CSS selector，改用 `dataset.src` 遍历查找，避免特殊字符破坏 selector。
- `JSON.parse(localStorage.dailyData)` 加 try/catch 兜底，本地数据损坏不再使主脚本崩溃。
- `updateApp()` 只清前缀 `woodenfish-` 的缓存，不再误删同域其他 PWA 的 Cache Storage。
- 微信 JSSDK 配置接口失败时静默跳过（vercel 静态部署没有 `/wxapi/wx_config.php`）。

### 修复（小）
- 删除 `index.html` 中重复的 `apple-mobile-web-app-capable` / `apple-mobile-web-app-status-bar-style` meta 标签（两处冲突值 `black` vs `black-translucent`，统一为 `black-translucent`）。
- 删除重复的 `apple-touch-icon` 声明，统一用 `icons/icon-192x192.png`。
- `showMusicPanel()` 不再自动选第一首并写入 `localStorage`，避免污染默认状态。
- `localStorage.selectedMusic` 指向已不存在的曲目时自动清掉。

### 清理
- 删除死代码：`dailyListElement` / `renderDailyList()` / `.tab-btn` 切换逻辑（HTML 中无对应元素）。
- 删除死状态变量：`let score` / `let totalHits`（只写不读，实际显示走 localStorage）。
- 删除 `script.js` 第一段不再使用的 `selectedMusic` 变量（与 `currentMusic` 重复）。

### 文档
- 新增 `CLAUDE.md`：项目协作上下文与约定。
- 新增 `CHANGELOG.md`：本文件。
- 新增 `LESSONS.md`：踩坑记录。

## [1.2.10] - 2025-04-12

- 历史版本（无详细记录）。
