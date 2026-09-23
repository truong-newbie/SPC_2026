/**
 * SPC_2026 - P2P File Transfer Signaling Server
 *
 * Handles WebRTC signaling between peers using Socket.IO.
 * File data is transferred directly peer-to-peer via WebRTC Data Channels.
 */

require('dotenv').config({ quiet: true });

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { WebSocketServer, WebSocket } = require('ws');
const cors = require('cors');
const helmet = require('helmet');
const crypto = require('crypto');

// ---------------------------------------------------------------------------
// App Setup
// ---------------------------------------------------------------------------

const app = express();
app.use(helmet());

// Trust proxy for correct IP detection behind reverse proxies
const TRUSTED_PROXY_COUNT = parseInt(process.env.TRUSTED_PROXY_COUNT || '1', 10);
app.set('trust proxy', TRUSTED_PROXY_COUNT);

function getClientIp(xffHeader, socketAddr) {
    if (!xffHeader) return socketAddr || 'unknown';
    const hops = String(xffHeader).split(',').map(s => s.trim()).filter(Boolean);
    if (hops.length === 0) return socketAddr || 'unknown';
    const idx = Math.max(0, hops.length - TRUSTED_PROXY_COUNT);
    return hops[idx] || socketAddr || 'unknown';
}

// UUID validation regex for room IDs
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const allowedOrigins = [
    process.env.CLIENT_URL,
    'http://localhost:3000',
    'http://localhost:3002',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3002',
].filter(Boolean);

app.use(cors({
    origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) return callback(null, true);
        return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
}));

app.use(express.json());

app.get('/', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));
app.get('/health', (_req, res) => res.json({ status: 'healthy', uptime: process.uptime() }));

// ---------------------------------------------------------------------------
// Rate Limiting Utilities
// ---------------------------------------------------------------------------

// Mask IP for rate limit keys (handle IPv6, IPv4-mapped IPv6)
function rateKey(ip) {
    if (!ip) return 'unknown';
    if (ip.includes(':')) {
        return ip.replace(/^([\da-f:]+::[\da-f]{2})[\da-f]*$/i, '$1');
    }
    if (ip.startsWith('::ffff:')) {
        return ip.slice(7);
    }
    return ip;
}

// Per-IP sliding window rate limiter
function makeRateLimiter(map, windowMs, max) {
    return (req, res, next) => {
        const now = Date.now();
        const key = rateKey(req.ip);
        const timestamps = (map.get(key) || []).filter(t => now - t < windowMs);
        if (timestamps.length >= max) {
            return res.status(429).json({ error: 'Too many requests' });
        }
        timestamps.push(now);
        map.set(key, timestamps);
        next();
    };
}

// ---------------------------------------------------------------------------
// Connection Rate Limiting
// ---------------------------------------------------------------------------

const connectionCounts = new Map();
const RATE_LIMIT_WINDOW = 60000;
const MAX_CONNECTIONS_PER_IP = parseInt(process.env.MAX_CONNECTIONS_PER_IP || '30', 10);

function checkRateLimit(ip) {
    const key = rateKey(ip);
    const now = Date.now();
    const timestamps = (connectionCounts.get(key) || []).filter(t => now - t < RATE_LIMIT_WINDOW);
    if (timestamps.length >= MAX_CONNECTIONS_PER_IP) {
        connectionCounts.set(key, timestamps);
        return false;
    }
    timestamps.push(now);
    connectionCounts.set(key, timestamps);
    return true;
}

// ---------------------------------------------------------------------------
// TURN Credentials Generation
// ---------------------------------------------------------------------------

const STUN_FALLBACK = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
];

const turnRateLimits = new Map();
const TURN_RATE_WINDOW = 60000;
const MAX_TURN_REQUESTS = parseInt(process.env.MAX_TURN_REQUESTS_PER_IP || '20', 10);

function generateCoturnCredentials() {
    const turnSecret = process.env.TURN_SECRET;
    const turnDomain = process.env.TURN_DOMAIN;
    if (!turnSecret || !turnDomain) return null;

    const ttl = 24 * 3600;
    const expiry = Math.floor(Date.now() / 1000) + ttl;
    const username = `${expiry}:spcuser`;
    const password = crypto.createHmac('sha1', turnSecret).update(username).digest('base64');

    return [
        { urls: `stun:${turnDomain}:3478` },
        { urls: `turn:${turnDomain}:3478`, username, credential: password },
        { urls: `turns:${turnDomain}:5349`, username, credential: password },
    ];
}

