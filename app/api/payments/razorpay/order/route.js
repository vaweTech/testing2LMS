export const runtime = "nodejs";

import Razorpay from "razorpay";
import { adminDb } from "@/lib/firebaseAdmin";
import admin from "firebase-admin";
import { z } from 'zod';

// Input validation schema
const createOrderSchema = z.object({
  amount: z.number().positive('Amount must be positive'),
  currency: z.string().default('INR'),
  receipt: z.string().min(1, 'Receipt is required')
});

async function createOrderHandler(request) {
  try {
    console.log('🔧 Creating Razorpay order...');
    const { amount, currency = "INR", receipt } = request.validatedBody;
    
    console.log('Order details:', { amount, currency, receipt });
    
    if (!amount) {
      console.error('❌ Amount is required');
      return new Response(JSON.stringify({ error: "Amount required" }), { status: 400 });
    }

    // Check Razorpay environment variables
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    
    console.log('Razorpay config check:', {
      keyId: keyId ? 'SET' : 'NOT SET',
      keySecret: keySecret ? 'SET' : 'NOT SET'
    });

    if (!keyId || !keySecret) {
      console.error('❌ Razorpay keys not configured');
      return new Response(
        JSON.stringify({ 
          error: "Server payment keys not configured",
          details: `RAZORPAY_KEY_ID: ${keyId ? 'SET' : 'NOT SET'}, RAZORPAY_KEY_SECRET: ${keySecret ? 'SET' : 'NOT SET'}`
        }),
        { status: 500 }
      );
    }

    console.log('🔧 Initializing Razorpay instance...');
    const instance = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });

    console.log('🔧 Creating order with Razorpay...');
    const order = await instance.orders.create({ amount, currency, receipt });
    
    console.log('✅ Order created successfully:', order.id);
    console.log(`Order created by ${request.user.email} for amount ${amount}`);
    
    return new Response(JSON.stringify(order), { 
      status: 200, 
      headers: { "Content-Type": "application/json" } 
    });
  } catch (e) {
    console.error("❌ Razorpay order error:", e);
    console.error("Error details:", {
      message: e.message,
      code: e.code,
      statusCode: e.statusCode,
      error: e.error
    });
    
    return new Response(
      JSON.stringify({ 
        error: e?.error?.description || e.message || "Order creation failed",
        details: e.error || e.message
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

// Simplified admin authentication
export async function POST(request) {
  try {
    console.log('🔧 Razorpay order API called');
    
    // Check authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('❌ Missing or invalid authorization header');
      return new Response(
        JSON.stringify({ error: 'Missing or invalid authorization header' }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    const idToken = authHeader.split('Bearer ')[1];
    if (!idToken) {
      console.error('❌ Invalid token format');
      return new Response(
        JSON.stringify({ error: 'Invalid token format' }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    console.log('🔧 Verifying Firebase token...');
    // Verify token using the existing Firebase Admin SDK
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    console.log('✅ Token verified for user:', decodedToken.email);

    console.log('🔧 Checking admin role...');
    // Check admin role in Firestore
    const userDoc = await adminDb.collection('users').doc(decodedToken.uid).get();
    
    if (!userDoc.exists) {
      console.error('❌ User not found in system');
      return new Response(
        JSON.stringify({ error: 'User not found in system' }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    const userData = userDoc.data();
    if (userData.role !== 'admin') {
      console.error('❌ Admin access required. User role:', userData.role);
      return new Response(
        JSON.stringify({ error: 'Admin access required. Your role: ' + (userData.role || 'none') }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }

    console.log('✅ Admin access granted to:', decodedToken.email);

    console.log('🔧 Validating input...');
    // Validate input
    const body = await request.json();
    console.log('Request body:', body);
    
    const validated = createOrderSchema.parse(body);
    console.log('✅ Input validated:', validated);

    // Execute handler
    const mockRequest = {
      ...request,
      user: {
        uid: decodedToken.uid,
        email: decodedToken.email,
        role: userData.role
      },
      validatedBody: validated
    };

    return await createOrderHandler(mockRequest);

  } catch (error) {
    console.error('❌ Razorpay order API error:', error);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    
    if (error.name === 'ZodError') {
      console.error('❌ Validation error:', error.errors);
      return new Response(
        JSON.stringify({ error: 'Invalid input data', details: error.errors }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
    
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        details: error.message,
        name: error.name
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}


