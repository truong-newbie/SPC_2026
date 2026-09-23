'use client';

import { File, X } from 'lucide-react';
import { formatBytes } from '@/lib/download';
import { cn } from '@/lib/utils';
import { Button } from './Button';

interface FileCardProps {
    id: string;
    file: File;
    onDelete?: (id: string) => void;
    showDelete?: boolean;
}

export function FileCard({ id, file, onDelete, showDelete = true }: FileCardProps) {
    return (
        <div
            className={cn(
                'flex items-center gap-3 rounded-lg border bg-card p-3 shadow-sm',
                'transition-colors hover:bg-accent/50'
            )}
        >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <File className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-medium">{file.name}</p>
                <p className="text-xs text-muted-foreground">{formatBytes(file.size)}</p>
            </div>
            {showDelete && onDelete && (
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onDelete(id)}
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                >
                    <X className="h-4 w-4" />
                </Button>
            )}
        </div>
    );
}
