// 正念木鱼 同步 Worker
// 路由：
//   POST /sync/register             生成 6 位短码并预留空 record，返回 { code }
//   GET  /sync/:code                返回云端数据（不存在返回 404）
//   POST /sync/:code                v2 增量同步；兼容旧版整份数据 max 合并
//
// 架构：
//   - 有 D1 binding（DB）时：事件去重 + 按天增量累加，适合高并发/公共累计演进
//   - 无 D1 binding 时：回落到旧 KV（DATA）整份记录，保证现有部署不崩

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 去掉易混 0/O/1/I
const CODE_LENGTH = 6;
const MAX_REGISTER_RETRY = 8;
const MAX_BODY_BYTES = 50 * 1024;
const MAX_DELTA_VALUE = 1000000;

const ALLOWED_ORIGINS = [
    'https://woodenfish.bibidu.com',
    'http://localhost:8765',
    'http://127.0.0.1:8765',
];

let schemaReady = null;

function hasD1(env) {
    return !!env.DB?.prepare;
}

function genCode() {
    const buf = new Uint8Array(CODE_LENGTH);
    crypto.getRandomValues(buf);
    let s = '';
    for (let i = 0; i < CODE_LENGTH; i++) {
        s += ALPHABET[buf[i] % ALPHABET.length];
    }
    return s;
}

function nowMs() {
    return Date.now();
}

function isValidCode(code) {
    if (typeof code !== 'string' || code.length !== CODE_LENGTH) return false;
    for (const c of code) if (!ALPHABET.includes(c)) return false;
    return true;
}

function clampInt(value) {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return 0;
    return Math.min(MAX_DELTA_VALUE, Math.floor(n));
}

function corsHeaders(request) {
    const origin = request.headers.get('Origin') || '';
    const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
    return {
        'Access-Control-Allow-Origin': allow,
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Max-Age': '86400',
        'Vary': 'Origin',
    };
}

function json(body, status, request) {
    return new Response(JSON.stringify(body), {
        status,
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'no-store',
            ...corsHeaders(request),
        },
    });
}

function emptyRecord(ts = nowMs()) {
    return { totalHits: 0, totalScore: 0, dailyData: {}, updatedAt: ts };
}

function isDeltaPayload(body) {
    return body?.version === 2 && body?.type === 'delta';
}

function normalizeLegacyData(data) {
    const out = {
        totalHits: clampInt(data?.totalHits),
        totalScore: clampInt(data?.totalScore),
        dailyData: {},
        updatedAt: clampInt(data?.updatedAt) || nowMs(),
    };
    for (const [date, value] of Object.entries(data?.dailyData || {})) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
        const hits = clampInt(value?.hits);
        const score = clampInt(value?.score);
        if (hits || score) out.dailyData[date] = { hits, score };
    }
    return out;
}

function normalizeDelta(body) {
    const eventId = String(body?.eventId || '');
    const sessionId = String(body?.sessionId || '');
    if (!/^[A-Za-z0-9._:-]{8,96}$/.test(eventId)) return null;
    if (!/^[A-Za-z0-9._:-]{8,96}$/.test(sessionId)) return null;

    const dailyData = {};
    let totalHits = clampInt(body?.delta?.totalHits);
    let totalScore = clampInt(body?.delta?.totalScore);

    for (const [date, value] of Object.entries(body?.delta?.dailyData || {})) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
        const hits = clampInt(value?.hits);
        const score = clampInt(value?.score);
        if (hits || score) dailyData[date] = { hits, score };
    }

    if (!totalHits) {
        totalHits = Object.values(dailyData).reduce((sum, item) => sum + (item.hits || 0), 0);
    }
    if (!totalScore) {
        totalScore = Object.values(dailyData).reduce((sum, item) => sum + (item.score || 0), 0);
    }
    if (!totalHits && !totalScore) return null;

    return { eventId, sessionId, totalHits, totalScore, dailyData };
}

function mergeData(cloud, local) {
    const result = {
        totalHits: Math.max(cloud?.totalHits || 0, local?.totalHits || 0),
        totalScore: Math.max(cloud?.totalScore || 0, local?.totalScore || 0),
        dailyData: {},
        updatedAt: nowMs(),
    };
    const allDates = new Set([
        ...Object.keys(cloud?.dailyData || {}),
        ...Object.keys(local?.dailyData || {}),
    ]);
    for (const d of allDates) {
        const c = (cloud?.dailyData || {})[d] || { hits: 0, score: 0 };
        const l = (local?.dailyData || {})[d] || { hits: 0, score: 0 };
        result.dailyData[d] = {
            hits: Math.max(c.hits || 0, l.hits || 0),
            score: Math.max(c.score || 0, l.score || 0),
        };
    }
    return result;
}