// Cloudflare TURN support
const CLOUDFLARE_TURN_KEY_ID = process.env.CLOUDFLARE_TURN_KEY_ID;
const CLOUDFLARE_TURN_KEY_API_TOKEN = process.env.CLOUDFLARE_TURN_KEY_API_TOKEN;
const CF_CACHE_MS = 5 * 60 * 1000;

let cfIceCache = { servers: null, expires: 0, mintedAt: 0 };
let cfInflight = null;
let cfNextMintAt = 0;

async function generateCloudflareIceServers() {
    if (!CLOUDFLARE_TURN_KEY_ID || !CLOUDFLARE_TURN_KEY_API_TOKEN) return null;
    const now = Date.now();
    if (cfIceCache.servers && now < cfIceCache.expires) return cfIceCache.servers;
    if (cfInflight) return cfIceCache.servers;
    if (now < cfNextMintAt) return cfIceCache.servers;

    cfInflight = startCloudflareMint();
    return cfIceCache.servers || cfInflight;
}

async function startCloudflareMint() {
    cfNextMintAt = Date.now() + CF_CACHE_MS;
    try {
        const resp = await fetch(
            `https://rtc.live.cloudflare.com/v1/turn/keys/${CLOUDFLARE_TURN_KEY_ID}/credentials/generate-ice-servers`,
            {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${CLOUDFLARE_TURN_KEY_API_TOKEN}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ ttl: 86400 }),
                signal: AbortSignal.timeout(10000),
            }
        );
        if (!resp.ok) return null;
        const { iceServers } = await resp.json();
        if (!iceServers) return null;

        const raw = Array.isArray(iceServers) ? iceServers : [iceServers];
        const stunUrls = [];
        const turnUrls = [];
        let username, credential;

        for (const s of raw) {
            const urls = Array.isArray(s.urls) ? s.urls : [s.urls];
            for (const u of urls) {
                (u.startsWith('stun:') ? stunUrls : turnUrls).push(u);
            }
            if (s.username) { username = s.username; credential = s.credential; }
        }

        const servers = [];
        if (stunUrls.length) servers.push({ urls: [stunUrls[0]] });
        if (turnUrls.length) servers.push({ urls: turnUrls, username, credential });

        const mintedAt = Date.now();
        cfIceCache = { servers, expires: mintedAt + CF_CACHE_MS, mintedAt };
        return servers;
    } catch (err) {
        console.error('Cloudflare TURN mint failed:', err.message);
        return null;
    } finally {
        cfInflight = null;
    }
}

// GET /api/turn-credentials
app.get('/api/turn-credentials', (req, res) => {
    const ip = rateKey(req.ip);
    const now = Date.now();

    if (!turnRateLimits.has(ip)) turnRateLimits.set(ip, []);
    const timestamps = turnRateLimits.get(ip).filter(t => now - t < TURN_RATE_WINDOW);
    if (timestamps.length >= MAX_TURN_REQUESTS) {
        return res.status(429).json({ error: 'Too many requests' });
    }
    timestamps.push(now);
    turnRateLimits.set(ip, timestamps);

    const credentials = generateCloudflareIceServers() || generateCoturnCredentials();
    res.json(credentials || STUN_FALLBACK);
});

// ---------------------------------------------------------------------------
// Global Stats Counter
// ---------------------------------------------------------------------------

const statsRateLimits = new Map();
const STATS_RATE_WINDOW = 60000;
const STATS_MAX_REQUESTS = 60;
const MAX_REPORT_BYTES = parseInt(process.env.MAX_REPORT_BYTES || '576460752303423487', 10);

let cachedTotal = 0;

// Optional Upstash Redis integration
const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const STATS_KEY = 'spc:bytes_total';

async function upstashPost(command) {
    if (!UPSTASH_URL || !UPSTASH_TOKEN) return null;
    try {
        const resp = await fetch(UPSTASH_URL, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${UPSTASH_TOKEN}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(command),
        });
        if (!resp.ok) return null;
        const { result } = await resp.json();
        return result;
    } catch {
        return null;
    }
}

async function initStats() {
    try {
        const val = await upstashPost(['GET', STATS_KEY]);
        if (val !== null) cachedTotal = Number(val) || 0;
    } catch {}
}

