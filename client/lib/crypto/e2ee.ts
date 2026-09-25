/**
 * SPC_2026 - Zero-Knowledge Client-Side Encryption Module (Web Crypto API)
 * 
 * Uses native Web Crypto API (SubtleCrypto) for high performance AES-256-GCM.
 * Password derivation via PBKDF2 (100,000 iterations, HMAC-SHA-256).
 * No plaintext or password ever leaves the user's browser.
 */

const PBKDF2_ITERATIONS = 100000;

/**
 * Generate a strong, user-friendly alphanumeric password
 */
export function generateSecurePassword(length: number = 16): string {
    const charset = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
    const randomValues = new Uint8Array(length);
    if (typeof window !== 'undefined' && window.crypto) {
        window.crypto.getRandomValues(randomValues);
    } else {
        for (let i = 0; i < length; i++) {
            randomValues[i] = Math.floor(Math.random() * 256);
        }
    }
    let password = '';
    for (let i = 0; i < length; i++) {
        password += charset[randomValues[i] % charset.length];
    }
    return password;
}

/**
 * Convert ArrayBuffer or Uint8Array to Hex string
 */
export function bufferToHex(buffer: ArrayBuffer | Uint8Array): string {
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    let hex = '';
    for (let i = 0; i < bytes.length; i++) {
        hex += bytes[i].toString(16).padStart(2, '0');
    }
    return hex;
}

/**
 * Convert Hex string to Uint8Array
 */
export function hexToBuffer(hex: string): Uint8Array {
    const cleanHex = hex.trim();
    const bytes = new Uint8Array(Math.floor(cleanHex.length / 2));
    for (let i = 0; i < bytes.length; i++) {
        bytes[i] = parseInt(cleanHex.substring(i * 2, i * 2 + 2), 16);
    }
    return bytes;
}

/**
 * Derive AES-GCM 256-bit CryptoKey from password using PBKDF2
 */
async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const passwordBuffer = encoder.encode(password);

    const baseKey = await window.crypto.subtle.importKey(
        'raw',
        passwordBuffer,
        'PBKDF2',
        false,
        ['deriveKey']
    );

    return window.crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: salt as any,
            iterations: PBKDF2_ITERATIONS,
            hash: 'SHA-256',
        },
        baseKey,
        {
            name: 'AES-GCM',
            length: 256,
        },
        false,
        ['encrypt', 'decrypt']
    );
}

/**
 * Encrypt an ArrayBuffer with AES-256-GCM using a password
 * Returns the ciphertext along with the salt and IV used.
 */
export async function encryptData(
    data: ArrayBuffer,
    password: string
): Promise<{
    ciphertext: ArrayBuffer;
    saltHex: string;
    ivHex: string;
}> {
    if (!password) {
        throw new Error('Encryption password cannot be empty');
    }

    // 16-byte random salt for PBKDF2
    const salt = new Uint8Array(16);
    window.crypto.getRandomValues(salt);

    // 12-byte random IV for AES-GCM
    const iv = new Uint8Array(12);
    window.crypto.getRandomValues(iv);

    // Derive 256-bit key
    const key = await deriveKey(password, salt);

    // Encrypt
    const ciphertext = await window.crypto.subtle.encrypt(
        {
            name: 'AES-GCM',
            iv: iv as any,
            tagLength: 128,
        },
        key,
        data
    );

    return {
        ciphertext,
        saltHex: bufferToHex(salt),
        ivHex: bufferToHex(iv),
    };
}

/**
 * Decrypt an ArrayBuffer with AES-256-GCM using password, salt, and IV
 * Throws an error if the password or data is invalid.
 */
export async function decryptData(
    ciphertext: ArrayBuffer,
    password: string,
    saltHex: string,
    ivHex: string
): Promise<ArrayBuffer> {
    if (!password) {
        throw new Error('Password required for decryption');
    }

    const salt = hexToBuffer(saltHex);
    const iv = hexToBuffer(ivHex);

    if (salt.length !== 16) {
        throw new Error('Invalid salt length');
    }
    if (iv.length !== 12) {
        throw new Error('Invalid IV length');
    }

    // Derive the same key
    const key = await deriveKey(password, salt);

    try {
        const decrypted = await window.crypto.subtle.decrypt(
            {
                name: 'AES-GCM',
                iv: iv as any,
                tagLength: 128,
            },
            key,
            ciphertext
        );
        return decrypted;
    } catch (err) {
        throw new Error('Mật khẩu giải mã không chính xác hoặc dữ liệu bị lỗi.');
    }
}
