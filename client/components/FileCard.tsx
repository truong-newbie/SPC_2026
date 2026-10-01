'use client';

import { X } from 'lucide-react';
import { formatBytes } from '@/lib/download';
import { cn } from '@/lib/utils';
import { Button } from './Button';
import { FileIcon } from './FileIcon';
import { getFileTypeMeta } from '@/lib/fileType';

interface FileCardProps {
    id: string;
    file: File;
    onDelete?: (id: string) => void;
    showDelete?: boolean;
}

export function FileCard({ id, file, onDelete, showDelete = true }: FileCardProps) {
    const meta = getFileTypeMeta(file.name, file.type);

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
                    <p className="truncate text-sm font-semibold text-slate-800">{file.name}</p>
                    <span
                        className={cn(
                            'text-[10px] font-bold font-mono px-1.5 py-0.5 rounded border shrink-0',
                            meta.badgeBgClass
                        )}
                    >
                        {meta.label}
                    </span>
                </div>
                <p className="text-xs text-slate-500 font-medium">{formatBytes(file.size)}</p>
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

