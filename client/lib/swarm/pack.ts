/**
 * SPC_2026 - Multi-file Packer / Unpacker for Swarm Transfers
 * Packs multiple files into a single binary stream with a lightweight header,
 * and unpacks them back into individual Blobs on the receiving end.
 */

const MAGIC = 'SPCPKG10'; // 8-byte magic header

export interface PackedFileInfo {
    name: string;
    size: number;
}

export interface UnpackedFile {
    name: string;
    size: number;
    blob: Blob;
}

/**
 * Pack one or more files into a single ArrayBuffer.
 * If there is only 1 file, returns the raw file ArrayBuffer directly (for zero overhead).
 * If there are multiple files, bundles them with the SPCPKG10 container header.
 */
export async function packFiles(files: File[]): Promise<{
    buffer: ArrayBuffer;
    totalSize: number;
    fileCount: number;
    displayName: string;
    files: PackedFileInfo[];
}> {
    if (!files || files.length === 0) {
        throw new Error('No files provided to pack');
    }

    // Single file optimization - keep raw
    if (files.length === 1) {
        const file = files[0];
        const buffer = await file.arrayBuffer();
        return {
            buffer,
            totalSize: file.size,
            fileCount: 1,
            displayName: file.name,
            files: [{ name: file.name, size: file.size }],
        };
    }

    // Multiple files: bundle with container format
    const manifest: PackedFileInfo[] = files.map((f) => ({
        name: f.name,
        size: f.size,
    }));

    const manifestJson = JSON.stringify({ files: manifest });
    const encoder = new TextEncoder();
    const manifestBytes = encoder.encode(manifestJson);

    // Calculate total packed size:
    // 8 bytes Magic + 4 bytes Manifest Length + Manifest JSON bytes + sum of file sizes
    const totalFilesSize = files.reduce((sum, f) => sum + f.size, 0);
    const headerSize = 8 + 4 + manifestBytes.byteLength;
    const totalPackedSize = headerSize + totalFilesSize;

    const packedBuffer = new ArrayBuffer(totalPackedSize);
    const packedView = new Uint8Array(packedBuffer);
    const dataView = new DataView(packedBuffer);

    // 1. Write Magic (8 bytes)
    for (let i = 0; i < 8; i++) {
        packedView[i] = MAGIC.charCodeAt(i);
    }

    // 2. Write Manifest Length (4 bytes uint32 big-endian)
    dataView.setUint32(8, manifestBytes.byteLength, false);

    // 3. Write Manifest JSON bytes
    packedView.set(manifestBytes, 12);

    // 4. Write each file's bytes
    let offset = headerSize;
    for (const file of files) {
        const fileBuffer = await file.arrayBuffer();
        packedView.set(new Uint8Array(fileBuffer), offset);
        offset += file.size;
    }

    const displayName = `${files.length} files (${formatDisplayName(files)})`;

    return {
        buffer: packedBuffer,
        totalSize: totalPackedSize,
        fileCount: files.length,
        displayName,
        files: manifest,
    };
}

/**
 * Unpack a downloaded ArrayBuffer.
 * If it has the SPCPKG10 magic header, unpacks into multiple files.
 * Otherwise, treats the whole buffer as a single file.
 */
export function unpackFiles(
    buffer: ArrayBuffer,
    fallbackFileName: string = 'downloaded-file'
): UnpackedFile[] {
    const bytes = new Uint8Array(buffer);

    // Check if buffer is large enough for magic header (at least 12 bytes)
    if (bytes.byteLength >= 12) {
        let isMagic = true;
        for (let i = 0; i < 8; i++) {
            if (bytes[i] !== MAGIC.charCodeAt(i)) {
                isMagic = false;
                break;
            }
        }

        if (isMagic) {
            try {
                const dataView = new DataView(buffer);
                const manifestLen = dataView.getUint32(8, false);

                if (12 + manifestLen <= bytes.byteLength) {
                    const decoder = new TextDecoder();
                    const manifestJson = decoder.decode(bytes.subarray(12, 12 + manifestLen));
                    const parsed = JSON.parse(manifestJson);

                    if (Array.isArray(parsed.files)) {
                        const results: UnpackedFile[] = [];
                        let fileOffset = 12 + manifestLen;

                        for (const item of parsed.files) {
                            const fileSize = Number(item.size);
                            if (fileOffset + fileSize <= bytes.byteLength) {
                                const fileSlice = bytes.subarray(fileOffset, fileOffset + fileSize);
                                const blob = new Blob([fileSlice]);
                                results.push({
                                    name: String(item.name || 'file'),
                                    size: fileSize,
                                    blob,
                                });
                                fileOffset += fileSize;
                            }
                        }

                        if (results.length > 0) {
                            return results;
                        }
                    }
                }
            } catch (err) {
                console.warn('Failed to parse multi-file bundle, falling back to single file:', err);
            }
        }
    }

    // Default: Single file
    return [
        {
            name: fallbackFileName,
            size: buffer.byteLength,
            blob: new Blob([buffer]),
        },
    ];
}

function formatDisplayName(files: File[]): string {
    if (files.length <= 2) {
        return files.map((f) => f.name).join(', ');
    }
    return `${files[0].name}, ${files[1].name} +${files.length - 2} more`;
}
