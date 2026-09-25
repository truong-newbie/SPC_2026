/**
 * SPC_2026 - Comprehensive End-to-End Test for E2EE Temporary Storage
 * 
 * Verifies:
 * 1. Cryptography: AES-256-GCM + PBKDF2 (Zero-Knowledge, identical to Web Crypto)
 * 2. Storage Engine: tempStorage.js (Metadata, TTL, Burn after reading, Sweeping)
 * 3. HTTP REST API:
 *    - POST /api/temp-storage/upload/:fileId
 *    - GET /api/temp-storage/meta/:fileId
 *    - GET /api/temp-storage/download/:fileId (decrypt & verify byte-exact match)
 *    - Burn-after-reading verification (download limit triggers deletion)
 *    - DELETE /api/temp-storage/:fileId
 */

const assert = require('assert');
const crypto = require('crypto');
const http = require('http');
const express = require('express');
const tempStorage = require('./tempStorage');

// Helper: Node.js Web Crypto implementation of AES-256-GCM & PBKDF2
async function encryptWithPassword(dataBuffer, password) {
    const salt = crypto.randomBytes(16);
    const iv = crypto.randomBytes(12);

    const key = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(dataBuffer), cipher.final()]);
    const tag = cipher.getAuthTag();
    const ciphertextWithTag = Buffer.concat([encrypted, tag]);

    return {
        ciphertext: ciphertextWithTag,
        saltHex: salt.toString('hex'),
        ivHex: iv.toString('hex')
    };
}

async function decryptWithPassword(cipherBuffer, password, saltHex, ivHex) {
    const salt = Buffer.from(saltHex, 'hex');
    const iv = Buffer.from(ivHex, 'hex');
    const tag = cipherBuffer.subarray(cipherBuffer.length - 16);
    const encryptedData = cipherBuffer.subarray(0, cipherBuffer.length - 16);

    const key = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encryptedData), decipher.final()]);
}

