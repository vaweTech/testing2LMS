"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { signOut, onAuthStateChanged } from "firebase/auth";
import { auth, db, firestoreHelpers } from "../../lib/firebase";

export default function AdminDashboard() {
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const ref = firestoreHelpers.doc(db, "users", u.uid);
        const snap = await firestoreHelpers.getDoc(ref);
        setIsAdmin(snap.exists() && snap.data().role === "admin");
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  function logout() {
    signOut(auth);
  }

  if (loading) return <div>Loading...</div>;
  if (!user || !isAdmin) return <div>Access Denied</div>;

  return (
    <div className="relative p-8 min-h-screen">

      {/* Header */}
      <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8 border-b border-zinc-800 pb-5">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight ">Admin Dashboard</h1>
          <p className="mt-1 text-sm text-zinc-400">Manage content, users, and access controls</p>
        </div>
      </div>

      {/* Quick actions grid */}
      <div className="relative z-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <Link href="Admin/mcqs">
          <div className="group p-6 rounded-2xl cursor-pointer text-center bg-blue-50 border border-slate-200 hover:border-blue-300 transition-all shadow-sm hover:shadow-md">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 text-blue-600 ring-1 ring-blue-200 transition">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 6V18M6 12H18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold mb-1 text-slate-800">Manage MCQs</h2>
            <p className="text-sm text-slate-600">Add, edit, and delete multiple-choice questions.</p>
          </div>
        </Link>

        <Link href="/Admin/coding">
          <div className="group p-6 rounded-2xl cursor-pointer text-center bg-indigo-50 border border-slate-200 hover:border-indigo-300 transition-all shadow-sm hover:shadow-md">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600 ring-1 ring-indigo-200 transition">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M16 18L22 12L16 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M8 6L2 12L8 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold mb-1 text-slate-800">Manage Coding Questions</h2>
            <p className="text-sm text-slate-600">Create and manage programming challenges.</p>
          </div>
        </Link>

        <Link href="/Admin/tutorials">
          <div className="group p-6 rounded-2xl cursor-pointer text-center bg-amber-50 border border-slate-200 hover:border-amber-300 transition-all shadow-sm hover:shadow-md">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-amber-100 text-amber-600 ring-1 ring-amber-200 transition">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M4 19H20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                <path d="M8 17V5H16V17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold mb-1 text-slate-800">Manage Tutorials</h2>
            <p className="text-sm text-slate-600">Publish and update tutorials for learners.</p>
          </div>
        </Link>
         <Link href="/Admin/userManager">
          <div className="group p-6 rounded-2xl cursor-pointer text-center bg-rose-50 border border-slate-200 hover:border-rose-300 transition-all shadow-sm hover:shadow-md">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-rose-100 text-rose-600 ring-1 ring-rose-200 transition">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M16 21V19C16 17.8954 15.1046 17 14 17H6C4.89543 17 4 17.8954 4 19V21" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                <circle cx="10" cy="9" r="4" stroke="currentColor" strokeWidth="1.8" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold mb-1 text-slate-800">Manage Users</h2>
            <p className="text-sm text-slate-600">Manage users, classes and permissions.</p>
          </div>
        </Link>
        <Link href="/Admin/StudentInfo">
          <div className="group p-6 rounded-2xl cursor-pointer text-center bg-teal-50 border border-slate-200 hover:border-teal-300 transition-all shadow-sm hover:shadow-md">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-teal-100 text-teal-600 ring-1 ring-teal-200 transition">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M4 7H20M4 12H20M4 17H12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold mb-1 text-slate-800">Student Info</h2>
            <p className="text-sm text-slate-600">View and manage student information.</p>
          </div>
        </Link>

        <Link href="/Admin/assignments">
          <div className="group p-6 rounded-2xl cursor-pointer text-center bg-purple-50 border border-slate-200 hover:border-purple-300 transition-all shadow-sm hover:shadow-md">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-purple-100 text-purple-600 ring-1 ring-purple-200 transition">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M14 2V8H20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M16 13H8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M16 17H8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M10 9H9H8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold mb-1 text-slate-800">Assignment Submissions</h2>
            <p className="text-sm text-slate-600">Grade and review student assignments.</p>
          </div>
        </Link>
        <Link href="/Admin/trainers">
          <div className="group p-6 rounded-2xl cursor-pointer text-center bg-green-50 border border-slate-200 hover:border-green-300 transition-all shadow-sm hover:shadow-md">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-green-100 text-green-600 ring-1 ring-green-200 transition">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                <circle cx="12" cy="7" r="4" stroke="currentColor" strokeWidth="1.8" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold mb-1 text-slate-800">Manage Trainers</h2>
            <p className="text-sm text-slate-600">Create trainers and assign classes/courses.</p>
          </div>
        </Link>
      </div>
    </div>
  );
}
