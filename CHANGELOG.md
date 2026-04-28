# 变更日志

本文件记录正念木鱼项目的发布历史。版本号对应 `sw.js` 的 `CACHE_NAME`。

## [1.5.1] - 2026-04-28

### 修复（严重）
- **跨设备同步失效**：SW 的 fetch handler 对所有非核心代码 GET 请求走 cache-first 并写入 Cache Storage，导致 `GET /sync/:code` 第一次的响应被永久缓存，之后任何设备拉云端永远拿到第一次那份旧数据，新数据再多也合不进来。fix：SW 检测到 host 为 `woodenfish-sync.vorojar.workers.dev` 时直接 `return` 不拦截。
- Worker 响应头补 `Cache-Control: no-store`，挡住浏览器/中间代理的二次缓存。
- 客户端 `pullAndMerge` 和 `bindNewCode` 的 `fetch` 加 `cache: 'no-store'`，最后一道保险。

### 部署
- SW CACHE_NAME: 1.5.0 → 1.5.1（新 SW 激活时会自动清掉 1.5.0 缓存里被污染的同步响应）
- `index.html` 的 `script.js` / `style.css` query string 升 1.5.0 → 1.5.1

## [1.5.0] - 2026-04-28

### 云同步（核心新功能）
- 新增"修行码"系统：免注册，进入即自动获得 6 位短码（A-Z + 2-9，去除易混 0/O/1/I）
- 新增 Cloudflare Worker `woodenfish-sync` + KV namespace 作为后端
- 数据本地优先：敲击不等服务器，5 秒 debounce 后台异步推送
- `pagehide` / `visibilitychange` 用 `navigator.sendBeacon` 兜底，关页面/切后台时保住最后一次数据
- 服务端 max 合并策略，敲击只增不减，多设备/网络异常下不丢数据
- 服务端 POST 后返回最新 merged 数据，客户端立即合并，绕过 KV 最终一致性延迟
- 跨设备恢复：在另一台设备点"输入码恢复"，输入 6 位短码 → 自动拉云端 + 合并到本地

### UI
- 趋势面板顶部加"已绑定 XXXXXX [复制] [输入码恢复]"状态条
- 复制按钮支持 Clipboard API + 老浏览器的 Selection API 退化

### 部署
- 新增 `worker/` 目录（CF Worker 代码 + wrangler.toml）
- KV namespace `DATA`（id `aec0c5eae93444ff8bf451d8817b2951`）
- Worker 域名 `woodenfish-sync.vorojar.workers.dev`，CORS 白名单 `woodenfish.bibidu.com` + 本地开发
- SW CACHE_NAME: 1.4.0 → 1.5.0

## [1.4.0] - 2026-04-28

### 法律 / 合规
- 新增 `LICENSE` 文件（MIT），README 声明的 MIT 落地

### 健壮性
- 新增 `storage` 安全包装：`localStorage.setItem` 在隐身模式 / 配额满 / 禁 cookie 时不抛异常，降级为 `console.warn`
- 删除全部 mock 上传代码（`initSession` / `uploadData` / `prepareUploadData` / `generateSessionHash` / `pendingHits` / `beforeunload` 上传等），减少误导，net `-150` 行

### 无障碍
- viewport `maximum-scale=1.0, user-scalable=no` 改回允许缩放（WCAG 1.4.4）
- viewport 加 `viewport-fit=cover` 适配刘海屏

### iOS PWA 体验
- 新增 9 张 `apple-touch-startup-image`（覆盖 iPhone 8 → 16, iPad → iPad Pro 12.9"）
- 新增 iOS Safari "添加到主屏" 引导横幅，可一次性关闭（记住偏好）

### Manifest 增强
- 新增 `screenshots`（首页竖屏 / 趋势面板竖屏 / 桌面横屏 3 张）→ Chrome 安装提示卡片更丰富
- 新增 `shortcuts`：长按图标可直达"修行趋势"
- 新增 `lang` / `dir` / `categories` / `orientation` 等 PWA 完整字段
- icons 拆分 `purpose: any` 与 `purpose: maskable`，避免 Android adaptive icon 误裁

### 路由
- 新增 `?view=trend` query 参数自动打开趋势面板（配合 PWA shortcut）

### 部署
- SW CACHE_NAME: 1.3.1 → 1.4.0

## [1.3.1] - 2026-04-28

### 部署
- 切换到 `woodenfish.bibidu.com`（GitHub Pages + CNAME）
- 路径从 `/woodenfish/` 子路径改为根路径 `/`
- 新增根目录 `CNAME` 文件
- 删除已失效的 vercel 部署引用

### SEO
- 新增 `<link rel="canonical">`
- 新增 og:locale / og:site_name
- og:image / twitter:image 改为绝对 URL
- 升级 JSON-LD 结构化数据：alternateName / inLanguage / isAccessibleForFree / 更精确的 applicationCategory
- 新增 `robots.txt` 和 `sitemap.xml`
- 优化 title / description / keywords 提升搜索可发现性
- SW CACHE_NAME: 1.3.0 → 1.3.1

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