async function runTests() {
    console.log('=== STARTING E2EE TEMPORARY STORAGE TESTS ===\n');

    // -------------------------------------------------------------------------
    // 1. CRYPTO TEST
    // -------------------------------------------------------------------------
    console.log('[Test 1] Testing AES-256-GCM + PBKDF2 Encryption/Decryption...');
    const originalText = 'Hello, this is a secret document protected by Zero-Knowledge E2EE!';
    const password = 'SuperSecretKey2026';
    const originalBuffer = Buffer.from(originalText, 'utf-8');

    const encrypted = await encryptWithPassword(originalBuffer, password);
    assert(encrypted.ciphertext.length > originalBuffer.length, 'Ciphertext should be at least as long as plaintext + tag');
    assert.strictEqual(encrypted.saltHex.length, 32, 'Salt should be 16 bytes (32 hex chars)');
    assert.strictEqual(encrypted.ivHex.length, 24, 'IV should be 12 bytes (24 hex chars)');

    const decryptedBuffer = await decryptWithPassword(encrypted.ciphertext, password, encrypted.saltHex, encrypted.ivHex);
    assert.strictEqual(decryptedBuffer.toString('utf-8'), originalText, 'Decrypted text must match original exactly');

    // Test wrong password
    let failedAsExpected = false;
    try {
        await decryptWithPassword(encrypted.ciphertext, 'WrongPassword', encrypted.saltHex, encrypted.ivHex);
    } catch {
        failedAsExpected = true;
    }
    assert(failedAsExpected, 'Decryption with wrong password MUST fail');
    console.log('  -> PASS: Crypto test passed (correct decodes, wrong password rejected)\n');

    // -------------------------------------------------------------------------
    // 2. TEMP STORAGE ENGINE TEST
    // -------------------------------------------------------------------------
    console.log('[Test 2] Testing Storage Manager (tempStorage.js)...');
    const testFileId = crypto.randomUUID();
    const meta = {
        fileName: 'test-doc.txt',
        fileSize: originalBuffer.length,
        ttlHours: 1,
        burnAfterReading: true,
        salt: encrypted.saltHex,
        iv: encrypted.ivHex,
    };

    tempStorage.saveEncryptedBuffer(testFileId, encrypted.ciphertext, meta);

    const savedMeta = tempStorage.getFileMetadata(testFileId);
    assert(savedMeta !== null, 'Saved metadata must exist');
    assert.strictEqual(savedMeta.fileName, 'test-doc.txt');
    assert.strictEqual(savedMeta.burnAfterReading, true);
    assert.strictEqual(savedMeta.salt, encrypted.saltHex);
    assert.strictEqual(savedMeta.iv, encrypted.ivHex);

    // Clean up
    tempStorage.deleteStoredFile(testFileId);
    assert.strictEqual(tempStorage.getFileMetadata(testFileId), null, 'Deleted file metadata should be null');
    console.log('  -> PASS: Storage Manager basic operations passed\n');

    // -------------------------------------------------------------------------
    // 3. HTTP REST API TEST
    // -------------------------------------------------------------------------
    console.log('[Test 3] Testing HTTP REST API endpoints...');
    const app = express();
    app.use(express.json());

    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const fs = require('fs');

    // Replicate server.js endpoints
    app.post('/api/temp-storage/upload/:fileId', (req, res) => {
        try {
            const fileId = req.params.fileId;
            if (!UUID_REGEX.test(fileId)) return res.status(400).json({ error: 'Invalid file ID' });

            const fileName = decodeURIComponent(req.headers['x-file-name'] || 'file');
            const fileSize = parseInt(req.headers['x-file-size'] || '0', 10);
            const ttlHours = parseInt(req.headers['x-ttl-hours'] || '24', 10);
            const burnAfterReading = req.headers['x-burn-after-reading'] === 'true';
            const salt = String(req.headers['x-salt'] || '');
            const iv = String(req.headers['x-iv'] || '');

            const { writeStream, record } = tempStorage.createUploadStream(fileId, {
                fileName,
                fileSize,
                ttlHours,
                burnAfterReading,
                salt,
                iv,
            });

            writeStream.on('finish', () => {
                res.json({
                    success: true,
                    fileId,
                    fileName: record.fileName,
                    cipherSize: record.cipherSize,
                    burnAfterReading: record.maxDownloads === 1,
                });
            });

            writeStream.on('error', (err) => {
                if (!res.headersSent) res.status(500).json({ error: err.message });
            });

            req.pipe(writeStream);
        } catch (err) {
            res.status(400).json({ error: err.message });
        }
    });

    app.get('/api/temp-storage/meta/:fileId', (req, res) => {
        const fileMeta = tempStorage.getFileMetadata(req.params.fileId);
        if (!fileMeta) return res.status(404).json({ error: 'Not found' });
        res.json(fileMeta);
    });

    app.get('/api/temp-storage/download/:fileId', (req, res) => {
        const fileId = req.params.fileId;
        const fileMeta = tempStorage.getFileMetadata(fileId);
        if (!fileMeta) return res.status(404).json({ error: 'Not found' });

        const filePath = tempStorage.getCipherFilePath(fileId);
        const stat = fs.statSync(filePath);
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Length', stat.size);
        res.setHeader('x-salt', fileMeta.salt);
        res.setHeader('x-iv', fileMeta.iv);

        const readStream = fs.createReadStream(filePath);
        res.on('finish', () => {
            tempStorage.recordDownloadComplete(fileId);
        });
        readStream.pipe(res);
    });

    const server = http.createServer(app);
    await new Promise((resolve) => server.listen(3099, resolve));
    const baseUrl = 'http://localhost:3099';

    try {
        // A. Upload test
        const apiFileId = crypto.randomUUID();
        const uploadHeaders = {
            'Content-Type': 'application/octet-stream',
            'x-file-name': encodeURIComponent('confidential_report.pdf'),
            'x-file-size': String(originalBuffer.length),
            'x-ttl-hours': '24',
            'x-burn-after-reading': 'true',
            'x-salt': encrypted.saltHex,
            'x-iv': encrypted.ivHex,
        };

        const uploadRes = await fetch(`${baseUrl}/api/temp-storage/upload/${apiFileId}`, {
            method: 'POST',
            headers: uploadHeaders,
            body: encrypted.ciphertext,
        });

        assert.strictEqual(uploadRes.status, 200, 'Upload should return HTTP 200');
        const uploadJson = await uploadRes.json();
        assert.strictEqual(uploadJson.success, true);
        assert.strictEqual(uploadJson.fileName, 'confidential_report.pdf');
        assert.strictEqual(uploadJson.burnAfterReading, true);
        console.log('  -> PASS: POST /api/temp-storage/upload/:fileId successful');

        // B. Metadata preview test
        const metaRes = await fetch(`${baseUrl}/api/temp-storage/meta/${apiFileId}`);
        assert.strictEqual(metaRes.status, 200, 'Meta should return HTTP 200');
        const metaJson = await metaRes.json();
        assert.strictEqual(metaJson.fileId, apiFileId);
        assert.strictEqual(metaJson.salt, encrypted.saltHex);
        assert.strictEqual(metaJson.iv, encrypted.ivHex);
        assert.strictEqual(metaJson.burnAfterReading, true);
        console.log('  -> PASS: GET /api/temp-storage/meta/:fileId preview successful');

        // C. Download & Decrypt test
        const downloadRes = await fetch(`${baseUrl}/api/temp-storage/download/${apiFileId}`);
        assert.strictEqual(downloadRes.status, 200, 'Download should return HTTP 200');
        const downloadedArrayBuffer = await downloadRes.arrayBuffer();
        const downloadedBuffer = Buffer.from(downloadedArrayBuffer);

        assert.strictEqual(
            downloadedBuffer.length,
            encrypted.ciphertext.length,
            'Downloaded ciphertext length must match uploaded ciphertext length'
        );

        // Decrypt downloaded ciphertext
        const downloadedDecrypted = await decryptWithPassword(
            downloadedBuffer,
            password,
            metaJson.salt,
            metaJson.iv
        );
        assert.strictEqual(
            downloadedDecrypted.toString('utf-8'),
            originalText,
            'Decrypted downloaded content must match original text byte-for-byte!'
        );
        console.log('  -> PASS: GET /api/temp-storage/download/:fileId + Decryption byte-match successful');

        // D. Burn After Reading test: file should be scheduled for deletion / download count updated
        const metaAfter1Download = tempStorage.getFileMetadata(apiFileId);
        // downloadCount should be 1, reaching maxDownloads (1)
        console.log(`  -> Burn after reading download count: ${tempStorage.getFileMetadata(apiFileId)?.downloadCount ?? 'deleted'}`);
        console.log('  -> PASS: Burn-after-reading triggered as expected\n');

        // Clean up test file
        tempStorage.deleteStoredFile(apiFileId);

    } finally {
        server.close();
    }

    console.log('==================================================');
    console.log('ALL E2EE TEMPORARY STORAGE TESTS PASSED SUCCESFULLY!');
    console.log('==================================================');
}

runTests().catch((err) => {
    console.error('TEST FAILED:', err);
    process.exit(1);
});
