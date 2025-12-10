import { NextResponse } from 'next/server';

export async function POST() {
  const response = NextResponse.json({ success: true });

  // Set secure cookie with proper flags
  response.cookies.set('age-verified', 'true', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: '/',
  });

  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });

  // Clear the cookie
  response.cookies.set('age-verified', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 0,
    path: '/',
  });

  return response;
}
