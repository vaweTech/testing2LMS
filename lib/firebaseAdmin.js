// lib/firebaseAdmin.js
import admin from 'firebase-admin';

// Check if Firebase Admin is already initialized
if (!admin.apps.length) {
  let serviceAccount = null;

  // Try environment variables first (for production/Vercel)
  if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    serviceAccount = {
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    };
    console.log('✅ Firebase Admin SDK initialized with environment variables');
  } 
  // Fallback to service account key file (for development)
  else if (process.env.NODE_ENV === 'development') {
    try {
      // eslint-disable-next-line import/no-dynamic-require, global-require
      serviceAccount = require('../serviceAccountKey.json');
      console.log('✅ Firebase Admin SDK initialized with service account key file');
    } catch (error) {
      console.error('❌ Failed to load service account key file:', error.message);
      throw new Error('Firebase service account not configured. Please set environment variables or add serviceAccountKey.json');
    }
  } else {
    throw new Error('❌ Firebase service account not configured. Please set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY environment variables.');
  }

  // Initialize Firebase Admin SDK
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: `https://${serviceAccount.projectId}.firebaseio.com`,
  });
}

export const adminDb = admin.firestore();
export default admin;
