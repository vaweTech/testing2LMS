import { adminDb } from "@/lib/firebaseAdmin";

export async function GET() {
  try {
    console.log("Testing Firebase connection...");
    
    // Test basic connection
    console.log("Admin DB object:", typeof adminDb);
    console.log("Admin DB collections method:", typeof adminDb.collection);
    
    // Try to get a single document to test connection
    const testQuery = await adminDb.collection("students").limit(1).get();
    
    console.log("Query result:", testQuery);
    console.log("Query size:", testQuery.size);
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Firebase connection successful",
        documentCount: testQuery.size,
        adminDbType: typeof adminDb,
        hasCollectionMethod: typeof adminDb.collection === 'function'
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Firebase test error:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        stack: error.stack,
        adminDbType: typeof adminDb
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
