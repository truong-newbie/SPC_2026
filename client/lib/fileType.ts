import {
    FileText,
    FileSpreadsheet,
    FileVideo,
    FileAudio,
    FileImage,
    FileArchive,
    FileCode,
    Presentation,
    FileBox,
    File,
    type LucideIcon,
} from 'lucide-react';

export interface FileTypeMeta {
    category:
        | 'pdf'
        | 'spreadsheet'
        | 'document'
        | 'presentation'
        | 'video'
        | 'audio'
        | 'image'
        | 'archive'
        | 'code'
        | 'text'
        | 'executable'
        | 'other';
    label: string;
    icon: LucideIcon;
    colorClass: string;
    bgClass: string;
    borderClass: string;
    badgeBgClass: string;
}

const EXT_TO_CATEGORY: Record<string, FileTypeMeta['category']> = {
    // PDF
    pdf: 'pdf',

    // Spreadsheets
    xlsx: 'spreadsheet',
    xls: 'spreadsheet',
    csv: 'spreadsheet',
    tsv: 'spreadsheet',
    ods: 'spreadsheet',
    numbers: 'spreadsheet',
    xlsm: 'spreadsheet',
    xlsb: 'spreadsheet',

    // Documents
    docx: 'document',
    doc: 'document',
    odt: 'document',
    rtf: 'document',
    pages: 'document',
    dotx: 'document',
    docm: 'document',

    // Presentations
    pptx: 'presentation',
    ppt: 'presentation',
    odp: 'presentation',
    key: 'presentation',
    ppsx: 'presentation',
    pps: 'presentation',
    potx: 'presentation',

    // Video
    mp4: 'video',
    mkv: 'video',
    avi: 'video',
    mov: 'video',
    webm: 'video',
    flv: 'video',
    wmv: 'video',
    m4v: 'video',
    '3gp': 'video',
    mts: 'video',
    m2ts: 'video',
    vob: 'video',
    ogv: 'video',

    // Audio
    mp3: 'audio',
    wav: 'audio',
    flac: 'audio',
    aac: 'audio',
    ogg: 'audio',
    m4a: 'audio',
    wma: 'audio',
    aiff: 'audio',
    opus: 'audio',
    mid: 'audio',
    midi: 'audio',
    alac: 'audio',

    // Images
    jpg: 'image',
    jpeg: 'image',
    png: 'image',
    gif: 'image',
    webp: 'image',
    svg: 'image',
    bmp: 'image',
    ico: 'image',
    tiff: 'image',
    tif: 'image',
    heic: 'image',
    heif: 'image',
    raw: 'image',
    cr2: 'image',
    nef: 'image',
    arw: 'image',
    psd: 'image',
    ai: 'image',
    eps: 'image',

    // Archives
    zip: 'archive',
    rar: 'archive',
    '7z': 'archive',
    tar: 'archive',
    gz: 'archive',
    bz2: 'archive',
    xz: 'archive',
    tgz: 'archive',
    iso: 'archive',
    dmg: 'archive',
    pkg: 'archive',
    cab: 'archive',
    zst: 'archive',

    // Code
    js: 'code',
    jsx: 'code',
    ts: 'code',
    tsx: 'code',
    html: 'code',
    htm: 'code',
    css: 'code',
    scss: 'code',
    sass: 'code',
    less: 'code',
    py: 'code',
    java: 'code',
    c: 'code',
    cpp: 'code',
    h: 'code',
    hpp: 'code',
    cs: 'code',
    go: 'code',
    rs: 'code',
    php: 'code',
    rb: 'code',
    swift: 'code',
    kt: 'code',
    json: 'code',
    xml: 'code',
    yaml: 'code',
    yml: 'code',
    sql: 'code',
    sh: 'code',
    bash: 'code',
    ps1: 'code',
    bat: 'code',
    cmd: 'code',
    md: 'code',
    graphql: 'code',
    lua: 'code',

    // Executable
    exe: 'executable',
    msi: 'executable',
    apk: 'executable',
    deb: 'executable',
    rpm: 'executable',
    appimage: 'executable',

    // Plain text
    txt: 'text',
    log: 'text',
    ini: 'text',
    cfg: 'text',
    conf: 'text',
    env: 'text',
};