// GET /api/stats
app.get('/api/stats', (_req, res) => {
    res.json({ totalBytes: cachedTotal });
});

// POST /api/stats/report
app.post('/api/stats/report', (req, res) => {
    const ip = rateKey(req.ip);
    const now = Date.now();

    if (!statsRateLimits.has(ip)) statsRateLimits.set(ip, []);
    const timestamps = statsRateLimits.get(ip).filter(t => now - t < STATS_RATE_WINDOW);
    if (timestamps.length >= STATS_MAX_REQUESTS) {
        return res.status(429).json({ error: 'Too many reports' });
    }
    timestamps.push(now);
    statsRateLimits.set(ip, timestamps);

    const { bytes } = req.body || {};
    if (!Number.isInteger(bytes) || bytes <= 0 || bytes > MAX_REPORT_BYTES) {
        return res.status(400).json({ error: 'Invalid byte count' });
    }

    cachedTotal += bytes;
    upstashPost(['INCRBY', STATS_KEY, bytes]).catch(() => {});

    res.json({ totalBytes: cachedTotal });
});

// ---------------------------------------------------------------------------
// Code Phrase API (for CLI)
// ---------------------------------------------------------------------------

const codeRateLimits = new Map();
const CODE_RATE_WINDOW = 60000;
const CODE_MAX_REQUESTS = parseInt(process.env.MAX_CODE_REQUESTS_PER_IP || '60', 10);
const codeRateLimiter = makeRateLimiter(codeRateLimits, CODE_RATE_WINDOW, CODE_MAX_REQUESTS);
const MAX_ACTIVE_CODES = parseInt(process.env.MAX_ACTIVE_CODES || '10000', 10);

// Simple word list for codes
const words = require('./words.json');
const codeToRoom = new Map();

function generateCode() {
    for (let i = 0; i < 10; i++) {
        const code = `${pickWord()}-${pickWord()}-${pickWord()}`;
        const existing = codeToRoom.get(code);
        if (!existing || Date.now() > existing.expires) return code;
    }
    return `${pickWord()}-${pickWord()}-${pickWord()}-${pickWord()}`;
}

function pickWord() {
    return words[crypto.randomInt(words.length)];
}

// POST /api/code - Register a code for a room
app.post('/api/code', codeRateLimiter, (req, res) => {
    const { roomId } = req.body || {};
    if (!roomId || !UUID_REGEX.test(roomId)) {
        return res.status(400).json({ error: 'Invalid room ID' });
    }
    if (codeToRoom.size >= MAX_ACTIVE_CODES) {
        return res.status(503).json({ error: 'Server busy' });
    }
    const code = generateCode();
    codeToRoom.set(code, { roomId, expires: Date.now() + 600000 });
    res.json({ code });
});

// GET /api/code/:code - Resolve code to room
app.get('/api/code/:code', codeRateLimiter, (req, res) => {
    const entry = codeToRoom.get(req.params.code);
    if (!entry || Date.now() > entry.expires) {
        codeToRoom.delete(req.params.code);
        return res.status(404).json({ error: 'Code not found or expired' });
    }
    res.json({ roomId: entry.roomId });
});

// ---------------------------------------------------------------------------
// Error Handler
// ---------------------------------------------------------------------------

function errorHandler(err, _req, res, _next) {
    const raw = err && err.status;
    const status = Number.isInteger(raw) && raw >= 400 && raw < 600 ? raw : 500;
    console.error(err && err.stack ? err.stack : err);
    if (res.headersSent) return;
    res.status(status).json({ error: status < 500 ? 'Bad request' : 'Internal server error' });
}

app.use(errorHandler);

// ---------------------------------------------------------------------------
// Cleanup Interval
// ---------------------------------------------------------------------------

