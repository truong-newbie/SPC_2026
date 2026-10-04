'use client';

import { useState, type ChangeEvent, type DragEvent } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { getFilesFromDataTransfer, getFilesFromInput, type ScannedFile } from '@/lib/directory';

export interface FileWithId {
    id: string;
    file: File;
    relativePath?: string;
}

export function useFileManagement() {
    const [files, setFiles] = useState<FileWithId[]>([]);
    const [isDragging, setIsDragging] = useState(false);

    const totalBytes = files.reduce((sum, f) => sum + f.file.size, 0);

    const appendScannedFiles = (incoming: ScannedFile[]) => {
        if (!incoming || incoming.length === 0) return;
        const mapped: FileWithId[] = incoming.map(({ file, relativePath }) => ({
            id: uuidv4(),
            file,
            relativePath,
        }));
        setFiles((prev) => [...prev, ...mapped]);
    };

    const handleFileSelection = (e: ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const scanned = getFilesFromInput(e.target.files);
            appendScannedFiles(scanned);
            e.target.value = '';
        }
    };

    const handleFolderSelection = (e: ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const scanned = getFilesFromInput(e.target.files);
            appendScannedFiles(scanned);
            e.target.value = '';
        }
    };

    const handleDeleteFile = (fileId: string) => {
        setFiles((prev) => prev.filter((f) => f.id !== fileId));
    };

    const handleDragOver = (e: DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e: DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = async (e: DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const scanned = await getFilesFromDataTransfer(e.dataTransfer);
        if (scanned.length > 0) {
            appendScannedFiles(scanned);
        }
    };

    const clearFiles = () => {
        setFiles([]);
    };

    return {
        files,
        setFiles,
        isDragging,
        totalBytes,
        handleFileSelection,
        handleFolderSelection,
        handleDeleteFile,
        handleDragOver,
        handleDragLeave,
        handleDrop,
        clearFiles,
    };
}
