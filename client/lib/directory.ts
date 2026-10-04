/**
 * Directory traversal utilities for FileBridge
 * Supports recursive directory reading via WebKit FileSystem API (DataTransferItem)
 * and folder input selection (webkitRelativePath).
 */

export interface ScannedFile {
    file: File;
    relativePath: string;
}

/**
 * Recursively traverse a FileSystemEntry (file or directory).
 * Handles batching from readEntries() (which returns max 100 entries at a time).
 */
export async function traverseFileSystemEntry(
    entry: any,
    currentPath: string = ''
): Promise<ScannedFile[]> {
    if (!entry) return [];

    if (entry.isFile) {
        return new Promise<ScannedFile[]>((resolve) => {
            entry.file(
                (file: File) => {
                    const relativePath = currentPath ? `${currentPath}/${file.name}` : file.name;
                    try {
                        Object.defineProperty(file, 'relativePath', {
                            value: relativePath,
                            writable: true,
                            configurable: true,
                        });
                    } catch {
                        (file as any).relativePath = relativePath;
                    }
                    resolve([{ file, relativePath }]);
                },
                (err: any) => {
                    console.warn('Error reading file entry:', err);
                    resolve([]);
                }
            );
        });
    }

    if (entry.isDirectory) {
        const dirPath = currentPath ? `${currentPath}/${entry.name}` : entry.name;
        const dirReader = entry.createReader();
        const entries: any[] = [];

        const readAllEntries = async (): Promise<any[]> => {
            return new Promise((resolve) => {
                const readBatch = () => {
                    dirReader.readEntries(
                        (results: any[]) => {
                            if (!results || results.length === 0) {
                                resolve(entries);
                            } else {
                                entries.push(...results);
                                readBatch();
                            }
                        },
                        (err: any) => {
                            console.warn('Error reading dir entries:', err);
                            resolve(entries);
                        }
                    );
                };
                readBatch();
            });
        };

        const dirEntries = await readAllEntries();
        const results = await Promise.all(
            dirEntries.map((child) => traverseFileSystemEntry(child, dirPath))
        );
        return results.flat();
    }

    return [];
}

/**
 * Extract all files from a DragEvent's dataTransfer,
 * preserving directory hierarchies for folders.
 */
export async function getFilesFromDataTransfer(
    dataTransfer: DataTransfer
): Promise<ScannedFile[]> {
    const items = dataTransfer.items;
    if (items && items.length > 0 && typeof (items[0] as any).webkitGetAsEntry === 'function') {
        const entryPromises: Promise<ScannedFile[]>[] = [];
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (item.kind === 'file') {
                const entry = (item as any).webkitGetAsEntry?.();
                if (entry) {
                    entryPromises.push(traverseFileSystemEntry(entry));
                }
            }
        }
        const scanned = (await Promise.all(entryPromises)).flat();
        if (scanned.length > 0) {
            return scanned;
        }
    }

    // Fallback: standard files list
    if (dataTransfer.files && dataTransfer.files.length > 0) {
        return Array.from(dataTransfer.files).map((file) => {
            const relativePath = file.webkitRelativePath || file.name;
            try {
                Object.defineProperty(file, 'relativePath', {
                    value: relativePath,
                    writable: true,
                    configurable: true,
                });
            } catch {
                (file as any).relativePath = relativePath;
            }
            return { file, relativePath };
        });
    }

    return [];
}

/**
 * Map files from an HTMLInputElement (file or folder selection)
 */
export function getFilesFromInput(files: FileList | null): ScannedFile[] {
    if (!files || files.length === 0) return [];
    return Array.from(files).map((file) => {
        const relativePath = file.webkitRelativePath || file.name;
        try {
            Object.defineProperty(file, 'relativePath', {
                value: relativePath,
                writable: true,
                configurable: true,
            });
        } catch {
            (file as any).relativePath = relativePath;
        }
        return { file, relativePath };
    });
}