const cleanupInterval = setInterval(() => {
    const now = Date.now();

    // Clean connection counts
    for (const [ip, timestamps] of connectionCounts.entries()) {
        const valid = timestamps.filter(t => now - t < RATE_LIMIT_WINDOW);
        if (valid.length === 0) connectionCounts.delete(ip);
        else connectionCounts.set(ip, valid);
    }

    // Clean TURN limits
    for (const [ip, timestamps] of turnRateLimits.entries()) {
        const valid = timestamps.filter(t => now - t < TURN_RATE_WINDOW);
        if (valid.length === 0) turnRateLimits.delete(ip);
        else turnRateLimits.set(ip, valid);
    }

    // Clean stats limits
    for (const [ip, timestamps] of statsRateLimits.entries()) {
        const valid = timestamps.filter(t => now - t < STATS_RATE_WINDOW);
        if (valid.length === 0) statsRateLimits.delete(ip);
        else statsRateLimits.set(ip, valid);
    }

    // Clean code limits
    for (const [ip, timestamps] of codeRateLimits.entries()) {
        const valid = timestamps.filter(t => now - t < CODE_RATE_WINDOW);
        if (valid.length === 0) codeRateLimits.delete(ip);
        else codeRateLimits.set(ip, valid);
    }

    // Clean expired codes
    for (const [code, entry] of codeToRoom.entries()) {
        if (now > entry.expires) codeToRoom.delete(code);
    }
}, 60000).unref();

// ---------------------------------------------------------------------------
// Room Registry
// ---------------------------------------------------------------------------

const rooms = new Map(); // roomId → [peer, peer]

function createSocketIOPeer(socket) {
    return {
        id: socket.id,
        type: 'socketio',
        roomId: null,
        send(type, data) {
            if (type === 'user-connected') {
                socket.emit(type, typeof data === 'object' ? data.id : data);
            } else {
                socket.emit(type, data);
            }
        },
    };
}

const WS_SEND_BUFFER_CEILING = 1e6;

function createWSPeer(ws) {
    return {
        id: ws.peerId,
        type: 'ws',
        roomId: null,
        send(type, data) {
            if (ws.readyState !== WebSocket.OPEN) return;
            if (ws.bufferedAmount > WS_SEND_BUFFER_CEILING) {
                ws.terminate();
                return;
            }
            ws.send(JSON.stringify({ type, ...data }));
        },
    };
}

function handleJoinRoom(peer, roomId) {
    if (!roomId || typeof roomId !== 'string' || !UUID_REGEX.test(roomId)) {
        peer.send('error', { message: 'Invalid room ID' });
        return;
    }

    // Leave old room if in one
    if (peer.roomId) {
        const oldRoom = rooms.get(peer.roomId);
        if (oldRoom) {
            const remaining = oldRoom.filter(p => p.id !== peer.id);
            if (remaining.length === 0) rooms.delete(peer.roomId);
            else rooms.set(peer.roomId, remaining);
        }
        peer.roomId = null;
    }

    const room = rooms.get(roomId) || [];

    if (room.length === 0) {
        room.push(peer);
        rooms.set(roomId, room);
        peer.roomId = roomId;
        peer.send('room-joined', { role: 'sender' });
    } else if (room.length === 1) {
        room.push(peer);
        rooms.set(roomId, room);
        peer.roomId = roomId;
        peer.send('room-joined', { role: 'receiver' });
        room[0].send('user-connected', { id: peer.id });
    } else {
        peer.send('room-full', {});
    }
}

function handleSignal(senderPeer, signal, targetId) {
    if (!signal) return;
    if (!senderPeer.roomId) return;
    const room = rooms.get(senderPeer.roomId);
    if (!room) return;

    const targetPeer = room.find(p => p.id !== senderPeer.id);
    if (!targetPeer) return;
    if (targetId && targetPeer.id !== targetId) return;

    try {
        targetPeer.send('signal', { signal, sender: senderPeer.id });
    } catch {
        // Undeliverable
    }
}

function handleDisconnect(peer) {
    if (!peer.roomId) return;
    const room = rooms.get(peer.roomId);
    if (!room) return;

    const remaining = room.filter(p => p.id !== peer.id);
    remaining.forEach(p => p.send('peer-disconnected', {}));
    if (remaining.length === 0) rooms.delete(peer.roomId);
    else rooms.set(peer.roomId, remaining);
    peer.roomId = null;
}

// ---------------------------------------------------------------------------
// HTTP Server
// ---------------------------------------------------------------------------

const server = http.createServer(app);

// ---------------------------------------------------------------------------
// Socket.IO Server (Browser Clients)
// ---------------------------------------------------------------------------

const io = new Server(server, {
    cors: {
        origin: allowedOrigins,
        methods: ['GET', 'POST'],
        credentials: true,
    },
    maxHttpBufferSize: 1e6,
});

io.use((socket, next) => {
    const ip = getClientIp(socket.handshake.headers['x-forwarded-for'], socket.handshake.address);
    if (!checkRateLimit(ip)) return next(new Error('Rate limit exceeded'));
    next();
});

