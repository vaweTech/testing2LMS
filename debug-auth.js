// debug-auth.js - Authentication debugging tool
// Run this in your browser console to debug authentication issues

import { auth } from './lib/firebase';
import { makeAuthenticatedRequest } from './lib/authUtils';

async function debugAuthentication() {
  console.log('🔍 DEBUGGING AUTHENTICATION...');
  console.log('================================');
  
  // 1. Check current user
  const user = auth.currentUser;
  console.log('1. Current Firebase User:', user ? {
    email: user.email,
    uid: user.uid,
    emailVerified: user.emailVerified
  } : '❌ No user logged in');
  
  if (!user) {
    console.log('❌ SOLUTION: Please log in first');
    return;
  }
  
  // 2. Check token
  try {
    const token = await user.getIdToken();
    console.log('2. Firebase Token:', token ? '✅ Valid token received' : '❌ No token');
    console.log('   Token preview:', token.substring(0, 20) + '...');
  } catch (error) {
    console.log('2. Firebase Token: ❌ Error getting token:', error.message);
  }
  
  // 3. Test API call
  try {
    console.log('3. Testing API call...');
    const response = await makeAuthenticatedRequest('/api/admin-test', {
      method: 'GET'
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('3. API Test: ✅ Success');
      console.log('   Response:', data);
    } else {
      const error = await response.json();
      console.log('3. API Test: ❌ Failed');
      console.log('   Status:', response.status);
      console.log('   Error:', error);
    }
  } catch (error) {
    console.log('3. API Test: ❌ Exception:', error.message);
  }
  
  // 4. Check Firestore user document
  try {
    console.log('4. Checking Firestore user document...');
    const { doc, getDoc } = await import('firebase/firestore');
    const { db } = await import('./lib/firebase');
    
    const userDocRef = doc(db, 'users', user.uid);
    const userDoc = await getDoc(userDocRef);
    
    if (userDoc.exists()) {
      const userData = userDoc.data();
      console.log('4. Firestore User: ✅ Found');
      console.log('   Role:', userData.role);
      console.log('   Email:', userData.email);
      
      if (userData.role !== 'admin') {
        console.log('❌ PROBLEM: User role is not "admin"');
        console.log('   SOLUTION: Update your user document in Firestore to have role: "admin"');
      } else {
        console.log('✅ User has admin role');
      }
    } else {
      console.log('4. Firestore User: ❌ Not found');
      console.log('   SOLUTION: Create a user document in Firestore with your UID and role: "admin"');
    }
  } catch (error) {
    console.log('4. Firestore Check: ❌ Error:', error.message);
  }
  
  console.log('================================');
  console.log('🔧 COMMON SOLUTIONS:');
  console.log('1. Make sure you are logged in');
  console.log('2. Check that your user document in Firestore has role: "admin"');
  console.log('3. Try refreshing the page and logging in again');
  console.log('4. Clear browser storage and log in again');
}

// Run the debug
debugAuthentication();
