// 正念木鱼 同步 Worker
// 路由：
//   POST /sync/register             生成 6 位短码并预留空 record，返回 { code }
//   GET  /sync/:code                返回云端数据（不存在返回 404）
//   POST /sync/:code                合并推送数据（max 合并，敲击只增不减）

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 去掉易混 0/O/1/I
const CODE_LENGTH = 6;
const MAX_REGISTER_RETRY = 8;
const MAX_BODY_BYTES = 50 * 1024;

const ALLOWED_ORIGINS = [
    'https://woodenfish.bibidu.com',
    'http://localhost:8765',
    'http://127.0.0.1:8765',
];

function genCode() {
    const buf = new Uint8Array(CODE_LENGTH);
    crypto.getRandomValues(buf);
    let s = '';
    for (let i = 0; i < CODE_LENGTH; i++) {
        s += ALPHABET[buf[i] % ALPHABET.length];
    }
    return s;
}

function isValidCode(code) {
    if (typeof code !== 'string' || code.length !== CODE_LENGTH) return false;
    for (const c of code) if (!ALPHABET.includes(c)) return false;
    return true;
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

// 数据合并：max 合并（敲击只增不减）
function mergeData(cloud, local) {
    const result = {
        totalHits: Math.max(cloud?.totalHits || 0, local?.totalHits || 0),
        totalScore: Math.max(cloud?.totalScore || 0, local?.totalScore || 0),
        dailyData: {},
        updatedAt: Date.now(),
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

async function handleRegister(request, env) {
    for (let i = 0; i < MAX_REGISTER_RETRY; i++) {
        const code = genCode();
        const existing = await env.DATA.get(code);
        if (existing === null) {
            const empty = { totalHits: 0, totalScore: 0, dailyData: {}, updatedAt: Date.now() };
            await env.DATA.put(code, JSON.stringify(empty));
            return json({ code }, 200, request);
        }
    }
    return json({ error: 'register_failed' }, 503, request);
}

async function handleGet(code, request, env) {
    if (!isValidCode(code)) return json({ error: 'invalid_code' }, 400, request);
    const raw = await env.DATA.get(code);
    if (!raw) return json({ error: 'not_found' }, 404, request);
    // ?since=<updatedAt>：客户端 polling 时若 updatedAt 未变直接 304，省带宽（KV 仍 1 read）
    const url = new URL(request.url);
    const since = parseInt(url.searchParams.get('since') || '0');
    const data = JSON.parse(raw);
    if (since && data.updatedAt && data.updatedAt <= since) {
        return new Response(null, { status: 304, headers: corsHeaders(request) });
    }
    return json(data, 200, request);
}

async function handlePut(code, request, env) {
    if (!isValidCode(code)) return json({ error: 'invalid_code' }, 400, request);
    const cl = parseInt(request.headers.get('Content-Length') || '0');
    if (cl > MAX_BODY_BYTES) return json({ error: 'too_large' }, 413, request);

    let local;
    try { local = await request.json(); }
    catch (e) { return json({ error: 'invalid_json' }, 400, request); }

    const cloudRaw = await env.DATA.get(code);
    if (!cloudRaw) return json({ error: 'not_found' }, 404, request);

    const merged = mergeData(JSON.parse(cloudRaw), local);
    await env.DATA.put(code, JSON.stringify(merged));
    return json(merged, 200, request);
}

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
            if (request.method === 'POST') return handlePut(code, request, env);
        }
        return json({ error: 'not_found' }, 404, request);
    },
};