io.on('connection', (socket) => {
    const peer = createSocketIOPeer(socket);

    socket.on('ping', (callback) => {
        if (typeof callback === 'function') callback();
    });

    socket.on('join-room', (roomId) => {
        handleJoinRoom(peer, roomId);
    });

    socket.on('signal', (data) => {
        if (!data || typeof data !== 'object' || !data.signal) return;
        handleSignal(peer, data.signal, data.target || null);
    });

    socket.on('disconnecting', () => {
        handleDisconnect(peer);
    });
});

// ---------------------------------------------------------------------------
// WebSocket Server (CLI Clients)
// Path: /ws
// ---------------------------------------------------------------------------

const wss = new WebSocketServer({ noServer: true, maxPayload: 1e6 });

const HEARTBEAT_MS = Math.min(2147483647, Math.max(100, parseInt(process.env.HEARTBEAT_MS || '30000', 10)));

function handleUpgradeRequest(req, socket, head) {
    socket.on('error', () => {});

    let pathname;
    try {
        pathname = new URL(req.url, 'http://x').pathname;
    } catch {
        socket.destroy();
        return;
    }

    if (pathname !== '/ws') return;
    if (req.url.startsWith(io.path() + '/')) return;

    try {
        wss.handleUpgrade(req, socket, head, (ws) => {
            wss.emit('connection', ws, req);
        });
    } catch {
        socket.destroy();
    }
}

server.on('upgrade', handleUpgradeRequest);

wss.on('connection', (ws, req) => {
    ws.on('error', () => {});

    const ip = getClientIp(req.headers['x-forwarded-for'], req.socket.remoteAddress);
    if (!checkRateLimit(ip)) {
        ws.close(1008, 'Rate limit exceeded');
        return;
    }

    ws.peerId = crypto.randomUUID();
    ws.isAlive = true;
    ws.pingNonce = null;

    const peer = createWSPeer(ws);

    ws.on('pong', (data) => {
        if (ws.pingNonce && Buffer.isBuffer(data) && data.equals(ws.pingNonce)) {
            ws.isAlive = true;
            ws.pingNonce = null;
        }
    });

    ws.on('message', (raw) => {
        let msg;
        try { msg = JSON.parse(raw); } catch { return; }
        if (!msg || typeof msg !== 'object') return;

        switch (msg.type) {
            case 'join-room':
                handleJoinRoom(peer, msg.roomId);
                break;
            case 'signal':
                handleSignal(peer, msg.signal, msg.target || null);
                break;
            case 'ping':
                ws.send(JSON.stringify({ type: 'pong' }));
                break;
        }
    });

    ws.on('close', () => handleDisconnect(peer));
    ws.on('error', () => handleDisconnect(peer));
});

function heartbeatTick(clients) {
    clients.forEach((ws) => {
        if (ws.isAlive === false) { ws.terminate(); return; }
        ws.isAlive = false;
        ws.pingNonce = crypto.randomBytes(8);
        ws.ping(ws.pingNonce);
    });
}

const heartbeat = setInterval(() => heartbeatTick(wss.clients), HEARTBEAT_MS).unref();
wss.on('close', () => clearInterval(heartbeat));

// ---------------------------------------------------------------------------
// Graceful Shutdown
// ---------------------------------------------------------------------------

function shutdown() {
    clearInterval(cleanupInterval);
    clearInterval(heartbeat);
    for (const ws of wss.clients) ws.close(1001, 'Server shutting down');
    io.close();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10000).unref();
}

// ---------------------------------------------------------------------------
// Start Server
// ---------------------------------------------------------------------------

const PORT = process.env.PORT || 3001;

if (require.main === module) {
    const failFastOnBindError = (err) => {
        console.error('HTTP server error:', err);
        process.exit(1);
    };
    server.on('error', failFastOnBindError);

    process.on('uncaughtException', (err, origin) => {
        console.error(`Unhandled error (${origin}), server still serving:`, err);
    });

    server.listen(PORT, () => {
        server.off('error', failFastOnBindError);
        console.log(`SPC_2026 Server running on port ${PORT}`);
    });

    initStats().catch(() => {});
    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
}

// Export for testing
module.exports = {
    handleJoinRoom,
    handleSignal,
    handleDisconnect,
    rooms,
    codeToRoom,
};
