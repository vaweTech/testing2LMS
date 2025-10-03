"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { doc, setDoc, serverTimestamp, collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import CheckTrainerAuth from "@/lib/CheckTrainerAuth";

function UnlockDayInner() {
  const params = useSearchParams();
  const classId = params.get("classId");
  const courseId = params.get("courseId");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [chapters, setChapters] = useState([]);
  const [selectedChapters, setSelectedChapters] = useState([]);
  const [classCourses, setClassCourses] = useState([]);
  const [selectedCourseId, setSelectedCourseId] = useState("");

  const effectiveCourseId = courseId || selectedCourseId || "";
  const key = classId ? `class:${classId}` : `course:${courseId}`;

  async function unlockToday() {
    setLoading(true);
    try {
      const today = new Date();
      const ymd = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
      // If specific chapters selected, unlock per chapter; else unlock key-wide
      if ((courseId || selectedCourseId) && selectedChapters.length > 0) {
        for (const chId of selectedChapters) {
          const ref = doc(db, "unlocks", `${key}|chapter:${chId}|${ymd}`);
          await setDoc(ref, { key, chapterId: chId, date: ymd, createdAt: serverTimestamp() }, { merge: true });
        }
      } else {
        const ref = doc(db, "unlocks", `${key}|${ymd}`);
        await setDoc(ref, { key, date: ymd, createdAt: serverTimestamp() }, { merge: true });
      }
      setStatus("Unlocked for today.");
    } catch (e) {
      setStatus(e.message || "Failed to unlock");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setStatus("");
  }, [key]);

  // Load chapters for the selected/derived course (optional)
  useEffect(() => {
    async function loadChapters() {
      const cid = effectiveCourseId;
      if (!cid) { setChapters([]); setSelectedChapters([]); return; }
      const snap = await getDocs(collection(db, "courses", cid, "chapters"));
      const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      items.sort((a, b) => {
        if (a.order !== undefined && b.order !== undefined) return a.order - b.order;
        if (a.order !== undefined) return -1;
        if (b.order !== undefined) return 1;
        return 0;
      });
      setChapters(items);
    }
    loadChapters().catch(() => setChapters([]));
  }, [effectiveCourseId]);

  // When a classId is provided, derive courses assigned to that class from students' chapterAccess
  useEffect(() => {
    async function loadClassCourses() {
      if (!classId) { setClassCourses([]); return; }
      const byClassId = await getDocs(query(collection(db, 'students'), where('classId', '==', classId)));
      const byArray = await getDocs(query(collection(db, 'students'), where('classIds', 'array-contains', classId)));
      const allDocs = [...byClassId.docs, ...byArray.docs];
      const seen = new Set();
      const courseIdSet = new Set();
      allDocs.forEach((d) => {
        if (seen.has(d.id)) return; seen.add(d.id);
        const data = d.data();
        const access = data?.chapterAccess || {};
        Object.keys(access).forEach((cid) => courseIdSet.add(cid));
      });
      const ids = Array.from(courseIdSet);
      if (ids.length === 0) { setClassCourses([]); setSelectedCourseId(""); return; }
      // Fetch course titles
      const fetched = [];
      for (const cid of ids) {
        const snap = await getDocs(query(collection(db, 'courses')));
        // naive: map from loaded list; optimize if needed
      }
      // Better: load all courses and map
      const allCoursesSnap = await getDocs(collection(db, 'courses'));
      const all = allCoursesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const filtered = all.filter((c) => ids.includes(c.id));
      setClassCourses(filtered);
      setSelectedCourseId(filtered[0]?.id || "");
    }
    loadClassCourses().catch(() => setClassCourses([]));
  }, [classId]);

  return (
    <CheckTrainerAuth>
      <div className="p-6 max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold mb-2">Unlock Day</h1>
        <p className="text-sm text-gray-600 mb-4">{classId ? `Class: ${classId}` : `Course: ${courseId}`}</p>

        {/* Class-based flow: pick a course assigned to this class */}
        {classId && classCourses.length > 0 && (
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">Select Course</label>
            <select
              value={selectedCourseId}
              onChange={(e) => setSelectedCourseId(e.target.value)}
              className="border rounded px-3 py-2 w-full"
            >
              {classCourses.map((c) => (
                <option key={c.id} value={c.id}>{c.title || c.id}</option>
              ))}
            </select>
          </div>
        )}

        {(effectiveCourseId && chapters.length > 0) && (
          <div className="mb-4 border rounded p-3">
            <h2 className="font-semibold mb-2">Select Chapters</h2>
            <div className="space-y-2 max-h-80 overflow-auto">
              {chapters.map((ch) => (
                <label key={ch.id} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selectedChapters.includes(ch.id)}
                    onChange={(e) => {
                      setSelectedChapters((prev) => e.target.checked ? [...prev, ch.id] : prev.filter((id) => id !== ch.id));
                    }}
                  />
                  <span>{ch.title || ch.id}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        <button onClick={unlockToday} disabled={loading} className={`px-4 py-2 rounded text-white ${loading ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'}`}>
          {loading ? 'Unlocking…' : (effectiveCourseId && selectedChapters.length > 0) ? 'Unlock Selected Chapters' : 'Unlock Today'}
        </button>
        {status && <p className="mt-3 text-sm text-emerald-700">{status}</p>}
      </div>
    </CheckTrainerAuth>
  );
}

export default function UnlockDayPage() {
  return (
    <Suspense fallback={<div className="p-6 max-w-xl mx-auto">Loading…</div>}>
      <UnlockDayInner />
    </Suspense>
  );
}


