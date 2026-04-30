import test from 'node:test';
import assert from 'node:assert/strict';

import worker, {
    addDeltaToRecord,
    checkRateLimit,
    isValidDateKey,
    normalizeDelta,
    normalizeLegacyData,
} from '../src/index.js';

function request(path, options = {}) {
    const headers = new Headers(options.headers || {});
    if (!headers.has('CF-Connecting-IP')) headers.set('CF-Connecting-IP', '203.0.113.10');
    return new Request('https://example.test' + path, { ...options, headers });
}

function memoryKv() {
    const store = new Map();
    return {
        async get(key) {
            return store.has(key) ? store.get(key) : null;
        },
        async put(key, value) {
            store.set(key, value);
        },
    };
}

test('validates local date keys', () => {
    assert.equal(isValidDateKey('2026-04-30'), true);
    assert.equal(isValidDateKey('2026-02-30'), false);
    assert.equal(isValidDateKey('20260430'), false);
    assert.equal(isValidDateKey('2126-04-30'), false);
});

test('normalizes v2 delta payloads and rejects malformed input', () => {
    const ok = normalizeDelta({
        version: 2,
        type: 'delta',
        sessionId: 's_test_1234',
        eventId: 'e_test_1234',
        delta: {
            totalHits: 3,
            totalScore: 1,
            dailyData: {
                '2026-04-30': { hits: 3, score: 1 },
            },
        },
    });
    assert.deepEqual(ok.dailyData['2026-04-30'], { hits: 3, score: 1 });

    assert.equal(normalizeDelta({}), null);
    assert.equal(normalizeDelta({
        version: 2,
        type: 'delta',
        sessionId: 'short',
        eventId: 'e_test_1234',
        delta: { totalHits: 1 },
    }), null);
    assert.equal(normalizeDelta({
        version: 2,
        type: 'delta',
        sessionId: 's_test_1234',
        eventId: 'e_test_1234',
        delta: {
            totalHits: 5,
            dailyData: { '2026-04-30': { hits: 3, score: 0 } },
        },
    }), null);
    assert.equal(normalizeDelta({
        version: 2,
        type: 'delta',
        sessionId: 's_test_1234',
        eventId: 'e_test_1234',
        delta: {
            totalHits: 1,
            dailyData: { '2026-02-30': { hits: 1, score: 0 } },
        },
    }), null);
});

test('normalizes legacy snapshots with bounded daily data', () => {
    const legacy = normalizeLegacyData({
        totalHits: 12,
        totalScore: 4,
        dailyData: {
            '2026-04-30': { hits: 12, score: 4 },
            nope: { hits: 99, score: 99 },
        },
    });
    assert.equal(legacy.totalHits, 12);
    assert.deepEqual(legacy.dailyData, { '2026-04-30': { hits: 12, score: 4 } });

    const tooManyDays = {};
    for (let i = 0; i < 801; i++) {
        tooManyDays['2026-01-' + String((i % 28) + 1).padStart(2, '0') + '-' + i] = { hits: 1 };
    }
    assert.equal(normalizeLegacyData({ dailyData: tooManyDays }), null);
});

test('adds deltas to records', () => {
    const merged = addDeltaToRecord(
        { totalHits: 10, totalScore: 2, dailyData: { '2026-04-30': { hits: 10, score: 2 } } },
        { totalHits: 3, totalScore: 1, dailyData: { '2026-04-30': { hits: 3, score: 1 } } },
    );
    assert.equal(merged.totalHits, 13);
    assert.equal(merged.totalScore, 3);
    assert.deepEqual(merged.dailyData['2026-04-30'], { hits: 13, score: 3 });
});

test('rate limits repeated writes from one client', () => {
    let retryAfter = null;
    for (let i = 0; i < 121; i++) {
        retryAfter = checkRateLimit(request('/sync/ABCDEF', {
            method: 'POST',
            headers: { 'CF-Connecting-IP': '203.0.113.121' },
        }), 'write');
    }
    assert.equal(typeof retryAfter, 'number');
    assert.ok(retryAfter > 0);
});

test('worker keeps legacy KV route compatible', async () => {
    const env = { DATA: memoryKv() };
    const register = await worker.fetch(request('/sync/register', { method: 'POST' }), env);
    assert.equal(register.status, 200);
    const { code } = await register.json();

    const post = await worker.fetch(request('/sync/' + code, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.55' },
        body: JSON.stringify({
            totalHits: 7,
            totalScore: 2,
            dailyData: { '2026-04-30': { hits: 7, score: 2 } },
        }),
    }), env);
    assert.equal(post.status, 200);

    const get = await worker.fetch(request('/sync/' + code, {
        headers: { 'CF-Connecting-IP': '203.0.113.56' },
    }), env);
    assert.equal(get.status, 200);
    const data = await get.json();
    assert.equal(data.totalHits, 7);
    assert.deepEqual(data.dailyData['2026-04-30'], { hits: 7, score: 2 });
});