function addDeltaToRecord(record, delta) {
    const result = normalizeLegacyData(record || emptyRecord());
    result.totalHits += delta.totalHits;
    result.totalScore += delta.totalScore;
    for (const [date, value] of Object.entries(delta.dailyData || {})) {
        const existing = result.dailyData[date] || { hits: 0, score: 0 };
        existing.hits = (existing.hits || 0) + (value.hits || 0);
        existing.score = (existing.score || 0) + (value.score || 0);
        result.dailyData[date] = existing;
    }
    result.updatedAt = nowMs();
    return result;
}

async function ensureSchema(env) {
    if (!hasD1(env)) return;
    if (!schemaReady) {
        schemaReady = env.DB.batch([
            env.DB.prepare(`
                CREATE TABLE IF NOT EXISTS sync_codes (
                    code TEXT PRIMARY KEY,
                    total_hits INTEGER NOT NULL DEFAULT 0,
                    total_score INTEGER NOT NULL DEFAULT 0,
                    created_at INTEGER NOT NULL,
                    updated_at INTEGER NOT NULL
                )
            `),
            env.DB.prepare(`
                CREATE TABLE IF NOT EXISTS daily_totals (
                    code TEXT NOT NULL,
                    date TEXT NOT NULL,
                    hits INTEGER NOT NULL DEFAULT 0,
                    score INTEGER NOT NULL DEFAULT 0,
                    updated_at INTEGER NOT NULL,
                    PRIMARY KEY (code, date)
                )
            `),
            env.DB.prepare(`
                CREATE TABLE IF NOT EXISTS sync_events (
                    event_id TEXT PRIMARY KEY,
                    code TEXT NOT NULL,
                    session_id TEXT NOT NULL,
                    total_hits INTEGER NOT NULL,
                    total_score INTEGER NOT NULL,
                    created_at INTEGER NOT NULL
                )
            `),
            env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_sync_events_code ON sync_events (code, created_at)'),
        ]);
    }
    await schemaReady;
}

async function kvGetRecord(code, env) {
    if (!env.DATA?.get) return null;
    const raw = await env.DATA.get(code);
    if (!raw) return null;
    return normalizeLegacyData(JSON.parse(raw));
}

async function kvPutRecord(code, data, env) {
    if (!env.DATA?.put) return;
    await env.DATA.put(code, JSON.stringify(normalizeLegacyData(data)));
}

async function d1GetRecord(code, env) {
    await ensureSchema(env);
    const meta = await env.DB.prepare('SELECT total_hits, total_score, updated_at FROM sync_codes WHERE code = ?')
        .bind(code)
        .first();
    if (!meta) return null;

    const rows = await env.DB.prepare('SELECT date, hits, score FROM daily_totals WHERE code = ?')
        .bind(code)
        .all();
    const dailyData = {};
    for (const row of rows.results || []) {
        dailyData[row.date] = { hits: row.hits || 0, score: row.score || 0 };
    }
    return {
        totalHits: meta.total_hits || 0,
        totalScore: meta.total_score || 0,
        dailyData,
        updatedAt: meta.updated_at || 0,
    };
}

async function d1UpsertLegacy(code, data, env) {
    await ensureSchema(env);
    const ts = nowMs();
    const normalized = normalizeLegacyData(data);
    await env.DB.prepare(`
        INSERT INTO sync_codes (code, total_hits, total_score, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(code) DO UPDATE SET
            total_hits = MAX(total_hits, excluded.total_hits),
            total_score = MAX(total_score, excluded.total_score),
            updated_at = ?
    `).bind(code, normalized.totalHits, normalized.totalScore, ts, ts, ts).run();

    const statements = [];
    for (const [date, value] of Object.entries(normalized.dailyData || {})) {
        statements.push(env.DB.prepare(`
            INSERT INTO daily_totals (code, date, hits, score, updated_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(code, date) DO UPDATE SET
                hits = MAX(hits, excluded.hits),
                score = MAX(score, excluded.score),
                updated_at = ?
        `).bind(code, date, value.hits || 0, value.score || 0, ts, ts));
    }
    if (statements.length) await env.DB.batch(statements);
    return d1GetRecord(code, env);
}

async function d1ApplyDelta(code, delta, env) {
    await ensureSchema(env);
    const ts = nowMs();
    const existing = await env.DB.prepare('SELECT code FROM sync_codes WHERE code = ?')
        .bind(code)
        .first();
    if (!existing) return null;

    const inserted = await env.DB.prepare(`
        INSERT OR IGNORE INTO sync_events (event_id, code, session_id, total_hits, total_score, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
    `).bind(delta.eventId, code, delta.sessionId, delta.totalHits, delta.totalScore, ts).run();

    if ((inserted.meta?.changes || 0) > 0) {
        const statements = [
            env.DB.prepare(`
                UPDATE sync_codes
                SET total_hits = total_hits + ?,
                    total_score = total_score + ?,
                    updated_at = ?
                WHERE code = ?
            `).bind(delta.totalHits, delta.totalScore, ts, code),
        ];
        for (const [date, value] of Object.entries(delta.dailyData || {})) {
            statements.push(env.DB.prepare(`
                INSERT INTO daily_totals (code, date, hits, score, updated_at)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(code, date) DO UPDATE SET
                    hits = hits + excluded.hits,
                    score = score + excluded.score,
                    updated_at = ?
            `).bind(code, date, value.hits || 0, value.score || 0, ts, ts));
        }
        await env.DB.batch(statements);
    }

    return d1GetRecord(code, env);
}

