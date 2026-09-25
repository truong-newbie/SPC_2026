/**
 * SPC_2026 - Zero-Knowledge Temporary Storage Engine
 * 
 * Manages encrypted ciphertext files (.enc) on server disk.
 * Server has NO access to file plaintext or encryption passwords.
 * Automatic TTL expiration and burn-after-reading support.
 */

const fs = require('fs');
const path = require('path');

const STORAGE_DIR = path.join(__dirname, 'data', 'temp_storage');
const METADATA_FILE = path.join(STORAGE_DIR, 'metadata.json');

// 500 MB max file size
const MAX_FILE_SIZE = 500 * 1024 * 1024;

// Ensure storage directory exists
if (!fs.existsSync(STORAGE_DIR)) {
    fs.mkdirSync(STORAGE_DIR, { recursive: true });
}

// In-memory metadata map: fileId -> FileMetadata
const storageMap = new Map();

function loadMetadata() {
    try {
        if (fs.existsSync(METADATA_FILE)) {
            const raw = fs.readFileSync(METADATA_FILE, 'utf-8');
            const list = JSON.parse(raw);
            if (Array.isArray(list)) {
                for (const item of list) {
                    if (item && item.fileId) {
                        storageMap.set(item.fileId, item);
                    }
                }
            }
        }
    } catch (err) {
        console.warn('[TempStorage] Could not load metadata.json:', err.message);
    }
}

function persistMetadata() {
    try {
        const list = Array.from(storageMap.values());
        fs.writeFileSync(METADATA_FILE, JSON.stringify(list, null, 2), 'utf-8');
    } catch (err) {
        console.error('[TempStorage] Error persisting metadata:', err.message);
    }
}

// Load on startup
loadMetadata();

/**
 * Get file path on disk
 */
function getCipherFilePath(fileId) {
    return path.join(STORAGE_DIR, `${fileId}.enc`);
}

/**
 * Store encrypted file metadata and write stream to disk
 */
function createUploadStream(fileId, meta) {
    if (storageMap.has(fileId)) {
        throw new Error('File ID already exists in temporary storage');
    }

    const filePath = getCipherFilePath(fileId);
    const writeStream = fs.createWriteStream(filePath);

    const ttlMs = (meta.ttlHours || 24) * 3600 * 1000;
    const now = Date.now();

    const record = {
        fileId,
        fileName: meta.fileName || 'encrypted-file',
        fileSize: meta.fileSize || 0,
        cipherSize: 0,
        salt: meta.salt || '',
        iv: meta.iv || '',
        uploadedAt: now,
        expiresAt: now + ttlMs,
        maxDownloads: meta.burnAfterReading ? 1 : (meta.maxDownloads || Infinity),
        downloadCount: 0,
    };

    writeStream.on('finish', () => {
        try {
            const stat = fs.statSync(filePath);
            record.cipherSize = stat.size;
            storageMap.set(fileId, record);
            persistMetadata();
            console.log(`[TempStorage] Stored: ${fileId} (${record.fileName}, ${record.cipherSize} bytes, expires in ${meta.ttlHours || 24}h)`);
        } catch (err) {
            console.error('[TempStorage] Error finishing upload:', err);
        }
    });

    writeStream.on('error', (err) => {
        console.error(`[TempStorage] Write error for ${fileId}:`, err);
        deleteStoredFile(fileId);
    });

    return { writeStream, record };
}

/**
 * Save directly from Buffer (for smaller files or testing)
 */
function saveEncryptedBuffer(fileId, buffer, meta) {
    if (buffer.length > MAX_FILE_SIZE) {
        throw new Error(`File size exceeds 500 MB limit (got ${buffer.length} bytes)`);
    }

    const filePath = getCipherFilePath(fileId);
    fs.writeFileSync(filePath, buffer);

    const ttlMs = (meta.ttlHours || 24) * 3600 * 1000;
    const now = Date.now();

    const record = {
        fileId,
        fileName: meta.fileName || 'encrypted-file',
        fileSize: meta.fileSize || buffer.length,
        cipherSize: buffer.length,
        salt: meta.salt || '',
        iv: meta.iv || '',
        uploadedAt: now,
        expiresAt: now + ttlMs,
        maxDownloads: meta.burnAfterReading ? 1 : (meta.maxDownloads || Infinity),
        downloadCount: 0,
    };

    storageMap.set(fileId, record);
    persistMetadata();
    console.log(`[TempStorage] Stored: ${fileId} (${record.fileName}, ${record.cipherSize} bytes, expires in ${meta.ttlHours || 24}h)`);
    return record;
}

/**
 * Get public metadata for a stored file (for receiver preview)
 */
function getFileMetadata(fileId) {
    const record = storageMap.get(fileId);
    if (!record) return null;

    // Check expiration
    if (Date.now() > record.expiresAt) {
        deleteStoredFile(fileId);
        return null;
    }

    // Check burn after reading
    if (record.downloadCount >= record.maxDownloads) {
        deleteStoredFile(fileId);
        return null;
    }

    const filePath = getCipherFilePath(fileId);
    if (!fs.existsSync(filePath)) {
        storageMap.delete(fileId);
        persistMetadata();
        return null;
    }

    return {
        fileId: record.fileId,
        fileName: record.fileName,
        fileSize: record.fileSize,
        cipherSize: record.cipherSize,
        salt: record.salt,
        iv: record.iv,
        uploadedAt: record.uploadedAt,
        expiresAt: record.expiresAt,
        maxDownloads: record.maxDownloads,
        downloadCount: record.downloadCount,
        burnAfterReading: record.maxDownloads === 1,
    };
}

/**
 * Record a completed download (handles burn after reading)
 */
function recordDownloadComplete(fileId) {
    const record = storageMap.get(fileId);
    if (!record) return;

    record.downloadCount += 1;

    if (record.downloadCount >= record.maxDownloads) {
        console.log(`[TempStorage] Burning file ${fileId} after reaching download limit (${record.maxDownloads})`);
        // Delay deletion slightly so stream can finish flushing to client
        setTimeout(() => {
            deleteStoredFile(fileId);
        }, 5000);
    } else {
        persistMetadata();
    }
}

/**
 * Delete a file completely from disk and memory
 */
function deleteStoredFile(fileId) {
    const filePath = getCipherFilePath(fileId);
    try {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    } catch (err) {
        console.warn(`[TempStorage] Could not unlink ${filePath}:`, err.message);
    }
    storageMap.delete(fileId);
    persistMetadata();
    console.log(`[TempStorage] Deleted: ${fileId}`);
    return true;
}

/**
 * Sweeper: clean up expired files
 */
function sweepExpiredFiles() {
    const now = Date.now();
    let cleaned = 0;

    for (const [fileId, record] of storageMap) {
        if (now > record.expiresAt || record.downloadCount >= record.maxDownloads) {
            deleteStoredFile(fileId);
            cleaned++;
        }
    }

    if (cleaned > 0) {
        console.log(`[TempStorage Sweeper] Cleaned up ${cleaned} expired file(s)`);
    }
}

// Run sweeper every 2 minutes
setInterval(sweepExpiredFiles, 2 * 60 * 1000).unref();

module.exports = {
    MAX_FILE_SIZE,
    createUploadStream,
    saveEncryptedBuffer,
    getFileMetadata,
    getCipherFilePath,
    recordDownloadComplete,
    deleteStoredFile,
    sweepExpiredFiles,
};
