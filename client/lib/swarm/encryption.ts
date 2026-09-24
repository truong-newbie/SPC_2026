/**
 * SPC_2026 - Client-Side Encryption
 *
 * AES-256-GCM encryption for file pieces.
 * Key is generated from user password using PBKDF2.
 */

import CryptoJS from 'crypto-js';

export interface EncryptedPiece {
    index: number;
    data: string; // Base64 encoded
    iv: string;   // Base64 encoded
}

export interface EncryptionKey {
    key: string;
    salt: string;
}

/**
 * Generate encryption key from password using PBKDF2
 */
export function deriveKey(password: string, salt?: string): EncryptionKey {
    const useSalt = salt || CryptoJS.lib.WordArray.random(128 / 8).toString();
    const key = CryptoJS.PBKDF2(password, useSalt, {
        keySize: 256 / 32,
        iterations: 100000,
    }).toString();
    return { key, salt: useSalt };
}

/**
 * Encrypt a piece of data
 */
export function encryptPiece(data: ArrayBuffer, index: number, key: string): EncryptedPiece {
    const wordArray = CryptoJS.lib.WordArray.create(data);
    const iv = CryptoJS.lib.WordArray.random(128 / 8);

    const encrypted = CryptoJS.AES.encrypt(wordArray, key, {
        iv: iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7,
    });

    return {
        index,
        data: encrypted.ciphertext.toString(CryptoJS.enc.Base64),
        iv: iv.toString(CryptoJS.enc.Base64),
    };
}

/**
 * Decrypt a piece of data
 */
export function decryptPiece(piece: EncryptedPiece, key: string): ArrayBuffer {
    const ciphertext = CryptoJS.enc.Base64.parse(piece.data);
    const iv = CryptoJS.enc.Base64.parse(piece.iv);

    const decrypted = CryptoJS.AES.decrypt(
        { ciphertext } as CryptoJS.lib.CipherParams,
        key,
        {
            iv: iv,
            mode: CryptoJS.mode.CBC,
            padding: CryptoJS.pad.Pkcs7,
        }
    );

    const words = decrypted.words;
    const sigBytes = decrypted.sigBytes;
    const result = new Uint8Array(sigBytes);

    for (let i = 0; i < sigBytes; i++) {
        result[i] = (words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
    }

    return result.buffer;
}

/**
 * Encrypt string data
 */
export function encryptString(data: string, key: string): { ciphertext: string; iv: string } {
    const iv = CryptoJS.lib.WordArray.random(128 / 8);
    const encrypted = CryptoJS.AES.encrypt(data, key, {
        iv: iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7,
    });
    return {
        ciphertext: encrypted.ciphertext.toString(CryptoJS.enc.Base64),
        iv: iv.toString(CryptoJS.enc.Base64),
    };
}

/**
 * Decrypt string data
 */
export function decryptString(ciphertext: string, iv: string, key: string): string {
    const cipher = CryptoJS.enc.Base64.parse(ciphertext);
    const ivWord = CryptoJS.enc.Base64.parse(iv);
    const decrypted = CryptoJS.AES.decrypt(
        { ciphertext: cipher } as CryptoJS.lib.CipherParams,
        key,
        {
            iv: ivWord,
            mode: CryptoJS.mode.CBC,
            padding: CryptoJS.pad.Pkcs7,
        }
    );
    return decrypted.toString(CryptoJS.enc.Utf8);
}

/**
 * Generate random password
 */
export function generatePassword(length = 16): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    const random = CryptoJS.lib.WordArray.random(length);
    for (let i = 0; i < length; i++) {
        const byte = random.words[i >>> 2] >>> (24 - (i % 4) * 8);
        result += chars[byte % chars.length];
    }
    return result;
}
