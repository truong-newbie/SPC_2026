import { NextResponse } from 'next/server';

export async function GET() {
    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || '';
    return NextResponse.json({ socketUrl });
}