const CATEGORY_META: Record<FileTypeMeta['category'], Omit<FileTypeMeta, 'category' | 'label'> & { defaultLabel: string }> = {
    pdf: {
        defaultLabel: 'PDF',
        icon: FileText,
        colorClass: 'text-red-600',
        bgClass: 'bg-red-50',
        borderClass: 'border-red-200/80',
        badgeBgClass: 'bg-red-100 text-red-700 border-red-200',
    },
    spreadsheet: {
        defaultLabel: 'XLS',
        icon: FileSpreadsheet,
        colorClass: 'text-emerald-600',
        bgClass: 'bg-emerald-50',
        borderClass: 'border-emerald-200/80',
        badgeBgClass: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    },
    document: {
        defaultLabel: 'DOC',
        icon: FileText,
        colorClass: 'text-blue-600',
        bgClass: 'bg-blue-50',
        borderClass: 'border-blue-200/80',
        badgeBgClass: 'bg-blue-100 text-blue-700 border-blue-200',
    },
    presentation: {
        defaultLabel: 'PPT',
        icon: Presentation,
        colorClass: 'text-amber-600',
        bgClass: 'bg-amber-50',
        borderClass: 'border-amber-200/80',
        badgeBgClass: 'bg-amber-100 text-amber-700 border-amber-200',
    },
    video: {
        defaultLabel: 'VIDEO',
        icon: FileVideo,
        colorClass: 'text-violet-600',
        bgClass: 'bg-violet-50',
        borderClass: 'border-violet-200/80',
        badgeBgClass: 'bg-violet-100 text-violet-700 border-violet-200',
    },
    audio: {
        defaultLabel: 'AUDIO',
        icon: FileAudio,
        colorClass: 'text-pink-600',
        bgClass: 'bg-pink-50',
        borderClass: 'border-pink-200/80',
        badgeBgClass: 'bg-pink-100 text-pink-700 border-pink-200',
    },
    image: {
        defaultLabel: 'IMG',
        icon: FileImage,
        colorClass: 'text-sky-600',
        bgClass: 'bg-sky-50',
        borderClass: 'border-sky-200/80',
        badgeBgClass: 'bg-sky-100 text-sky-700 border-sky-200',
    },
    archive: {
        defaultLabel: 'ZIP',
        icon: FileArchive,
        colorClass: 'text-orange-600',
        bgClass: 'bg-orange-50',
        borderClass: 'border-orange-200/80',
        badgeBgClass: 'bg-orange-100 text-orange-700 border-orange-200',
    },
    code: {
        defaultLabel: 'CODE',
        icon: FileCode,
        colorClass: 'text-indigo-600',
        bgClass: 'bg-indigo-50',
        borderClass: 'border-indigo-200/80',
        badgeBgClass: 'bg-indigo-100 text-indigo-700 border-indigo-200',
    },
    executable: {
        defaultLabel: 'APP',
        icon: FileBox,
        colorClass: 'text-slate-700',
        bgClass: 'bg-slate-100',
        borderClass: 'border-slate-300/80',
        badgeBgClass: 'bg-slate-200 text-slate-800 border-slate-300',
    },
    text: {
        defaultLabel: 'TXT',
        icon: FileText,
        colorClass: 'text-slate-600',
        bgClass: 'bg-slate-100',
        borderClass: 'border-slate-200/80',
        badgeBgClass: 'bg-slate-200/80 text-slate-700 border-slate-300',
    },
    other: {
        defaultLabel: 'FILE',
        icon: File,
        colorClass: 'text-slate-500',
        bgClass: 'bg-slate-100',
        borderClass: 'border-slate-200/80',
        badgeBgClass: 'bg-slate-200/80 text-slate-600 border-slate-300',
    },
};

export function getFileTypeMeta(fileName: string, mimeType?: string): FileTypeMeta {
    const ext = (fileName.split('.').pop() || '').toLowerCase();
    const mime = (mimeType || '').toLowerCase();

    let category: FileTypeMeta['category'] = 'other';

    // 1. Try MIME type matching
    if (mime) {
        if (mime === 'application/pdf') {
            category = 'pdf';
        } else if (
            mime.includes('spreadsheet') ||
            mime.includes('excel') ||
            mime === 'text/csv' ||
            mime === 'text/tab-separated-values'
        ) {
            category = 'spreadsheet';
        } else if (mime.includes('word') || mime === 'application/rtf') {
            category = 'document';
        } else if (mime.includes('powerpoint') || mime.includes('presentation')) {
            category = 'presentation';
        } else if (mime.startsWith('video/')) {
            category = 'video';
        } else if (mime.startsWith('audio/')) {
            category = 'audio';
        } else if (mime.startsWith('image/')) {
            category = 'image';
        } else if (
            mime.includes('zip') ||
            mime.includes('compressed') ||
            mime.includes('tar') ||
            mime.includes('gzip')
        ) {
            category = 'archive';
        } else if (
            mime.includes('json') ||
            mime.includes('javascript') ||
            mime.includes('html') ||
            mime.includes('xml') ||
            mime.includes('css')
        ) {
            category = 'code';
        } else if (mime.startsWith('text/')) {
            category = 'text';
        }
    }

    // 2. If MIME was generic or unhelpful, use extension
    if (category === 'other' || category === 'text') {
        if (ext && EXT_TO_CATEGORY[ext]) {
            category = EXT_TO_CATEGORY[ext];
        }
    }

    // Fallback: If ext is recognized even when MIME gave a different broad type
    if (ext && EXT_TO_CATEGORY[ext] && category === 'other') {
        category = EXT_TO_CATEGORY[ext];
    }

    const meta = CATEGORY_META[category];
    const label = ext && ext.length <= 4 ? ext.toUpperCase() : meta.defaultLabel;

    return {
        category,
        label,
        icon: meta.icon,
        colorClass: meta.colorClass,
        bgClass: meta.bgClass,
        borderClass: meta.borderClass,
        badgeBgClass: meta.badgeBgClass,
    };
}
