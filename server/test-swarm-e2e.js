const { fork } = require('child_process');
const path = require('path');
const { io } = require('socket.io-client');
const assert = require('assert');

async function isServerRunning(url) {
    try {
        const res = await fetch(`${url}/health`, { signal: AbortSignal.timeout(1000) });
        return res.ok;
    } catch {
        return false;
    }
}

(async () => {
    console.log('=== SWARM SIGNALING & TURN E2E TEST ===');

    const serverUrl = 'http://localhost:3001';
    let spawnedServer = null;

    if (!(await isServerRunning(serverUrl))) {
        console.log('Server not running on 3001, spawning background server for test...');
        spawnedServer = fork(path.join(__dirname, 'server.js'), [], {
            stdio: 'ignore',
            env: { ...process.env, PORT: '3001' },
        });

        // Wait for server /health to respond
        const start = Date.now();
        let ready = false;
        while (Date.now() - start < 6000) {
            if (await isServerRunning(serverUrl)) {
                ready = true;
                break;
            }
            await new Promise(r => setTimeout(r, 150));
        }
        if (!ready) {
            if (spawnedServer) spawnedServer.kill('SIGKILL');
            throw new Error('Timed out waiting for server to start');
        }
        console.log('Spawned test server is ready.');
    }

    const cleanup = () => {
        if (spawnedServer) {
            try {
                spawnedServer.kill('SIGKILL');
            } catch {}
        }
    };

    process.on('exit', cleanup);
    process.on('SIGINT', () => { cleanup(); process.exit(1); });

    try {
        // 1. Test HTTP /api/turn-credentials
        const turnRes = await fetch(`${serverUrl}/api/turn-credentials`);
        const turnData = await turnRes.json();
        console.log('Fetched /api/turn-credentials:', Array.isArray(turnData) ? `${turnData.length} servers` : turnData);
        assert(Array.isArray(turnData), 'turn-credentials must be an array of ice servers');
        assert(turnData.length > 0, 'turn-credentials must not be empty');
        const hasTurn = turnData.some(s => {
            const urls = Array.isArray(s.urls) ? s.urls : [s.urls];
            return urls.some(u => u.startsWith('turn:') || u.startsWith('turns:'));
        });
        console.log('Has TURN servers configured:', hasTurn);
        assert(hasTurn, 'ICE servers must include TURN servers for NAT/firewall fallback');

        // 2. Connect Host (Seeder)
        const host = io(serverUrl, { transports: ['websocket'] });
        await new Promise(r => host.on('connect', r));
        console.log('Host connected:', host.id);

        // Test socket get-turn-credentials
        const socketTurnData = await new Promise(resolve => {
            host.emit('get-turn-credentials', resolve);
        });
        assert(Array.isArray(socketTurnData), 'socket get-turn-credentials must return array');
        console.log('Socket get-turn-credentials returned:', socketTurnData.length, 'servers');

        const fileId = 'swarm-test-' + Date.now();
        const totalPieces = 3;

        const testFileName = 'test-document.pdf';
        const testFileSize = 1536 * 1024;

        // 3. Create swarm on server
        const swarmCreatedPromise = new Promise(resolve => host.once('swarm-created', resolve));
        host.emit('create-swarm', { fileId, totalPieces, fileName: testFileName, fileSize: testFileSize });
        const createdInfo = await swarmCreatedPromise;
        console.log('Swarm created:', createdInfo.fileId);
        assert.strictEqual(createdInfo.fileId, fileId);

        // 4. Host joins swarm FIRST (our fix!)
        const hostSwarmInfoPromise = new Promise(resolve => host.once('swarm-info', resolve));
        host.emit('join-swarm', { fileId });
        const hostSwarmInfo = await hostSwarmInfoPromise;
        console.log('Host joined swarm. Peer count:', hostSwarmInfo.peerCount);
        assert.strictEqual(hostSwarmInfo.peerCount, 1);

        // 5. Host announces pieces
        host.emit('announce-pieces', { fileId, pieces: [0, 1, 2] });
        await new Promise(r => setTimeout(r, 200));

        // 6. Connect Downloader (Leecher)
        const downloader = io(serverUrl, { transports: ['websocket'] });
        await new Promise(r => downloader.on('connect', r));
        console.log('Downloader connected:', downloader.id);

        // Host should receive 'peer-joined' with downloader ID
        const peerJoinedPromise = new Promise(resolve => host.once('peer-joined', resolve));
        // Downloader receives swarm-info
        const downloaderSwarmInfoPromise = new Promise(resolve => downloader.once('swarm-info', resolve));

        downloader.emit('join-swarm', { fileId });

        const [peerJoinedData, downloaderSwarmInfo] = await Promise.all([
            peerJoinedPromise,
            downloaderSwarmInfoPromise
        ]);

        console.log('Host received peer-joined:', peerJoinedData);
        assert.strictEqual(peerJoinedData.peerId, downloader.id);

        console.log('Downloader received swarm-info:');
        console.log(' - peerCount:', downloaderSwarmInfo.peerCount);
        console.log(' - seedCount:', downloaderSwarmInfo.seedCount);
        console.log(' - peers in swarm:', downloaderSwarmInfo.peers.length);

        assert.strictEqual(downloaderSwarmInfo.peerCount, 2, 'Total peers in swarm should be 2');
        assert.strictEqual(downloaderSwarmInfo.seedCount, 1, 'Should find 1 seeder (host)');
        assert.strictEqual(downloaderSwarmInfo.fileName, testFileName, 'Swarm info must include fileName');
        assert.strictEqual(downloaderSwarmInfo.fileSize, testFileSize, 'Swarm info must include fileSize');

        const hostInSwarm = downloaderSwarmInfo.peers.find(p => p.peerId === host.id);
        assert(hostInSwarm, 'Host must be in peers list');
        assert.strictEqual(hostInSwarm.pieces.length, 3, 'Host must hold all 3 pieces');
        assert.strictEqual(hostInSwarm.hasAll, true, 'Host hasAll must be true');

        // 7. Test WebRTC direct signal routing from Host to Downloader
        const downloaderSignalPromise = new Promise(resolve => downloader.once('signal', resolve));
        const testOffer = { type: 'offer', sdp: 'v=0\r\no=- 12345 2 IN IP4 127.0.0.1' };
        host.emit('signal', { target: downloader.id, signal: testOffer });

        const receivedOffer = await downloaderSignalPromise;
        console.log('Downloader received signal from host:', receivedOffer.sender === host.id);
        assert.strictEqual(receivedOffer.sender, host.id);
        assert.strictEqual(receivedOffer.signal.type, 'offer');

        // 8. Test WebRTC direct signal routing from Downloader back to Host
        const hostSignalPromise = new Promise(resolve => host.once('signal', resolve));
        const testAnswer = { type: 'answer', sdp: 'v=0\r\no=- 67890 2 IN IP4 127.0.0.1' };
        downloader.emit('signal', { target: host.id, signal: testAnswer });

        const receivedAnswer = await hostSignalPromise;
        console.log('Host received signal from downloader:', receivedAnswer.sender === downloader.id);
        assert.strictEqual(receivedAnswer.sender, downloader.id);
        assert.strictEqual(receivedAnswer.signal.type, 'answer');

        console.log('\n=== ALL SWARM SIGNALING & TURN TESTS PASSED SUCCESSFULLY! ===');

        host.disconnect();
        downloader.disconnect();
    } finally {
        cleanup();
    }
    process.exit(0);
})();
