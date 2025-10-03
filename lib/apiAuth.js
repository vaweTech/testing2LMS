// lib/apiAuth.js - Server-side API Authentication Middleware
import { NextResponse } from 'next/server';
import admin from '@/lib/firebaseAdmin';

/**
 * Middleware to verify Firebase ID token from Authorization header
 * Usage: export async function POST(req) { return await withAuth(req, handler); }
 */
export async function withAuth(req, handler) {
  try {
    const authHeader = req.headers.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('Missing authorization header');
      return NextResponse.json(
        { error: 'Missing or invalid authorization header' },
        { status: 401 }
      );
    }

    const idToken = authHeader.split('Bearer ')[1];
    
    if (!idToken || idToken.length < 10) {
      console.error('Invalid token format');
      return NextResponse.json(
        { error: 'Invalid token format' },
        { status: 401 }
      );
    }
    
    // Verify the ID token
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    console.log('Token verified for user:', decodedToken.email);
    
    // Add user info to request object
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      role: decodedToken.role || 'user'
    };

    return await handler(req);
  } catch (error) {
    console.error('Auth verification failed:', error);
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
    
    // Provide more specific error messages
    let errorMessage = 'Authentication failed';
    if (error.code === 'auth/id-token-expired') {
      errorMessage = 'Token has expired. Please refresh and try again.';
    } else if (error.code === 'auth/invalid-id-token') {
      errorMessage = 'Invalid token. Please log in again.';
    } else if (error.code === 'auth/user-disabled') {
      errorMessage = 'User account has been disabled.';
    }
    
    return NextResponse.json(
      { error: errorMessage, code: error.code },
      { status: 401 }
    );
  }
}

/**
 * Middleware to verify admin role
 */
export async function withAdminAuth(req, handler) {
  try {
    const authHeader = req.headers.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('Missing authorization header for admin request');
      return NextResponse.json(
        { error: 'Missing or invalid authorization header' },
        { status: 401 }
      );
    }

    const idToken = authHeader.split('Bearer ')[1];
    
    if (!idToken || idToken.length < 10) {
      console.error('Invalid token format for admin request');
      return NextResponse.json(
        { error: 'Invalid token format' },
        { status: 401 }
      );
    }
    
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    console.log('Admin token verified for user:', decodedToken.email);
    
    // Check if user is admin in Firestore
    const userDoc = await admin.firestore()
      .collection('users')
      .doc(decodedToken.uid)
      .get();
    
    if (!userDoc.exists) {
      console.error('User document not found for:', decodedToken.email);
      return NextResponse.json(
        { error: 'User not found in system' },
        { status: 404 }
      );
    }

    const userData = userDoc.data();
    console.log('User role:', userData.role);
    
    if (userData.role !== 'admin') {
      console.error('Non-admin user attempted admin access:', decodedToken.email, 'Role:', userData.role);
      return NextResponse.json(
        { error: 'Admin access required. Your role: ' + (userData.role || 'none') },
        { status: 403 }
      );
    }

    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      role: userData.role
    };

    console.log('Admin access granted to:', decodedToken.email);
    return await handler(req);
  } catch (error) {
    console.error('Admin auth verification failed:', error);
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
    
    // Provide more specific error messages
    let errorMessage = 'Admin authentication failed';
    if (error.code === 'auth/id-token-expired') {
      errorMessage = 'Admin token has expired. Please refresh and try again.';
    } else if (error.code === 'auth/invalid-id-token') {
      errorMessage = 'Invalid admin token. Please log in again.';
    } else if (error.code === 'auth/user-disabled') {
      errorMessage = 'Admin account has been disabled.';
    }
    
    return NextResponse.json(
      { error: errorMessage, code: error.code },
      { status: 401 }
    );
  }
}

/**
 * Rate limiting middleware
 */
const rateLimitMap = new Map();

export function withRateLimit(maxRequests = 100, windowMs = 15 * 60 * 1000) {
  return async function(req, handler) {
    const clientIP = req.headers.get('x-forwarded-for') || 
                    req.headers.get('x-real-ip') || 
                    'unknown';
    
    const now = Date.now();
    const windowStart = now - windowMs;
    
    // Clean old entries
    for (const [key, data] of rateLimitMap.entries()) {
      if (data.timestamp < windowStart) {
        rateLimitMap.delete(key);
      }
    }
    
    const key = `${clientIP}-${req.url}`;
    const current = rateLimitMap.get(key) || { count: 0, timestamp: now };
    
    if (current.timestamp < windowStart) {
      current.count = 1;
      current.timestamp = now;
    } else {
      current.count++;
    }
    
    rateLimitMap.set(key, current);
    
    if (current.count > maxRequests) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 }
      );
    }
    
    return await handler(req);
  };
}

/**
 * Input validation middleware
 */
export function validateInput(schema) {
  return async function(req, handler) {
    try {
      const body = await req.json();
      const validated = schema.parse(body);
      req.validatedBody = validated;
      return await handler(req);
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid input data', details: error.errors },
        { status: 400 }
      );
    }
  };
}
