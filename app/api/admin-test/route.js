import { adminDb } from "@/lib/firebaseAdmin";

export async function GET() {
  try {
    console.log("Testing Admin Functionalities...");
    
    const results = {
      firebaseConnection: false,
      collections: {},
      adminAuth: false,
      errors: [],
      environment: process.env.NODE_ENV
    };

    // Check if Firebase Admin is initialized
    if (!adminDb) {
      results.errors.push("Firebase Admin not initialized - missing environment variables");
      return new Response(
        JSON.stringify(results, null, 2),
        { 
          status: 503, 
          headers: { 
            "Content-Type": "application/json",
            "Cache-Control": "no-cache"
          } 
        }
      );
    }

    // Test 1: Firebase Connection
    try {
      console.log("Testing Firebase Admin connection...");
      const testQuery = await adminDb.collection("users").limit(1).get();
      results.firebaseConnection = true;
      console.log("✅ Firebase connection successful");
    } catch (error) {
      results.errors.push(`Firebase connection failed: ${error.message}`);
      console.error("❌ Firebase connection failed:", error);
    }

    // Test 2: Check Collections
    const collectionsToTest = [
      "users", "students", "courses", "mcqs", "questions", "classes"
    ];

    for (const collectionName of collectionsToTest) {
      try {
        const snap = await adminDb.collection(collectionName).limit(1).get();
        results.collections[collectionName] = {
          exists: true,
          count: snap.size,
          sample: snap.docs.length > 0 ? Object.keys(snap.docs[0].data()) : []
        };
        console.log(`✅ Collection ${collectionName}: ${snap.size} documents`);
      } catch (error) {
        results.collections[collectionName] = {
          exists: false,
          error: error.message
        };
        results.errors.push(`Collection ${collectionName} failed: ${error.message}`);
        console.error(`❌ Collection ${collectionName} failed:`, error);
      }
    }

    // Test 3: Admin Users
    try {
      const adminUsers = await adminDb.collection("users")
        .where("role", "==", "admin")
        .limit(5)
        .get();
      
      results.adminAuth = {
        success: true,
        adminCount: adminUsers.size,
        admins: adminUsers.docs.map(doc => ({
          id: doc.id,
          email: doc.data().email,
          role: doc.data().role
        }))
      };
      console.log(`✅ Found ${adminUsers.size} admin users`);
    } catch (error) {
      results.adminAuth = {
        success: false,
        error: error.message
      };
      results.errors.push(`Admin auth check failed: ${error.message}`);
      console.error("❌ Admin auth check failed:", error);
    }

    return new Response(
      JSON.stringify(results, null, 2),
      { 
        status: 200, 
        headers: { 
          "Content-Type": "application/json",
          "Cache-Control": "no-cache"
        } 
      }
    );

  } catch (error) {
    console.error("Admin test error:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        stack: error.stack 
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
