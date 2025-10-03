// quick-debug.js - Run this in your browser console to debug the exact issue

import { auth } from './lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { db } from './lib/firebase';

async function quickDebug() {
  console.log('🔍 DEBUGGING ADMIN AUTHENTICATION...');
  console.log('=====================================');
  
  // 1. Check current user
  const user = auth.currentUser;
  console.log('1. Current User:', user ? {
    email: user.email,
    uid: user.uid
  } : '❌ No user');
  
  if (!user) {
    console.log('❌ Please log in first');
    return;
  }
  
  // 2. Check Firestore user document
  try {
    console.log('2. Checking Firestore user document...');
    const userDocRef = doc(db, 'users', user.uid);
    const userDoc = await getDoc(userDocRef);
    
    if (userDoc.exists()) {
      const userData = userDoc.data();
      console.log('✅ User document found:', {
        email: userData.email,
        role: userData.role,
        uid: userData.uid
      });
      
      if (userData.role === 'admin') {
        console.log('✅ Admin role confirmed');
      } else {
        console.log('❌ Role is not admin:', userData.role);
      }
    } else {
      console.log('❌ User document not found');
    }
  } catch (error) {
    console.log('❌ Error checking Firestore:', error.message);
  }
  
  // 3. Test token generation
  try {
    console.log('3. Testing token generation...');
    const token = await user.getIdToken(true); // Force refresh
    console.log('✅ Token generated successfully');
    console.log('Token length:', token.length);
    console.log('Token preview:', token.substring(0, 30) + '...');
  } catch (error) {
    console.log('❌ Token generation failed:', error.message);
  }
  
  // 4. Test API call with detailed logging
  try {
    console.log('4. Testing API call...');
    
    const token = await user.getIdToken(true);
    const response = await fetch('/api/payments/razorpay/order', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        amount: 10000, // 100 rupees in paise
        receipt: 'test-receipt-123'
      })
    });
    
    console.log('Response status:', response.status);
    console.log('Response ok:', response.ok);
    
    const responseData = await response.json();
    console.log('Response data:', responseData);
    
    if (response.ok) {
      console.log('✅ API call successful');
    } else {
      console.log('❌ API call failed');
      console.log('Error details:', responseData);
    }
  } catch (error) {
    console.log('❌ API call exception:', error.message);
  }
  
  console.log('=====================================');
  console.log('🔧 If you see errors above, check:');
  console.log('1. Server console logs for detailed error messages');
  console.log('2. Network tab in browser dev tools');
  console.log('3. Firebase project configuration');
}

// Run the debug
quickDebug();
