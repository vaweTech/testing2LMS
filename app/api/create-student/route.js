// export const runtime = 'nodejs';
// // app/api/create-student/route.js
// import { adminDb } from "@/lib/firebaseAdmin";
// import admin from 'firebase-admin';
// import { z } from 'zod';
// import crypto from 'crypto';

// // Input validation schema
// const createStudentSchema = z.object({
//   email: z.string().email('Invalid email format'),
//   name: z.string().min(2, 'Name must be at least 2 characters'),
//   classId: z.string().min(1, 'Class ID is required'),
//   regdNo: z.string().min(1, 'Registration number is required'),
//   fatherName: z.string().optional(),
//   address: z.string().optional(),
//   phones: z.string().optional(),
//   education: z.string().optional(),
//   fees: z.number().optional(),
//   courseTitle: z.string().optional()
// }).passthrough();

// // Minimal server-side normalization to E.164 (defaults to IN for 10-digit numbers)
// function normalizeToE164(phoneRaw) {
//   if (!phoneRaw) return undefined;
//   const raw = String(phoneRaw).trim();
//   if (/^\+\d{7,15}$/.test(raw)) return raw;
//   let digits = raw.replace(/\D/g, "");
//   while (digits.startsWith("0")) digits = digits.slice(1);
//   if (digits.length === 10) return `+91${digits}`; // assume IN default
//   if (digits.length >= 7 && digits.length <= 15) return `+${digits}`;
//   return undefined;
// }

// function normalizeEmail(rawEmail) {
//   const email = (rawEmail || "").trim().toLowerCase();
//   const [local, domain] = email.split("@");
//   if (!local || !domain) return email;
//   // Apply Gmail normalization rules
//   if (domain === "gmail.com" || domain === "googlemail.com") {
//     const plusIndex = local.indexOf("+");
//     const withoutPlus = plusIndex === -1 ? local : local.slice(0, plusIndex);
//     const withoutDots = withoutPlus.replace(/\./g, "");
//     return `${withoutDots}@gmail.com`;
//   }
//   return `${local}@${domain}`;
// }

// // Use fixed default password as requested
// const DEFAULT_STUDENT_PASSWORD = 'Vawe@2025';

// async function createStudentHandler(req) {
//   const body = req.validatedBody;
//   const { email, name, classId, regdNo } = body;
  
//   // Use fixed default password for new student accounts
//   const defaultPassword = DEFAULT_STUDENT_PASSWORD;

//   try {
//     let userRecord;
    
//     // Check if user already exists in Firebase Auth
//     try {
//       userRecord = await admin.auth().getUserByEmail(email);
//       console.log("User already exists in Firebase Auth:", userRecord.uid);
//     } catch (authError) {
//       if (authError.code === 'auth/user-not-found') {
//         // User doesn't exist, create new one
//         // Prefer normalized phone over raw
//         const phoneNormalized = normalizeToE164(body.phone || body.phone1);
//         const phoneNumber = phoneNormalized;
//         userRecord = await admin.auth().createUser({
//           email,
//           password: defaultPassword,
//           displayName: name,
//           phoneNumber,
//         });
//         console.log("Created new Firebase Auth user:", userRecord.uid);
//       } else {
//         throw authError;
//       }
//     }

//     // Backfill phone on existing auth user if missing and provided
//     const phoneNormalized = normalizeToE164(body.phone || body.phone1);
//     if (phoneNormalized && !userRecord.phoneNumber) {
//       try {
//         await admin.auth().updateUser(userRecord.uid, { phoneNumber: phoneNormalized });
//         userRecord = await admin.auth().getUser(userRecord.uid);
//       } catch (e) {
//         console.warn('Unable to set phoneNumber on user:', e?.message || e);
//       }
//     }

//     // Check if student already exists in Firestore (normalized email)
//     const studentsRef = adminDb.collection("students");
//     const emailNormalized = normalizeEmail(email);
//     const existingStudent = await studentsRef
//       .where("emailNormalized", "==", emailNormalized)
//       .get();
    
