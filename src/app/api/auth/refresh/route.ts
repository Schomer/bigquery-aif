// src/app/api/auth/refresh/route.ts
// Server-side OAuth token refresh endpoint.
// Exchanges a Google OAuth refresh token for a new access token without
// requiring a browser popup. Used by the client when the access token expires.

import { NextRequest, NextResponse } from 'next/server';

const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';

export async function POST(req: NextRequest) {
  try {
    const { refreshToken } = await req.json();

    if (!refreshToken || typeof refreshToken !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid refreshToken' },
        { status: 400 },
      );
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      console.error('[auth/refresh] GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET not configured');
      return NextResponse.json(
        { error: 'Server OAuth credentials not configured' },
        { status: 500 },
      );
    }

    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    });

    const res = await fetch(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!res.ok) {
      const errBody = await res.text();
      console.error('[auth/refresh] Token exchange failed:', res.status, errBody);
      return NextResponse.json(
        { error: 'Token refresh failed', detail: errBody },
        { status: res.status },
      );
    }

    const data = await res.json();

    return NextResponse.json({
      access_token: data.access_token,
      expires_in: data.expires_in,
    });
  } catch (err: any) {
    console.error('[auth/refresh] Unexpected error:', err.message);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
