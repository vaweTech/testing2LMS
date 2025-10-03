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

/**
 * Role-based access control for payment methods
 * - Only admins can record cash payments
 * - Any authenticated user can record online payments
 */
function checkPaymentMethodAccess(paymentMethod, userRole) {
  if (paymentMethod === 'cash' && userRole !== 'admin') {
    return {
      allowed: false,
      error: 'Only administrators can record cash payments. Your role: ' + (userRole || 'none')
    };
  }
  
  if (paymentMethod === 'cheque' && userRole !== 'admin') {
    return {
      allowed: false,
      error: 'Only administrators can record cheque payments. Your role: ' + (userRole || 'none')
    };
  }
  
  return { allowed: true };
}

async function updateFeeHandler(request) {
  try {
    console.log("🔧 Update student fee API called");
    const { id, addAmount, paymentMethod = "online" } = request.validatedBody;
    console.log("📋 Received data:", { id, addAmount, paymentMethod });
    
    // Check role-based access for payment method
    const accessCheck = checkPaymentMethodAccess(paymentMethod, request.user.role);
    if (!accessCheck.allowed) {
      console.error("❌ Access denied for payment method:", paymentMethod, "User role:", request.user.role);
      return new Response(
        JSON.stringify({ error: accessCheck.error }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }

    console.log("✅ Payment method access granted for:", paymentMethod);

    // Find student document
    const docRef = adminDb.collection("students").doc(id);
    const docSnap = await docRef.get();
    
    if (!docSnap.exists) {
      console.error("❌ Student not found:", id);
      return new Response(
        JSON.stringify({ error: "Student not found" }), 
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    const data = docSnap.data();
    console.log("📊 Student data retrieved:", { 
      name: data.name, 
      email: data.email, 
      totalFee: data.totalFee 
    });

    // Calculate fee amounts
    const currentPaid = Number(data.PayedFee ?? data.payedFee ?? 0);
    const totalFee = Number(data.totalFee ?? 0);
    const nextPaid = currentPaid + Number(addAmount);
    
    console.log("💰 Fee calculation:", { 
      currentPaid, 
      totalFee, 
      addAmount, 
      nextPaid,
      remainingBefore: totalFee - currentPaid,
      remainingAfter: totalFee - nextPaid
    });

    // Validate payment amount
    if (nextPaid > totalFee) {
      console.error("❌ Payment exceeds total fee:", { nextPaid, totalFee });
      return new Response(
        JSON.stringify({ 
          error: `Payment amount (₹${addAmount}) would exceed total fee (₹${totalFee}). Current paid: ₹${currentPaid}`,
          details: {
            currentPaid,
            totalFee,
            addAmount,
            maxAllowed: totalFee - currentPaid
          }
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
      processedBy: request.user.uid,
      processedByEmail: request.user.email,
      studentId: id,
      studentName: data.name,
      studentEmail: data.email
    };

    console.log("💾 Updating student document...");
    
    // Update student document
    await docRef.update({ 
      PayedFee: nextPaid,
      lastPaymentDate: new Date().toISOString(),
      lastPaymentAmount: addAmount,
      lastPaymentMethod: paymentMethod
    });

    console.log("✅ Student document updated successfully");

    // Add payment to payments subcollection for tracking
    try {
      const paymentsRef = docRef.collection("payments");
      await paymentsRef.add(paymentRecord);
      console.log("✅ Payment record added to subcollection");
    } catch (paymentError) {
      console.warn("⚠️ Failed to add payment record to subcollection:", paymentError);
      // Continue with main update even if payment record fails
    }

    const response = {
      success: true, 
      PayedFee: nextPaid,
      previousPaid: currentPaid,
      totalFee: totalFee,
      remainingDue: Math.max(totalFee - nextPaid, 0),
      paymentMethod: paymentMethod,
      message: `${paymentMethod === 'cash' ? 'Cash payment' : paymentMethod === 'cheque' ? 'Cheque payment' : 'Online payment'} of ₹${addAmount} recorded successfully. New paid amount: ₹${nextPaid}`,
      processedBy: request.user.email,
      studentId: id,
      timestamp: new Date().toISOString()
    };

    console.log("✅ Payment processed successfully:", {
      studentId: id,
      amount: addAmount,
      method: paymentMethod,
      processedBy: request.user.email
    });

    return new Response(
      JSON.stringify(response), 
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("❌ Update student fee error:", e);
    return new Response(
      JSON.stringify({ 
        error: e.message || "Failed to update fee",
        details: e.stack
      }), 
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

export async function POST(request) {
  try {
    console.log("🔧 Update student fee API called");
    
    // Check authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error("❌ Missing or invalid authorization header");
      return new Response(
        JSON.stringify({ error: 'Missing or invalid authorization header' }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    const idToken = authHeader.split('Bearer ')[1];
    if (!idToken) {
      console.error("❌ Invalid token format");
      return new Response(
        JSON.stringify({ error: 'Invalid token format' }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    // Verify Firebase ID token
    console.log("🔧 Verifying Firebase token...");
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    console.log("✅ Token verified for user:", decodedToken.email);

    // Get user data from Firestore
    console.log("🔧 Checking user role...");
    const userDoc = await adminDb.collection('users').doc(decodedToken.uid).get();
    
    if (!userDoc.exists) {
      console.error("❌ User not found in system:", decodedToken.email);
      return new Response(
        JSON.stringify({ error: 'User not found in system' }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    const userData = userDoc.data();
    const userRole = userData.role || 'user';
    
    console.log("✅ User role verified:", userRole);

    // Validate input
    console.log("🔧 Validating input...");
    const body = await request.json();
    console.log("📋 Raw request body:", body);
    
    const validated = updateFeeSchema.parse(body);
    console.log("✅ Input validated:", validated);

    // Execute handler with user context
    const mockRequest = {
      user: {
        uid: decodedToken.uid,
        email: decodedToken.email,
        role: userRole
      },
      validatedBody: validated
    };

    return await updateFeeHandler(mockRequest);

  } catch (error) {
    console.error('❌ Update student fee API error:', error);
    console.error('❌ Error stack:', error.stack);
    
    if (error.name === 'ZodError') {
      console.error("❌ Validation error:", error.errors);
      return new Response(
        JSON.stringify({ 
          error: 'Invalid input data', 
          details: error.errors,
          field: 'validation'
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
    
    if (error.code === 'auth/id-token-expired') {
      console.error("❌ Token expired");
      return new Response(
        JSON.stringify({ 
          error: 'Token has expired. Please refresh and try again.',
          code: 'token-expired'
        }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }
    
    if (error.code === 'auth/invalid-id-token') {
      console.error("❌ Invalid token");
      return new Response(
        JSON.stringify({ 
          error: 'Invalid token. Please log in again.',
          code: 'invalid-token'
        }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }
    
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        details: error.message,
        name: error.name,
        code: error.code
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}