//     if (!existingStudent.empty) {
//       return new Response(
//         JSON.stringify({ error: "Student with this email already exists in the system" }),
//         { status: 400 }
//       );
//     }

//     // Check if registration number already exists
//     const existingRegdNo = await studentsRef
//       .where("regdNo", "==", regdNo)
//       .get();
    
//     if (!existingRegdNo.empty) {
//       return new Response(
//         JSON.stringify({ error: "Registration number already exists in the system" }),
//         { status: 400 }
//       );
//     }

//     // Save student in Firestore - persist all provided form fields
//     await adminDb.collection("students").add({
//       ...body, // regdNo, fatherName, address, phones, education, fees, etc.
//       email,
//       emailNormalized,
//       name,
//       classId,
//       uid: userRecord.uid,
//       role: "student",
//       // Store default password for admin visibility in Student Info (note: security trade-off as requested)
//       password: DEFAULT_STUDENT_PASSWORD,
//       // Store phone fields for UI/searching
//       phone1: body.phone1 || '',
//       phone: phoneNormalized || body.phone || body.phone1 || '',
//       coursesTitle: body.courseTitle ? [body.courseTitle] : [],
//       createdAt: admin.firestore.FieldValue.serverTimestamp(),
//       createdBy: req.user.uid, // Track who created this student
//     });

//     // Log the default password for admin reference (consider sending via email instead)
//     console.log(`Student created with default password: ${DEFAULT_STUDENT_PASSWORD}`);

//     return new Response(
//       JSON.stringify({ 
//         success: true, 
//         uid: userRecord.uid,
//         message: "Student created successfully. Default password is Vawe@2025",
//         defaultPassword: DEFAULT_STUDENT_PASSWORD
//       }),
//       { status: 200 }
//     );
//   } catch (error) {
//     console.error("Error creating student:", error);
//     return new Response(
//       JSON.stringify({ error: error.message }),
//       { status: 500 }
//     );
//   }
// }

// // Simplified admin authentication
// export async function POST(request) {
//   try {
//     // Check authorization header
//     const authHeader = request.headers.get('authorization');
//     if (!authHeader || !authHeader.startsWith('Bearer ')) {
//       return new Response(
//         JSON.stringify({ error: 'Missing or invalid authorization header' }),
//         { status: 401, headers: { "Content-Type": "application/json" } }
//       );
//     }

//     const idToken = authHeader.split('Bearer ')[1];
//     if (!idToken) {
//       return new Response(
//         JSON.stringify({ error: 'Invalid token format' }),
//         { status: 401, headers: { "Content-Type": "application/json" } }
//       );
//     }

//     // Verify token (admin initialized via lib/firebaseAdmin)
//     const decodedToken = await admin.auth().verifyIdToken(idToken);
//     console.log('Create student - Token verified for user:', decodedToken.email);

//     // Check admin role in Firestore
//     const userDoc = await admin.firestore()
//       .collection('users')
//       .doc(decodedToken.uid)
//       .get();
    
//     if (!userDoc.exists) {
//       return new Response(
//         JSON.stringify({ error: 'User not found in system' }),
//         { status: 404, headers: { "Content-Type": "application/json" } }
//       );
//     }

//     const userData = userDoc.data();
//     if (userData.role !== 'admin') {
//       return new Response(
//         JSON.stringify({ error: 'Admin access required. Your role: ' + (userData.role || 'none') }),
//         { status: 403, headers: { "Content-Type": "application/json" } }
//       );
//     }

//     console.log('Create student - Admin access granted to:', decodedToken.email);

//     // Validate input
//     const body = await request.json();
//     const validated = createStudentSchema.parse(body);

//     // Execute handler
//     const mockRequest = {
//       ...request,
//       user: {
//         uid: decodedToken.uid,
//         email: decodedToken.email,
//         role: userData.role
//       },
//       validatedBody: validated
//     };

