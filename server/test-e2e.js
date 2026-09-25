const { io } = require('socket.io-client');

(async () => {
    console.log('=== P2P SIGNALING E2E TEST ===');

    const sender = io('http://localhost:3001', { transports: ['websocket'] });
    const senderEvents = [];
    sender.on('connect', () => console.log('Sender connected:', sender.id));
    sender.on('room-joined', d => senderEvents.push(['room-joined', d]));
    sender.on('user-connected', d => senderEvents.push(['user-connected', d]));
    sender.on('room-full', d => senderEvents.push(['room-full', d]));
    sender.on('peer-disconnected', d => senderEvents.push(['peer-disconnected', d]));
    sender.on('signal', d => senderEvents.push(['signal', !!d.signal]));
    await new Promise(r => sender.on('connect', r));

    const roomId = '11111111-2222-4333-8444-555555555555';
    sender.emit('join-room', roomId);
    await new Promise(r => setTimeout(r, 300));
    console.log('After sender join, sender events:', senderEvents.map(e => e[0]));

    const receiver = io('http://localhost:3001', { transports: ['websocket'] });
    const receiverEvents = [];
    receiver.on('connect', () => console.log('Receiver connected:', receiver.id));
    receiver.on('room-joined', d => receiverEvents.push(['room-joined', d]));
    receiver.on('user-connected', d => receiverEvents.push(['user-connected', d]));
    receiver.on('room-full', d => receiverEvents.push(['room-full', d]));
    receiver.on('signal', d => receiverEvents.push(['signal', !!d.signal]));
    await new Promise(r => receiver.on('connect', r));

    receiver.emit('join-room', roomId);
    await new Promise(r => setTimeout(r, 1500));

    console.log('\n--- Sender events ---');
    senderEvents.forEach(e => console.log(' ', e[0], JSON.stringify(e[1]).slice(0, 80)));
    console.log('\n--- Receiver events ---');
    receiverEvents.forEach(e => console.log(' ', e[0], JSON.stringify(e[1]).slice(0, 80)));

    if (senderEvents.some(e => e[0] === 'user-connected')) {
        console.log('\n=== OK: sender received user-connected ===');
        sender.emit('signal', { signal: { type: 'offer', sdp: 'fake-sdp' }, target: null });
        await new Promise(r => setTimeout(r, 500));
        console.log('After signal - receiver got signal:', receiverEvents.some(e => e[0] === 'signal'));
    } else {
        console.log('\n=== FAIL: no user-connected event! ===');
    }

    sender.disconnect();
    receiver.disconnect();
    process.exit(0);
})();
