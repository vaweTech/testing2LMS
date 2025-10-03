export const runtime = 'nodejs';
import { adminDb } from "@/lib/firebaseAdmin";
import admin from "firebase-admin";
import { z } from 'zod';

// Input validation schema
const updateFeeSchema = z.object({
  id: z.string().min(1, 'Student ID is required'),
  addAmount: z.number().positive('Amount must be positive'),
  paymentMethod: z.enum(['online', 'cash', 'cheque']).default('online')
});

async function updateFeeHandler(request) {
  try {
    console.log("Update student fee API called");
    const { id, addAmount, paymentMethod = "online" } = request.validatedBody;
    console.log("Received data:", { id, addAmount, paymentMethod });
    
    // Input validation is now handled by middleware

    // Use the correct Firebase Admin SDK syntax
    const docRef = adminDb.collection("students").doc(id);
    const docSnap = await docRef.get();
    
    console.log("Document exists:", docSnap.exists);
    
    if (!docSnap.exists) {
      return new Response(
        JSON.stringify({ error: "Student not found" }), 
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    const data = docSnap.data();
    console.log("Student data:", data);
    const currentPaid = Number(data.PayedFee ?? data.payedFee ?? 0);
    const totalFee = Number(data.totalFee ?? 0);
    const nextPaid = currentPaid + Number(addAmount);
    console.log("Fee calculation:", { currentPaid, totalFee, addAmount, nextPaid });

    // Check if payment exceeds total fee
    if (nextPaid > totalFee) {
      return new Response(
        JSON.stringify({ 
          error: `Payment amount (₹${addAmount}) would exceed total fee (₹${totalFee}). Current paid: ₹${currentPaid}` 
        }), 
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Prepare payment record with audit trail
    const paymentRecord = {
      amount: addAmount,
      paymentMethod: paymentMethod,
      paymentDate: new Date().toISOString(),
      status: "completed",
      type: "fee_payment",
      processedBy: request.user.uid, // Track who processed this payment
      processedByEmail: request.user.email
    };

    // Update student document
    await docRef.update({ 
      PayedFee: nextPaid,
      lastPaymentDate: new Date().toISOString(),
      lastPaymentAmount: addAmount,
      lastPaymentMethod: paymentMethod
    });

    // Add payment to payments subcollection for tracking
    try {
      const paymentsRef = docRef.collection("payments");
      await paymentsRef.add(paymentRecord);
      console.log("Payment record added to subcollection");
    } catch (paymentError) {
      console.warn("Failed to add payment record to subcollection:", paymentError);
      // Continue with main update even if payment record fails
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        PayedFee: nextPaid,
        previousPaid: currentPaid,
        totalFee: totalFee,
        remainingDue: Math.max(totalFee - nextPaid, 0),
        paymentMethod: paymentMethod,
        message: `${paymentMethod === 'cash' ? 'Cash payment' : 'Online payment'} of ₹${addAmount} recorded successfully. New paid amount: ₹${nextPaid}`,
        processedBy: request.user.email
      }), 
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Update student fee error:", e);
    return new Response(
      JSON.stringify({ error: e.message || "Failed to update fee" }), 
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

// Simplified admin authentication
export async function POST(request) {
  try {
    // Check authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid authorization header' }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    const idToken = authHeader.split('Bearer ')[1];
    if (!idToken) {
      return new Response(
        JSON.stringify({ error: 'Invalid token format' }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    // Verify token using the existing Firebase Admin SDK
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    console.log('Fee update - Token verified for user:', decodedToken.email);

    // Check admin role in Firestore
    const userDoc = await adminDb.collection('users').doc(decodedToken.uid).get();
    
    if (!userDoc.exists) {
      return new Response(
        JSON.stringify({ error: 'User not found in system' }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    const userData = userDoc.data();
    if (userData.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Admin access required. Your role: ' + (userData.role || 'none') }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }

    console.log('Fee update - Admin access granted to:', decodedToken.email);

    // Validate input
    const body = await request.json();
    const validated = updateFeeSchema.parse(body);

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

    return await updateFeeHandler(mockRequest);

  } catch (error) {
    console.error('Update student fee API error:', error);
    
    if (error.name === 'ZodError') {
      return new Response(
        JSON.stringify({ error: 'Invalid input data', details: error.errors }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
    
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}