//     return await createStudentHandler(mockRequest);

//   } catch (error) {
//     console.error('Create student API error:', error);
    
//     if (error.name === 'ZodError') {
//       return new Response(
//         JSON.stringify({ error: 'Invalid input data', details: error.errors }),
//         { status: 400, headers: { "Content-Type": "application/json" } }
//       );
//     }
    
//     return new Response(
//       JSON.stringify({ error: 'Internal server error', details: error.message }),
//       { status: 500, headers: { "Content-Type": "application/json" } }
//     );
//   }
// }





export const runtime = 'nodejs';

import { adminDb } from "@/lib/firebaseAdmin";
import admin from 'firebase-admin';
import { z } from 'zod';

// Input validation
const createStudentSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2),
  classId: z.string().min(1),
  regdNo: z.string().min(1),
  fatherName: z.string().optional(),
  address: z.string().optional(),
  phones: z.string().optional(),
  education: z.string().optional(),
  fees: z.number().optional(),
  courseTitle: z.string().optional()
}).passthrough();

const DEFAULT_PASSWORD = 'Vawe@2025';

function normalizeEmail(email) {
  if (!email) return "";
  const [local, domain] = email.trim().toLowerCase().split("@");
  if (domain === "gmail.com" || domain === "googlemail.com") {
    const plus = local.indexOf("+");
    const localClean = (plus === -1 ? local : local.slice(0, plus)).replace(/\./g, "");
    return `${localClean}@gmail.com`;
  }
  return email.trim().toLowerCase();
}

async function createStudentHandler(req) {
  const { email, name, classId, regdNo } = req.validatedBody;
  const studentsRef = adminDb.collection("students");
  const emailNormalized = normalizeEmail(email);

  // Check duplicates
  const existsEmail = await studentsRef.where("emailNormalized", "==", emailNormalized).get();
  if (!existsEmail.empty) return new Response(JSON.stringify({ error: "Email already exists" }), { status: 400 });

  const existsRegd = await studentsRef.where("regdNo", "==", regdNo).get();
  if (!existsRegd.empty) return new Response(JSON.stringify({ error: "RegdNo already exists" }), { status: 400 });

  // Create Firebase Auth user
  let userRecord;
  try { userRecord = await admin.auth().getUserByEmail(email); } 
  catch (err) {
    if (err.code === 'auth/user-not-found') {
      userRecord = await admin.auth().createUser({ email, password: DEFAULT_PASSWORD, displayName: name });
    } else throw err;
  }

  await studentsRef.add({
    ...req.validatedBody,
    uid: userRecord.uid,
    email,
    emailNormalized,
    role: "student",
    password: DEFAULT_PASSWORD,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    createdBy: req.user.uid,
    coursesTitle: req.validatedBody.courseTitle ? [req.validatedBody.courseTitle] : []
  });

  return new Response(JSON.stringify({ success: true, uid: userRecord.uid, defaultPassword: DEFAULT_PASSWORD }), { status: 200 });
}

export async function POST(request) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

    const idToken = authHeader.split("Bearer ")[1];
    const decodedToken = await admin.auth().verifyIdToken(idToken);

    const userDoc = await adminDb.collection("users").doc(decodedToken.uid).get();
    if (!userDoc.exists || userDoc.data().role !== 'admin') 
      return new Response(JSON.stringify({ error: "Admin access required" }), { status: 403 });

    const body = await request.json();
    const validated = createStudentSchema.parse(body);

    return await createStudentHandler({ ...request, user: { uid: decodedToken.uid }, validatedBody: validated });
  } catch (e) {
    if (e.name === 'ZodError') return new Response(JSON.stringify({ error: 'Invalid input', details: e.errors }), { status: 400 });
    return new Response(JSON.stringify({ error: e.message || "Internal server error" }), { status: 500 });
  }
}
