// Test full E2E: signaling + WebRTC between two Node processes
// Note: WebRTC doesn't work in plain Node without wrtc, so we test signaling layer fully
const { io } = require('socket.io-client');

(async () => {
    console.log('=== FULL E2E TEST: 2 users, multi-event ===');

    const sender = io('http://localhost:3001', { transports: ['websocket'] });
    const senderEvents = [];
    sender.on('connect', () => console.log('[Sender] connected'));
    sender.on('room-joined', d => senderEvents.push({ ev: 'room-joined', d }));
    sender.on('user-connected', d => senderEvents.push({ ev: 'user-connected', d }));
    sender.on('room-full', d => senderEvents.push({ ev: 'room-full', d }));
    sender.on('peer-disconnected', d => senderEvents.push({ ev: 'peer-disconnected', d }));
    sender.on('signal', d => senderEvents.push({ ev: 'signal', d: { type: d.signal?.type, hasSignal: !!d.signal } }));
    await new Promise(r => sender.on('connect', r));

    const roomId = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
    sender.emit('join-room', roomId);
    await new Promise(r => setTimeout(r, 300));

    // Receiver joins AFTER sender
    const receiver = io('http://localhost:3001', { transports: ['websocket'] });
    const receiverEvents = [];
    receiver.on('connect', () => console.log('[Receiver] connected'));
    receiver.on('room-joined', d => receiverEvents.push({ ev: 'room-joined', d }));
    receiver.on('user-connected', d => receiverEvents.push({ ev: 'user-connected', d }));
    receiver.on('room-full', d => receiverEvents.push({ ev: 'room-full', d }));
    receiver.on('signal', d => receiverEvents.push({ ev: 'signal', d: { type: d.signal?.type, hasSignal: !!d.signal } }));
    await new Promise(r => receiver.on('connect', r));

    receiver.emit('join-room', roomId);
    await new Promise(r => setTimeout(r, 500));

    // Simulate sender creating offer
    sender.emit('signal', { signal: { type: 'offer', sdp: 'v=0...' }, target: null });
    await new Promise(r => setTimeout(r, 200));

    // Simulate receiver answering
    receiver.emit('signal', { signal: { type: 'answer', sdp: 'v=0...' }, target: null });
    await new Promise(r => setTimeout(r, 200));

    // Simulate ICE candidates
    sender.emit('signal', { signal: { type: 'candidate', candidate: 'fake' }, target: null });
    await new Promise(r => setTimeout(r, 200));

    console.log('\n=== SENDER EVENTS ===');
    senderEvents.forEach(e => console.log(' ', e.ev, JSON.stringify(e.d).slice(0, 100)));
    console.log('\n=== RECEIVER EVENTS ===');
    receiverEvents.forEach(e => console.log(' ', e.ev, JSON.stringify(e.d).slice(0, 100)));

    // Now test: 3rd user should get room-full
    const receiver3 = io('http://localhost:3001', { transports: ['websocket'] });
    const receiver3Events = [];
    receiver3.on('connect', () => console.log('\n[Receiver3] connected'));
    receiver3.on('room-joined', d => receiver3Events.push(['room-joined', d]));
    receiver3.on('room-full', d => receiver3Events.push(['room-full', d]));
    await new Promise(r => receiver3.on('connect', r));
    receiver3.emit('join-room', roomId);
    await new Promise(r => setTimeout(r, 500));
    console.log('\n=== RECEIVER3 (should be room-full) ===');
    receiver3Events.forEach(e => console.log(' ', e[0], JSON.stringify(e[1]).slice(0, 100)));

    // Test: disconnect scenario
    console.log('\n=== DISCONNECT TEST ===');
    sender.disconnect();
    await new Promise(r => setTimeout(r, 500));
    console.log('After sender disconnect, receiver events:');
    receiverEvents.forEach(e => console.log(' ', e.ev));

    receiver.disconnect();
    receiver3.disconnect();
    process.exit(0);
})();
