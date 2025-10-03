// app/api/test-auth/route.js - Simple authentication test API
import { withAdminAuth } from "@/lib/apiAuth";

async function testAuthHandler(request) {
  try {
    console.log('Test auth API called by:', request.user.email);
    
    return new Response(
      JSON.stringify({
        success: true,
        message: "Authentication successful",
        user: {
          uid: request.user.uid,
          email: request.user.email,
          role: request.user.role
        },
        timestamp: new Date().toISOString()
      }),
      { 
        status: 200, 
        headers: { "Content-Type": "application/json" } 
      }
    );
  } catch (error) {
    console.error('Test auth error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        status: 500, 
        headers: { "Content-Type": "application/json" } 
      }
    );
  }
}

export async function GET(request) {
  return await withAdminAuth(request, testAuthHandler);
}

export async function POST(request) {
  return await withAdminAuth(request, testAuthHandler);
}
