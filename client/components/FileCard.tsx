'use client';

import { X, Folder } from 'lucide-react';
import { formatBytes } from '@/lib/download';
import { cn } from '@/lib/utils';
import { Button } from './Button';
import { FileIcon } from './FileIcon';
import { getFileTypeMeta } from '@/lib/fileType';

interface FileCardProps {
    id: string;
    file: File;
    relativePath?: string;
    onDelete?: (id: string) => void;
    showDelete?: boolean;
}

export function FileCard({ id, file, relativePath, onDelete, showDelete = true }: FileCardProps) {
    const meta = getFileTypeMeta(file.name, file.type);
    const folderPath = relativePath && relativePath.includes('/')
        ? relativePath.slice(0, relativePath.lastIndexOf('/'))
        : null;

    return (
        <div
            className={cn(
                'flex items-center gap-3 rounded-xl border border-slate-200/90 bg-white p-3 shadow-xs',
                'transition-all hover:border-slate-300 hover:shadow-sm'
            )}
        >
            <FileIcon fileName={file.name} mimeType={file.type} size="md" />
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold text-slate-800" title={relativePath || file.name}>
                        {file.name}
                    </p>
                    <span
                        className={cn(
                            'text-[10px] font-bold font-mono px-1.5 py-0.5 rounded border shrink-0',
                            meta.badgeBgClass
                        )}
                    >
                        {meta.label}
                    </span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-xs text-slate-500 font-medium">{formatBytes(file.size)}</p>
                    {folderPath && (
                        <span
                            className="inline-flex items-center gap-1 text-[11px] text-blue-600 bg-blue-50/80 px-1.5 py-0.5 border border-blue-200/60 rounded font-mono truncate max-w-[200px]"
                            title={relativePath}
                        >
                            <Folder className="w-3 h-3 shrink-0" />
                            <span className="truncate">{folderPath}</span>
                        </span>
                    )}
                </div>
            </div>
            {showDelete && onDelete && (
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onDelete(id)}
                    className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Xóa tệp này"
                >
                    <X className="h-4 w-4" />
                </Button>
            )}
        </div>
    );
}
