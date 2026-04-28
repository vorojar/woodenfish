# LESSONS.md — 正念木鱼项目踩坑记录

记录已经踩过的坑，避免下次重复犯错。

## 1. 同名函数声明被静默覆盖

**症状**：`script.js` 中两个 `hitWoodfish()` 和两个 `stopAutoHit()`，第二份会覆盖第一份。语法上完全合法，IDE 也不会警告。前一份变成死代码，但你修代码时可能改的是死代码版本，bug 永远修不掉。

**怎么发现**：grep 自己写的核心函数名，看是否有多个 `function xxx() {`。

**预防**：项目里每个函数名只声明一次。开始编辑前 `grep -n "function 名字"` 自查。

## 2. UI 状态和业务状态绑得太紧

**症状**：用户切换"自动敲击木鱼"开关 → 程序调用 `stopAutoHit()` → 这个函数除了 `clearInterval` 还顺手把按钮文案改成"开始修行"、移除 `active` class。但用户**只是切到手动模式**，并没结束冥想。

**根因**：`stopAutoHit()` 干了三件事：
- 停定时器（业务）
- 改按钮 UI（视图）
- 上传数据（业务）

不同调用场景需要的子集不同。混在一起就会在某个场景出错。

**预防**：函数名是什么就只做什么。`stopAutoHit` 只停定时器；"结束冥想"是另一个函数 `endMeditation`，它内部组合 `stopAutoHit` + `uploadData` + 改按钮 UI 由调用方自己处理。

## 3. PWA 子路径部署的离线坑

**症状**：项目部署在 `https://example.com/woodenfish/`，sw.js 写 `caches.match('/index.html')` 兜底——这个路径在子路径下根本不存在；且 `index.html` 没在 install 阶段预缓存。结果离线刷新页面直接白屏。

**预防**：
- 部署在子路径下的 PWA，所有路径在 sw.js 里都要带前缀（用常量 `SCOPE_PATH`）
- HTML/CSS/JS 必须在 install 阶段预缓存，否则首次离线必失败
- `start_url` / `scope` 在 manifest.json 里写绝对 URL 时，本地开发会有 manifest 警告——属于设计 trade-off，可以忍

## 4. 多文件互相 monkey-patch 同一个 API

**症状**：`backgroundMusic.play` 在 `index.html` 两处都被 `originalPlay = play; play = function(){...originalPlay.apply...}`。第二次包装会包住第一次的。一个错误处理是 `Promise.reject`，另一个是 `Promise.resolve`，行为完全相反。

**根因**：两段代码都"想做正确的事"，但没意识到对方存在。

**预防**：
- monkey-patch 同一个 API 必须只在一个地方做
- 不同文件之间用 window 上的明确接口通信（`window.isMusicAllowed()`），不要互相改对方的 API

## 5. localStorage 值拼进 CSS selector

**症状**：`document.querySelector(\`[data-src="${selectedMusic}"]\`)`——如果 `selectedMusic` 含 `"`、`]` 等字符，整个 selector 语法被破坏，`querySelector` 抛 `SyntaxError`，整个 DOMContentLoaded 中断，页面初始化失败。

**预防**：永远不要把外部数据（localStorage / URL / 用户输入）直接拼进 selector。改用 `dataset.xxx` 遍历比对，或 `CSS.escape()`。

## 6. 闭包变量遮蔽

**症状**：外层 `let dailyData = JSON.parse(...)`，内层函数 `function getTodayData() { const dailyData = JSON.parse(...); ... }`——内层 `dailyData` 遮蔽外层。读写函数共享外层变量，但 `getTodayData` 拿到的是局部副本。表面看似工作（因为每次都重读 localStorage），实际数据流割裂，一旦改成内存读就立刻出 bug。

**预防**：grep 同名变量声明，确认作用域。同名变量在嵌套作用域中就是定时炸弹。

## 7. `caches.delete()` 删整个 origin

**症状**：`caches.keys().then(keys => keys.map(caches.delete))`——这会删**整个 origin** 的所有 Cache Storage，包括同域下其他 PWA 的缓存（比如 `https://example.com/blog/` 也是另一个 PWA）。

**预防**：删 cache 必须按前缀过滤：`keys.filter(k => k.startsWith('myapp-')).map(caches.delete)`。CACHE_NAME 命名要带项目前缀。

## 8. 模拟成功的"假上传"会丢数据

**症状**：`uploadData()` 里实际 fetch 被注释掉只剩 mock，但仍执行了"清空 pendingHits/pendingScore"逻辑。结果数据被永久丢弃。

**预防**：mock 阶段也要走 mock 实现（比如把 pendingData push 到 `__mockUploads` 数组），不能"假装成功"然后清状态。如果是 placeholder，就 throw 或 console.warn 并保留 pending。

## 9. `window.location.reload(true)`

**症状**：`true` 参数已非标准，多数浏览器忽略。你以为强制绕过了缓存，实际没有。

**预防**：要绕缓存就 `caches.delete(name)` + `reload()`，不要依赖 `reload(true)`。

## 10. SW 缓存 HTML 不升版本号

**症状**：sw.js 里 `index.html` 走 cache-first 且版本号不变 → 用户首次访问后该浏览器永远拿不到新 HTML。改 SW 必须升 `CACHE_NAME`。

**预防**：HTML/CSS/JS 默认走 **network-first**，cache 只是离线兜底。版本号管理统一在 `CACHE_NAME` 里，不要散落在各处 `?v=20250222184` query string。

## 11. SW 的 cache-first 兜底会污染动态接口（HTTP 缓存层之外）

**症状**：v1.5.1 跨设备同步停在 29，KV 已是 984。fetch handler 写"已知核心代码 network-first，**其他全部** cache-first + `cache.put`"——跨源 `GET /sync/:code` 第一次响应被永久写进 Cache Storage，HTTP 头/客户端 `cache:'no-store'` 都挡不住，因为 SW 在它们前面。即便修完后老用户首次刷新仍读旧值，旧 SW 还在 controller 位置先拦截。

**预防**：fetch handler 必须 `if (url.origin !== self.location.origin) return;`，同源动态接口（`/api/`、`/sync/`）加路径黑名单。客户端听 `controllerchange` 在新 SW 接管时主动重跑关键业务（**不要 reload**）。调缓存问题先开 Application → Cache Storage 看，比查 HTTP 头快 10 倍。

## 12. push 静默吞失败 + 启动不主动补传

**症状**：sync 模块 `dirty=false; try{fetch}catch{dirty=true}` 只对网络断重试，5xx/`!r.ok` 不抛会吃掉 dirty。`dirty` 是内存状态刷新就丢，离线积压的本地数据下次打开页面只 pull 不 push，用户不敲新的就永远不补传。

**预防**：fetch 后只有"成功路径 return"，**其他全部恢复 dirty=true**——fetch 不抛 ≠ 成功。启动 pullAndMerge 后比对 `本地 > 云端` 立即 flush，等价于"启动把差异当 dirty"。

## 13. 修完非平凡 bug 让另一个 AI 独立 review

**实践**：Claude 修了 SW 缓存污染推上 1.5.1，让 codex review。codex 验证 root cause 正确还抓出 4 个连带 bug（教训 11-12 大多来自这次 review）+ 3 个架构延伸风险。同一修复者盲区高度相关，独立视角拉出一圈连带问题。

**预防**：分清 A 类（立刻该修的连带 bug）和 B 类（架构改造话题，记 LESSONS 不立刻动），别一个 bug 拖出十个新功能。
