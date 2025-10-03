"use client"; 
import { useEffect, useState } from "react";
import { auth, db } from "../../lib/firebase";
import { signOut, onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import { doc, getDoc, collection, getDocs, query, where } from "firebase/firestore";
import { User, BookOpen, Activity, Clock } from "lucide-react";
import { motion } from "framer-motion";
import CheckAuth from "../../lib/CheckAuth";
import { makeAuthenticatedRequest } from "@/lib/authUtils";

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [courseTitles, setCourseTitles] = useState([]);
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(true);
  const [studentDocId, setStudentDocId] = useState(null);
  const [totalFee, setTotalFee] = useState(0);
  const [paidFee, setPaidFee] = useState(0);
  const [payAmount, setPayAmount] = useState("");
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState("");
  const [phone, setPhone] = useState("");
  const [courseName, setCourseName] = useState("");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        router.push("/auth/login");
        return;
      }

      setUser(u);

      // Get user role from users collection
      const userRef = doc(db, "users", u.uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const udata = userSnap.data();
        setRole(udata.role || "user");
      } else {
        setRole("user");
      }

      // Query students collection where uid == authenticated user uid
      const studentsRef = collection(db, "students");
      const q = query(studentsRef, where("uid", "==", u.uid));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const docRefSnap = querySnapshot.docs[0];
        const studentData = docRefSnap.data();
        setStudentDocId(docRefSnap.id);
        setDisplayName(studentData.name || u.email);

        const titles = Array.isArray(studentData.coursesTitle)
          ? studentData.coursesTitle
          : studentData.coursesTitle
          ? [studentData.coursesTitle]
          : [];

        setCourseTitles(titles);
        const tf = Number(studentData.totalFee ?? 0);
        const pf = Number(studentData.PayedFee ?? 0); // Use correct field name from Firebase
        setTotalFee(tf);
        setPaidFee(pf);
        const dueCalc = Math.max(tf - pf, 0);
        setPayAmount(dueCalc > 0 ? String(dueCalc) : "");
        
        // Extract phone and course info
        setPhone(studentData.phone || "");
        setCourseName(titles.length > 0 ? titles.join(", ") : "");
      } else {
        setDisplayName(u.email);
        setCourseTitles([]);
        setStudentDocId(null);
        setTotalFee(0);
        setPaidFee(0);
        setPayAmount("");
        setPhone("");
        setCourseName("");
      }

      setLoading(false);
    });

    return () => unsub();
  }, [router]);

  if (!user || loading) {
    return (
      <div className="flex justify-center items-center min-h-screen text-gray-600">
        Loading Dashboard...
      </div>
    );
  }

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/");
  };

  function loadRazorpayScript() {
    return new Promise((resolve) => {
      if (typeof window !== "undefined" && window.Razorpay) {
        resolve(true);
        return;
      }
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  }

  const dueAmount = Math.max(totalFee - paidFee, 0);

  function setAmountClamped(val) {
    const num = Number(val);
    if (Number.isNaN(num)) {
      setPayAmount("");
      setPayError("Enter a valid amount");
      return;
    }
    if (num < 0) {
      setPayAmount("0");
      setPayError("Amount cannot be negative");
      return;
    }
    if (num > dueAmount) {
      setPayAmount(String(dueAmount));
      setPayError(`Max allowed is ₹${dueAmount}`);
      return;
    }
    setPayError("");
    setPayAmount(String(num));
  }

  async function handlePayWithRazorpay() {
    if (!studentDocId) return;
    const amountNum = Number(payAmount);
    if (!amountNum || amountNum <= 0) {
      setPayError("Enter a valid amount greater than 0");
      return;
    }
    if (amountNum > dueAmount) {
      setPayError(`Amount cannot exceed due of ₹${dueAmount}`);
      return;
    }

    setPaying(true);
    const sdkLoaded = await loadRazorpayScript();
    if (!sdkLoaded) {
      alert("Failed to load Razorpay SDK");
      setPaying(false);
      return;
    }

    try {
      // Rely on makeAuthenticatedRequest to refresh token; avoid aggressive sign-out here
      if (!auth.currentUser) {
        alert("Please login to continue.");
        router.push("/auth/login");
        return;
      }

      const orderRes = await makeAuthenticatedRequest("/api/payments/razorpay/order-user", {
        method: "POST",
        body: JSON.stringify({ amount: Math.round(amountNum * 100), receipt: studentDocId || user.uid })
      });
      const order = await orderRes.json().catch(() => ({}));
      if (!orderRes.ok) {
        if (orderRes.status === 401) {
          alert("Session expired. Please login again.");
          await signOut(auth);
          router.push("/auth/login");
          return;
        }
        if (orderRes.status === 403) {
          alert(order.error || "Not authorized to pay from this account.");
          setPaying(false);
          return;
        }
        throw new Error(order.error || "Failed to create order");
      }

      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: order.amount,
        currency: order.currency,
        name: "Fee Payment",
        description: "Course Fee",
        order_id: order.id,
        prefill: { name: displayName, email: user.email },
        handler: async function (response) {
          try {
            // Verify payment and update fee on server
            const verifyRes = await makeAuthenticatedRequest("/api/verify-payment", {
              method: "POST",
              body: JSON.stringify({
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_signature: response.razorpay_signature,
                amount: Math.round(amountNum * 100),
                studentId: studentDocId,
              }),
            });

            const verifyData = await verifyRes.json().catch(() => ({}));
            if (!verifyRes.ok) throw new Error(verifyData.error || "Verification failed");

            // Server already updated fee; use response to refresh local state
            const newPaid = typeof verifyData.newPaid === 'number' ? verifyData.newPaid : (paidFee + amountNum);
            const newTotal = typeof verifyData.totalFee === 'number' ? verifyData.totalFee : totalFee;
            setPaidFee(newPaid);
            const newDue = Math.max(newTotal - newPaid, 0);
            setPayAmount(newDue > 0 ? String(newDue) : "");
            setPayError("");

            // Redirect to printable receipt with details
            console.log('Receipt params:', {
              totalFee: totalFee,
              paidFee: paidFee,
              amountNum: amountNum,
              phone: phone,
              courseName: courseName,
              dueAmount: totalFee - paidFee
            });
            
            const params = new URLSearchParams({
              payment_id: verifyData.payment_id || response.razorpay_payment_id || "",
              order_id: verifyData.order_id || response.razorpay_order_id || "",
              amount: String(Math.round(amountNum * 100)),
              studentId: studentDocId,
              name: displayName || "",
              email: user.email || "",
              phone: phone || "",
              course: courseName || "",
              totalFee: String(Math.round(totalFee * 100)),
              paidFee: String(Math.round(paidFee * 100)),
              dueAmount: String(Math.round((totalFee - paidFee) * 100)),
              date: new Date().toISOString(),
              paymentMethod: 'online',
              type: 'fee_payment',
            });
            router.push(`/receipt?${params.toString()}`);
          } catch (e) {
            alert(e.message || "Payment processed but update failed");
          } finally {
            setPaying(false);
          }
        },
        modal: { ondismiss: function () { setPaying(false); } },
        theme: { color: "#4F46E5" }
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (e) {
      console.error(e);
      alert(e.message || "Could not start payment");
      setPaying(false);
    }
  }

  return (
    <CheckAuth>
      <div className="min-h-screen bg-gradient-to-br from-blue-100 via-purple-100 to-pink-100 p-4 sm:p-6 lg:p-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 sm:mb-10 space-y-4 sm:space-y-0">
          <h1 className="text-2xl sm:text-3xl font-bold">Dashboard</h1>
          <button
            onClick={handleLogout}
            className="px-3 sm:px-4 py-2 rounded-xl border hover:bg-gray-100 transition text-sm sm:text-base"
          >
            Log Out
          </button>
        </div>

        {/* Profile */}
        <motion.div
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col items-center text-center bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 text-white p-6 sm:p-8 rounded-2xl sm:rounded-3xl shadow-xl w-fit mx-auto mb-8 sm:mb-12"
        >
          <div className="w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center rounded-full border-4 border-white shadow-lg mb-3 sm:mb-4 bg-white/20">
            <User className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
          </div>
          <h3 className="text-xl sm:text-2xl font-bold">{displayName}</h3>
          <p className="text-xs sm:text-sm opacity-80">{user.email}</p>
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-8 sm:mb-10">
          <div className="flex items-center space-x-3 sm:space-x-4 bg-white border border-gray-200 p-4 sm:p-6 rounded-xl sm:rounded-2xl shadow-md">
            <BookOpen className="w-6 h-6 sm:w-8 sm:h-8 text-blue-500" />
            <div>
              <h4 className="font-bold text-base sm:text-lg">{courseTitles.length}</h4>
              <p className="text-gray-600 text-sm sm:text-base">Active Courses</p>
            </div>
          </div>

          <div className="flex items-center space-x-3 sm:space-x-4 bg-white border border-gray-200 p-4 sm:p-6 rounded-xl sm:rounded-2xl shadow-md">
            <Activity className="w-6 h-6 sm:w-8 sm:h-8 text-green-500" />
            <div>
              <h4 className="font-bold text-base sm:text-lg">78%</h4>
              <p className="text-gray-600 text-sm sm:text-base">Overall Progress</p>
            </div>
          </div>

          <div className="flex items-center space-x-3 sm:space-x-4 bg-white border border-gray-200 p-4 sm:p-6 rounded-xl sm:rounded-2xl shadow-md sm:col-span-2 lg:col-span-1">
            <Clock className="w-6 h-6 sm:w-8 sm:h-8 text-purple-500" />
            <div>
              <h4 className="font-bold text-base sm:text-lg">12h</h4>
              <p className="text-gray-600 text-sm sm:text-base">Study Time</p>
            </div>
          </div>
        </div>

        {/* Your Courses Section - only if courses exist */}
        {courseTitles.length > 0 && (
          <>
            <h2 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6">Your Courses</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-8 sm:mb-12">
              {courseTitles.map((title, idx) => (
                <div
                  key={idx}
                  className="bg-white border border-gray-200 rounded-xl sm:rounded-2xl shadow-md p-4 sm:p-6 flex flex-col"
                >
                  <h3 className="text-base sm:text-lg font-semibold mb-2">{title}</h3>
                  <p className="text-sm text-gray-600">Progress info not available</p>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Pay Fee (Razorpay only) */}
        {studentDocId && (
          <div className="bg-white border border-gray-200 rounded-2xl shadow-md p-4 sm:p-6 mb-8">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg sm:text-xl font-semibold">Pay Fee</h3>
              {totalFee > 0 && (
                <span className="text-xs px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {Math.round((paidFee / Math.max(totalFee, 1)) * 100)}% paid
                </span>
              )}
            </div>

            {/* Progress bar */}
            {totalFee > 0 && (
              <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden mb-4">
                <div
                  className="h-2 bg-emerald-500"
                  style={{ width: `${Math.min(100, Math.max(0, (paidFee / Math.max(totalFee, 1)) * 100))}%` }}
                />
              </div>
            )}

            <div className="grid sm:grid-cols-3 gap-3 items-end">
              <div>
                <p className="text-sm text-gray-600">Total Fee</p>
                <p className="font-semibold">₹{totalFee}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Paid</p>
                <p className="font-semibold">₹{paidFee}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Due</p>
                <p className="font-semibold">₹{dueAmount}</p>
              </div>
            </div>
            <div className="mt-4 grid sm:grid-cols-[1fr_auto] gap-3">
              <div>
                <div className="flex items-stretch rounded-xl border overflow-hidden">
                  <span className="px-3 py-2 bg-gray-100 text-gray-600">₹</span>
                  <input
                    type="number"
                    min="0"
                    max={dueAmount}
                    step="0.01"
                    value={payAmount}
                    onChange={(e) => setAmountClamped(e.target.value)}
                    disabled={paying || dueAmount <= 0}
                    className="w-full px-3 py-2 outline-none"
                    placeholder="Enter amount"
                  />
                </div>
                {/* Quick amount chips */}
                {dueAmount > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    <button
                      onClick={() => setAmountClamped(Math.max(0, Math.round(dueAmount * 0.25)))}
                      disabled={paying}
                      className="px-2 py-1 text-xs rounded-full border hover:bg-gray-50"
                    >
                      25% (₹{Math.max(0, Math.round(dueAmount * 0.25))})
                    </button>
                    <button
                      onClick={() => setAmountClamped(Math.max(0, Math.round(dueAmount * 0.5)))}
                      disabled={paying}
                      className="px-2 py-1 text-xs rounded-full border hover:bg-gray-50"
                    >
                      50% (₹{Math.max(0, Math.round(dueAmount * 0.5))})
                    </button>
                    <button
                      onClick={() => setAmountClamped(dueAmount)}
                      disabled={paying}
                      className="px-2 py-1 text-xs rounded-full border hover:bg-gray-50"
                    >
                      Pay Due (₹{dueAmount})
                    </button>
                    <button
                      onClick={() => setAmountClamped(0)}
                      disabled={paying}
                      className="px-2 py-1 text-xs rounded-full border hover:bg-gray-50"
                    >
                      Clear
                    </button>
                  </div>
                )}
                {!!payError && (
                  <p className="mt-2 text-xs text-red-600">{payError}</p>
                )}
              </div>
              <button
                onClick={handlePayWithRazorpay}
                disabled={paying || dueAmount <= 0}
                className={`px-4 py-2 rounded-xl text-white whitespace-nowrap ${paying || dueAmount <= 0 ? "bg-gray-400" : "bg-emerald-600 hover:bg-emerald-700"}`}
              >
                {paying ? "Processing..." : `Pay ₹${payAmount || 0}`}
              </button>
            </div>
            {dueAmount <= 0 && (
              <p className="mt-2 text-sm text-green-700">No due amount. You are fully paid.</p>
            )}
            <p className="mt-2 text-xs text-gray-500">Payments are processed securely via Razorpay. Cash is accepted only in institute.</p>
          </div>
        )}
        

        {/* Admin Panel */}
        {role === "admin" && (
          <div className="mt-8 sm:mt-10 text-center">
            <button
              onClick={() => router.push("/Admin")}
              className="bg-red-500 text-white px-4 sm:px-6 py-2 sm:py-3 rounded-xl shadow-md hover:bg-red-600 transition text-sm sm:text-base"
            >
              Go to Admin Panel
            </button>
          </div>
        )}

        {/* Trainer Button (non-admin) */}
        {role === "trainer" && (
          <div className="mt-8 sm:mt-10 text-center">
            <button
              onClick={() => router.push("/trainer")}
              className="bg-blue-600 text-white px-4 sm:px-6 py-2 sm:py-3 rounded-xl shadow-md hover:bg-blue-700 transition text-sm sm:text-base"
            >
              Open Trainer Panel
            </button>
          </div>
        )}
      </div>
    </CheckAuth>
  );
}
