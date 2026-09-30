import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
    let socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || '';

    // If running in production but socketUrl accidentally points to localhost, sanitize to empty string
    if (process.env.NODE_ENV === 'production' && (socketUrl.includes('localhost') || socketUrl.includes('127.0.0.1'))) {
        socketUrl = '';
    }

    return NextResponse.json({ socketUrl });
}