async function importKvIntoD1(code, env) {
    if (!hasD1(env)) return null;
    const kvRecord = await kvGetRecord(code, env);
    if (!kvRecord) return null;
    return d1UpsertLegacy(code, kvRecord, env);
}

async function handleRegister(request, env) {
    if (hasD1(env)) await ensureSchema(env);

    for (let i = 0; i < MAX_REGISTER_RETRY; i++) {
        const code = genCode();
        const kvExisting = await kvGetRecord(code, env);
        let d1Existing = null;
        if (hasD1(env)) {
            d1Existing = await env.DB.prepare('SELECT code FROM sync_codes WHERE code = ?').bind(code).first();
        }
        if (!kvExisting && !d1Existing) {
            const empty = emptyRecord();
            if (hasD1(env)) {
                await env.DB.prepare(`
                    INSERT INTO sync_codes (code, total_hits, total_score, created_at, updated_at)
                    VALUES (?, 0, 0, ?, ?)
                `).bind(code, empty.updatedAt, empty.updatedAt).run();
            } else {
                await kvPutRecord(code, empty, env);
            }
            return json({ code }, 200, request);
        }
    }
    return json({ error: 'register_failed' }, 503, request);
}

async function handleGet(code, request, env) {
    if (!isValidCode(code)) return json({ error: 'invalid_code' }, 400, request);

    let data = null;
    if (hasD1(env)) {
        data = await d1GetRecord(code, env);
        if (!data) data = await importKvIntoD1(code, env);
    } else {
        data = await kvGetRecord(code, env);
    }
    if (!data) return json({ error: 'not_found' }, 404, request);

    const url = new URL(request.url);
    const since = parseInt(url.searchParams.get('since') || '0');
    if (since && data.updatedAt && data.updatedAt <= since) {
        return new Response(null, { status: 304, headers: corsHeaders(request) });
    }
    return json(data, 200, request);
}

async function handlePost(code, request, env) {
    if (!isValidCode(code)) return json({ error: 'invalid_code' }, 400, request);
    const cl = parseInt(request.headers.get('Content-Length') || '0');
    if (cl > MAX_BODY_BYTES) return json({ error: 'too_large' }, 413, request);

    let body;
    try { body = await request.json(); }
    catch (e) { return json({ error: 'invalid_json' }, 400, request); }

    if (isDeltaPayload(body)) {
        const delta = normalizeDelta(body);
        if (!delta) return json({ error: 'invalid_delta' }, 400, request);

        if (hasD1(env)) {
            let record = await d1ApplyDelta(code, delta, env);
            if (!record && await importKvIntoD1(code, env)) {
                record = await d1ApplyDelta(code, delta, env);
            }
            if (!record) return json({ error: 'not_found' }, 404, request);
            return json(record, 200, request);
        }

        const current = await kvGetRecord(code, env);
        if (!current) return json({ error: 'not_found' }, 404, request);
        const merged = addDeltaToRecord(current, delta);
        await kvPutRecord(code, merged, env);
        return json(merged, 200, request);
    }

    const local = normalizeLegacyData(body);
    if (hasD1(env)) {
        let record = await d1GetRecord(code, env);
        if (!record) record = await importKvIntoD1(code, env);
        if (!record) return json({ error: 'not_found' }, 404, request);
        const merged = await d1UpsertLegacy(code, mergeData(record, local), env);
        return json(merged, 200, request);
    }

    const cloud = await kvGetRecord(code, env);
    if (!cloud) return json({ error: 'not_found' }, 404, request);
    const merged = mergeData(cloud, local);
    await kvPutRecord(code, merged, env);
    return json(merged, 200, request);
}

export {
    addDeltaToRecord,
    emptyRecord,
    mergeData,
    normalizeDelta,
    normalizeLegacyData,
};

export default {
    async fetch(request, env) {
        if (request.method === 'OPTIONS') {
            return new Response(null, { status: 204, headers: corsHeaders(request) });
        }
        const url = new URL(request.url);
        if (url.pathname === '/sync/register' && request.method === 'POST') {
            return handleRegister(request, env);
        }
        const m = url.pathname.match(/^\/sync\/([A-Za-z0-9]+)$/);
        if (m) {
            const code = m[1];
            if (request.method === 'GET') return handleGet(code, request, env);
            if (request.method === 'POST') return handlePost(code, request, env);
        }
        return json({ error: 'not_found' }, 404, request);
    },
};
