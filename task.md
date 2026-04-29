# 后续扩容任务

## 背景

当前项目部署在 Cloudflare Workers 免费版，云同步使用 Workers KV。免费版 KV 写入额度很紧（约 1,000 次/天），而旧逻辑在持续自动敲击时最多每 5 秒写一次 KV，1 个用户自动敲击 1 小时就会消耗约 720 次写入。

本次已先把客户端改为“本地实时累计，云端低频增量批量同步”：

- 持续敲击时最多每 5 分钟上报一次增量。
- 结束修行、关闭自动敲击、页面隐藏或关闭时立即补推未同步数据。
- 停敲后的跨设备 polling 从 15 秒降低到 2 分钟。
- Worker 绑定 D1 后会按 `eventId` 去重，再按天累加；未绑定 D1 时仍回落到旧 KV 逻辑。

这样可以把单人自动敲击 1 小时的写入量从约 720 次降到约 13 次，容量提升约 55 倍；如果用户会正常结束修行，实际体验仍然接近实时本地、最终云端同步。

## 已完成

- 创建 D1 数据库 `woodenfish_sync`，绑定名 `DB`。
- 增加 D1 表：`sync_codes`、`daily_totals`、`sync_events`。
- Worker 已支持 v2 delta payload：`sessionId` + `eventId` + `{totalHits,totalScore,dailyData}`。
- Worker 已兼容旧客户端整份 payload，便于旧页面继续同步并迁移到 D1。
- Worker 已部署到 `https://woodenfish-sync.vorojar.workers.dev`。

## 待办

1. 增加同步状态提示

   为什么：低频同步后，云端不是秒级更新。界面应能显示“本地已保存 / 云端同步中 / 已同步 / 同步失败待重试”，避免用户误以为数据丢了。

2. 记录 `lastSyncedAt` 到 localStorage

   为什么：可以在页面重新打开时判断上次同步时间，超过一定时间就主动 `flush()` 或提示用户。也便于排查同步问题。

3. 增加失败重试退避

   为什么：当前 push 失败后只恢复 dirty，依赖下一次敲击触发重试。如果用户刚好停止操作，可能要等 pagehide 或下一次操作。应增加 30s/60s/120s 的轻量退避重试。

4. 只在必要场景启动 consumer polling

   为什么：跨设备实时同步不是所有用户都需要。可以只在用户打开趋势面板、恢复码后短时间内、或显式开启“跨设备实时同步”时 polling，进一步降低 KV read 和 Worker 请求。

5. 继续完善增量会话格式

   为什么：当前已改为 `sessionId` + `eventId` + delta 上报，并由 D1 去重累加。后续还可以增加客户端 batch 序号、设备名、会话开始/结束时间，方便排查和做排行榜。

6. 评估公共实时房间是否需要 Durable Object

   为什么：D1 已经适合批量增量和排行榜。如果以后要“同一房间秒级实时显示所有人敲击”，Durable Object 更适合单房间强一致计数和广播。

7. 增加 Worker 侧限流和 payload 校验

   为什么：公开接口需要防止异常客户端刷写、超大 dailyData、无意义频繁注册。可以按 Origin、code、IP 或 session 做轻量限制，保护免费额度。

8. 增加基础监控

   为什么：需要知道真实用户行为才能继续调参。建议记录每日 register/get/post 次数、失败率、平均 payload 大小、同步延迟，并在 Cloudflare Analytics 或日志中观察。

## 优先级建议

优先做 1-4，继续沿用当前 D1 增量架构，改动小、收益高。等产品上真的需要公共实时房间，再做 6。
