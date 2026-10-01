/**
 * SPC_2026 - Zero-Knowledge Temporary Storage Engine
 * 
 * Manages encrypted ciphertext files (.enc) on server disk.
 * Server has NO access to file plaintext or encryption passwords.
 * Automatic TTL expiration, dynamic storage quota, and burn-after-reading support.
 */

const fs = require('fs');
const path = require('path');

const STORAGE_DIR = path.join(__dirname, 'data', 'temp_storage');
const METADATA_FILE = path.join(STORAGE_DIR, 'metadata.json');

// 500 MB max single file size
const MAX_FILE_SIZE = 500 * 1024 * 1024;

// 15 GB max global storage ceiling across all temporary files
const MAX_GLOBAL_STORAGE = parseInt(process.env.MAX_TEMP_STORAGE_BYTES || String(15 * 1024 * 1024 * 1024), 10);

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
 * Dynamic TTL Policy based on file size:
 * - File nhỏ (< 20MB): Cho phép lưu tối đa 24 giờ
 * - File trung bình (20MB - 100MB): Cho phép lưu tối đa 6 giờ
 * - File lớn (> 100MB): Cho phép lưu tối đa 2 giờ (đủ thời gian người nhận tải, tiết kiệm ổ cứng)
 */
function getMaxAllowedTtlHours(fileSizeBytes) {
    const MB = 1024 * 1024;
    const size = Number(fileSizeBytes) || 0;
    if (size > 100 * MB) {
        return 2;
    }
    if (size > 20 * MB) {
        return 6;
    }
    return 24;
}

/**
 * Calculate total storage bytes currently used by active files
 */
function getTotalStorageUsed() {
    let total = 0;
    for (const record of storageMap.values()) {
        total += (record.cipherSize || record.fileSize || 0);
    }
    return total;
}

/**
 * Clean up untracked/orphan .enc files on disk
 */
function sweepOrphanFiles() {
    try {
        if (!fs.existsSync(STORAGE_DIR)) return;
        const files = fs.readdirSync(STORAGE_DIR);
        for (const file of files) {
            if (file.endsWith('.enc')) {
                const fileId = file.slice(0, -4);
                if (!storageMap.has(fileId)) {
                    try {
                        fs.unlinkSync(path.join(STORAGE_DIR, file));
                        console.log(`[TempStorage Sweeper] Cleaned orphan file: ${file}`);
                    } catch (e) {
                        // ignore unlink error
                    }
                }
            }
        }
    } catch (err) {
        console.warn('[TempStorage Sweeper] Error sweeping orphan files:', err.message);
    }
}

/**
 * Check if the server can accept an upload of the given size.
 * Automatically triggers cleanup of expired and orphan files first.
 */
function canAcceptUpload(incomingSizeBytes) {
    // 1. Clean expired and orphan files to reclaim disk space
    sweepExpiredFiles();
    sweepOrphanFiles();

    const incoming = Number(incomingSizeBytes) || 0;
    const currentUsed = getTotalStorageUsed();

    if (currentUsed + incoming > MAX_GLOBAL_STORAGE) {
        return {
            allowed: false,
            currentUsed,
            maxStorage: MAX_GLOBAL_STORAGE,
            reason: 'Hệ thống lưu trữ tạm đang bận, vui lòng gửi qua chế độ Gửi trực tiếp 1-1 hoặc thử lại sau',
        };
    }

    return {
        allowed: true,
        currentUsed,
        maxStorage: MAX_GLOBAL_STORAGE,
    };
}

/**
 * Get current storage stats for monitoring
 */
function getStorageStats() {
    const used = getTotalStorageUsed();
    return {
        usedBytes: used,
        maxBytes: MAX_GLOBAL_STORAGE,
        availableBytes: Math.max(0, MAX_GLOBAL_STORAGE - used),
        activeFiles: storageMap.size,
    };
}

/**
 * Store encrypted file metadata and write stream to disk
 */
function createUploadStream(fileId, meta) {
    if (storageMap.has(fileId)) {
        throw new Error('File ID already exists in temporary storage');
    }

    // 1. Global Quota check
    const quotaCheck = canAcceptUpload(meta.fileSize || 0);
    if (!quotaCheck.allowed) {
        const err = new Error(quotaCheck.reason);
        err.statusCode = 507;
        err.code = 'QUOTA_EXCEEDED';
        throw err;
    }

    // 2. Dynamic TTL calculation
    const maxTtl = getMaxAllowedTtlHours(meta.fileSize || 0);
    const requestedTtl = meta.ttlHours || maxTtl;
    const effectiveTtlHours = Math.min(Math.max(1, requestedTtl), maxTtl);

    const filePath = getCipherFilePath(fileId);
    const writeStream = fs.createWriteStream(filePath);

    const ttlMs = effectiveTtlHours * 3600 * 1000;
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
            console.log(`[TempStorage] Stored: ${fileId} (${record.fileName}, ${record.cipherSize} bytes, expires in ${effectiveTtlHours}h, burnAfterReading=${record.maxDownloads === 1})`);
        } catch (err) {
            console.error('[TempStorage] Error finishing upload:', err);
        }
    });

    writeStream.on('error', (err) => {
        console.error(`[TempStorage] Write error for ${fileId}:`, err);
        deleteStoredFile(fileId);
    });

    return { writeStream, record, effectiveTtlHours };
}

/**
 * Save directly from Buffer (for smaller files or testing)
 */
function saveEncryptedBuffer(fileId, buffer, meta) {
    if (buffer.length > MAX_FILE_SIZE) {
        throw new Error(`File size exceeds 500 MB limit (got ${buffer.length} bytes)`);
    }

    const quotaCheck = canAcceptUpload(buffer.length);
    if (!quotaCheck.allowed) {
        const err = new Error(quotaCheck.reason);
        err.statusCode = 507;
        err.code = 'QUOTA_EXCEEDED';
        throw err;
    }

    const maxTtl = getMaxAllowedTtlHours(buffer.length);
    const requestedTtl = meta.ttlHours || maxTtl;
    const effectiveTtlHours = Math.min(Math.max(1, requestedTtl), maxTtl);

    const filePath = getCipherFilePath(fileId);
    fs.writeFileSync(filePath, buffer);

    const ttlMs = effectiveTtlHours * 3600 * 1000;
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
    console.log(`[TempStorage] Stored: ${fileId} (${record.fileName}, ${record.cipherSize} bytes, expires in ${effectiveTtlHours}h)`);
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
        console.log(`[TempStorage] Burning file ${fileId} immediately after download (${record.downloadCount}/${record.maxDownloads})`);
        // Delay slightly (3s) so socket buffer finishes sending to client, then delete permanently
        setTimeout(() => {
            deleteStoredFile(fileId);
        }, 3000);
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

// Run sweeper every 1 minute
setInterval(sweepExpiredFiles, 60 * 1000).unref();

module.exports = {
    MAX_FILE_SIZE,
    MAX_GLOBAL_STORAGE,
    getMaxAllowedTtlHours,
    getTotalStorageUsed,
    canAcceptUpload,
    getStorageStats,
    createUploadStream,
    saveEncryptedBuffer,
    getFileMetadata,
    getCipherFilePath,
    recordDownloadComplete,
    deleteStoredFile,
    sweepExpiredFiles,
    sweepOrphanFiles,
};
