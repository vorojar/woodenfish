# CLAUDE.md — 正念木鱼项目协作上下文

## 项目概览

纯静态 PWA：HTML/CSS/JS + Service Worker + LocalStorage。无构建步骤，无依赖。
生产部署在 `https://www.maikami.com/woodenfish/` 子路径下，本地调试需要把项目放到 `/woodenfish/` 路径下访问，否则 SW 注册失败、manifest scope 警告。

```
index.html      入口，含微信 JSSDK / 梵音环绕开关 / SW 注册三段内联脚本
script.js       核心逻辑：敲击、计分、热力图、会话哈希、音乐选择
sw.js           Service Worker：核心代码 network-first，静态资源 cache-first
manifest.json   PWA manifest（start_url/scope 都写死生产域名）
style.css       样式
music/          mp3 文件，不预缓存（按需 cache-first）
```

## 关键约定

### 子路径部署
- SW 注册路径写死 `/woodenfish/sw.js`，本地调试必须用同样的子路径访问
- `sw.js` 内 `SCOPE_PATH = '/woodenfish/'` 影响预缓存清单
- `manifest.json` 的 `start_url` / `scope` 是生产域名，本地访问会有 manifest 警告（无害）

### 缓存策略
- `CACHE_NAME = 'woodenfish-1.x.y'` 改文件后必须升版本号
- HTML/CSS/JS/manifest 走 **network-first**（拿最新）
- 图片/mp3/icon 走 **cache-first**（cache hit 即返）
- `updateApp()` 只清前缀 `woodenfish-` 的 cache，不影响同域其他 PWA

### 内联脚本职责划分
- `index.html` 只管：微信 JSSDK 配置、梵音环绕 UI 显示/隐藏、`backgroundMusic.play` 拦截、SW 注册
- `script.js` 管所有：音乐选择、音量、currentMusic 状态、localStorage、冥想流程、统计

不要在两个文件里同时绑定同一个事件，会重复触发。

### 状态管理坑
- `currentMusic` 是 `script.js` 闭包变量，修改后**必须**同步 `localStorage.selectedMusic`
- 关闭"梵音环绕"必须同时清三处：DOM `.music-item.active`、`currentMusic`、`localStorage.selectedMusic`
- "自动敲击木鱼"开关只控制 `autoHitInterval`，**不能**触碰 `isMeditating` / 按钮 UI
- "结束修行"才走 `endMeditation()`（停定时器 + 上传待提交数据）

### 日期处理
- 所有"今天是几号"必须用本地时区（`getFullYear/getMonth/getDate`），禁止 `toISOString().slice(0,10)` —— UTC 早 8 点前会差一天
- 当前 `getCurrentDate()` 已正确实现，不要改

### LocalStorage Keys
- `selectedMusic` — 当前选中的音乐 src
- `dailyData` — `{ "YYYY-MM-DD": { hits, score } }`，加载时有 try/catch 兜底
- `totalHits` / `totalScore` — 累计敲击 / 灵子（数字字符串）

## 开发流程

1. 改完代码先 `node --check script.js && node --check sw.js`
2. 子路径起本地 server 测：`mkdir /tmp/test && ln -s $(pwd) /tmp/test/woodenfish && cd /tmp/test && python3 -m http.server 8765`，访问 `http://localhost:8765/woodenfish/`
3. 改了 sw.js 升 `CACHE_NAME`，否则用户拿不到新版本
4. 改了 index.html / script.js / style.css 顺手刷一下版本号 query string

## 已知未实现（TODO）

- `script.js` 的 `initSession` / `uploadData` / `beforeunload` 上传都是 mock，后端 API 没实现
- `index.html` 的 `/wxapi/wx_config.php` 在 vercel 静态部署下不存在，已改为 `response.ok` 检查并静默跳过
