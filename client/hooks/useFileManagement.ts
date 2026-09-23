'use client';

import { useState, type ChangeEvent, type DragEvent } from 'react';
import { v4 as uuidv4 } from 'uuid';

export interface FileWithId {
    id: string;
    file: File;
}

export function useFileManagement() {
    const [files, setFiles] = useState<FileWithId[]>([]);
    const [isDragging, setIsDragging] = useState(false);

    const totalBytes = files.reduce((sum, f) => sum + f.file.size, 0);

    const addFiles = (incoming: FileList) => {
        const mapped = Array.from(incoming).map((file) => ({
            id: uuidv4(),
            file,
        }));
        setFiles((prev) => [...prev, ...mapped]);
    };

    const handleFileSelection = (e: ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            addFiles(e.target.files);
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

    const handleDrop = (e: DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            addFiles(e.dataTransfer.files);
        }
    };

    return {
        files,
        isDragging,
        totalBytes,
        handleFileSelection,
        handleDeleteFile,
        handleDragOver,
        handleDragLeave,
        handleDrop,
    };
}
