'use client';

import React from 'react';
import { getFileTypeMeta } from '@/lib/fileType';
import { cn } from '@/lib/utils';

interface FileIconProps {
    fileName: string;
    mimeType?: string;
    size?: 'sm' | 'md' | 'lg';
    className?: string;
    iconClassName?: string;
}

export function FileIcon({
    fileName,
    mimeType,
    size = 'md',
    className,
    iconClassName,
}: FileIconProps) {
    const meta = getFileTypeMeta(fileName, mimeType);
    const IconComponent = meta.icon;

    const sizeStyles = {
        sm: {
            container: 'w-7 h-7 rounded-lg',
            icon: 'w-3.5 h-3.5',
        },
        md: {
            container: 'w-10 h-10 rounded-xl',
            icon: 'w-5 h-5',
        },
        lg: {
            container: 'w-12 h-12 rounded-2xl',
            icon: 'w-6 h-6',
        },
    }[size];

    return (
        <div
            className={cn(
                'flex items-center justify-center shrink-0 border transition-all shadow-2xs',
                meta.bgClass,
                meta.borderClass,
                meta.colorClass,
                sizeStyles.container,
                className
            )}
            title={`${meta.label} (${fileName})`}
        >
            <IconComponent className={cn(sizeStyles.icon, iconClassName)} />
        </div>
    );
}

