"use client";

import { useEffect, useState } from "react";
import { auth, db } from "../../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, collection, getDocs, setDoc, serverTimestamp, query, where } from "firebase/firestore";
import CheckTrainerAuth from "@/lib/CheckTrainerAuth";

export default function TrainerHome() {
  const [userId, setUserId] = useState("");
  const [classes, setClasses] = useState([]);
  const [courses, setCourses] = useState([]);
  const [allowedClasses, setAllowedClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [classCourses, setClassCourses] = useState([]);
  const [unlockStatus, setUnlockStatus] = useState("");
  const [unlockLoading, setUnlockLoading] = useState(false);
  const [showChapterModal, setShowChapterModal] = useState(false);
  const [selectedCourseForUnlock, setSelectedCourseForUnlock] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [selectedChapters, setSelectedChapters] = useState([]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) return;
      setUserId(u.uid);
      const uSnap = await getDoc(doc(db, "users", u.uid));
      const data = uSnap.exists() ? uSnap.data() : {};
      setAllowedClasses(data.trainerClasses || []);
      const trainerCourses = data.trainerCourses || [];

      const [cSnap, crSnap] = await Promise.all([
        getDocs(collection(db, "classes")),
        getDocs(collection(db, "courses")),
      ]);
      setClasses(cSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      const allCourses = crSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setCourses(allCourses);
      // initialize class selection and derived courses
      if ((data.trainerClasses || []).length > 0) {
        setSelectedClassId(data.trainerClasses[0]);
      }
    });
    return () => unsub();
  }, []);

  // derive class courses whenever selection changes
  useEffect(() => {
    async function deriveClassCourses() {
      if (!selectedClassId) { setClassCourses([]); return; }
      // Read students with this class to gather chapterAccess keys
      const { getDocs, collection, query, where } = await import("firebase/firestore");
      const byClass = await getDocs(query(collection(db, 'students'), where('classId', '==', selectedClassId)));
      const byArray = await getDocs(query(collection(db, 'students'), where('classIds', 'array-contains', selectedClassId)));
      const all = [...byClass.docs, ...byArray.docs];
      const ids = new Set();
      all.forEach((d) => {
        const access = d.data()?.chapterAccess || {};
        Object.keys(access).forEach((cid) => ids.add(cid));
      });
      const filtered = courses.filter((c) => ids.has(c.id));
      setClassCourses(filtered);
    }
    deriveClassCourses().catch(() => setClassCourses([]));
  }, [selectedClassId, courses]);

  // Load chapters for a course
  const loadChapters = async (courseId) => {
    if (!courseId) {
      setChapters([]);
      setSelectedChapters([]);
      return;
    }
    try {
      const snap = await getDocs(collection(db, "courses", courseId, "chapters"));
      const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      items.sort((a, b) => {
        if (a.order !== undefined && b.order !== undefined) return a.order - b.order;
        if (a.order !== undefined) return -1;
        if (b.order !== undefined) return 1;
        return 0;
      });
      setChapters(items);
    } catch (error) {
      console.error("Error loading chapters:", error);
      setChapters([]);
    }
  };

  // Unlock functionality
  const unlockToday = async (courseId = null) => {
    setUnlockLoading(true);
    setUnlockStatus("");
    try {
      const today = new Date();
      const ymd = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
      
      if (courseId && selectedChapters.length > 0) {
        // Unlock specific chapters
        const key = `class:${selectedClassId}`;
        for (const chId of selectedChapters) {
          const ref = doc(db, "unlocks", `${key}|chapter:${chId}|${ymd}`);
          await setDoc(ref, { key, chapterId: chId, date: ymd, createdAt: serverTimestamp() }, { merge: true });
        }
        setUnlockStatus(`Unlocked ${selectedChapters.length} chapters for today.`);
      } else {
        // Unlock entire class or course
        const key = courseId ? `course:${courseId}` : `class:${selectedClassId}`;
        const ref = doc(db, "unlocks", `${key}|${ymd}`);
        await setDoc(ref, { key, date: ymd, createdAt: serverTimestamp() }, { merge: true });
        setUnlockStatus("Unlocked for today.");
      }
    } catch (error) {
      setUnlockStatus(error.message || "Failed to unlock");
    } finally {
      setUnlockLoading(false);
    }
  };

  // Handle class unlock
  const handleClassUnlock = async () => {
    await unlockToday();
  };

  // Handle course unlock
  const handleCourseUnlock = async (course) => {
    setSelectedCourseForUnlock(course);
    await loadChapters(course.id);
    setShowChapterModal(true);
  };

  // Handle chapter selection and unlock
  const handleChapterUnlock = async () => {
    if (selectedCourseForUnlock) {
      await unlockToday(selectedCourseForUnlock.id);
      setShowChapterModal(false);
      setSelectedChapters([]);
      setSelectedCourseForUnlock(null);
    }
  };

  return (
    <CheckTrainerAuth>
      <div className="p-6 max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">Trainer Panel</h1>
        <p className="text-gray-600 mb-4">Pick a class to see its assigned courses and unlock sessions.</p>
        
        {unlockStatus && (
          <div className={`mb-4 p-3 rounded ${unlockStatus.includes('Failed') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
            {unlockStatus}
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-white border rounded p-4">
            <h2 className="font-semibold mb-2">Your Classes</h2>
            {allowedClasses.length === 0 ? (
              <p className="text-sm text-gray-500">No class access yet.</p>
            ) : (
              <ul className="space-y-2">
                {allowedClasses.map((id) => {
                  const c = classes.find((x) => x.id === id);
                  const selected = id === selectedClassId;
                  return (
                    <li key={id} className={`flex items-center justify-between border rounded p-2 ${selected ? 'bg-blue-50 border-blue-300' : ''}`}>
                      <button className="text-left flex-1" onClick={() => setSelectedClassId(id)}>
                        {c?.name || id}
                      </button>
                      <button 
                        className="text-sm bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded"
                        onClick={handleClassUnlock}
                        disabled={unlockLoading}
                      >
                        {unlockLoading ? 'Unlocking...' : 'Unlock'}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="bg-white border rounded p-4">
            <h2 className="font-semibold mb-2">Assigned Courses</h2>
            {!selectedClassId ? (
              <p className="text-sm text-gray-500">Select a class to view its courses.</p>
            ) : classCourses.length === 0 ? (
              <p className="text-sm text-gray-500">No courses assigned to this class.</p>
            ) : (
              <ul className="space-y-2">
                {classCourses.map((cr) => (
                  <li key={cr.id} className="flex items-center justify-between border rounded p-2">
                    <span>{cr.title || cr.id}</span>
                    <button 
                      className="text-sm bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1 rounded"
                      onClick={() => handleCourseUnlock(cr)}
                      disabled={unlockLoading}
                    >
                      {unlockLoading ? 'Unlocking...' : 'Unlock'}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Chapter Selection Modal */}
        {showChapterModal && selectedCourseForUnlock && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
              <h2 className="text-xl font-bold mb-4">
                Select Chapters for {selectedCourseForUnlock.title || selectedCourseForUnlock.id}
              </h2>
              
              {chapters.length > 0 ? (
                <div className="space-y-2 mb-4 max-h-60 overflow-y-auto">
                  {chapters.map((ch) => (
                    <label key={ch.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded">
                      <input
                        type="checkbox"
                        checked={selectedChapters.includes(ch.id)}
                        onChange={(e) => {
                          setSelectedChapters((prev) => 
                            e.target.checked 
                              ? [...prev, ch.id] 
                              : prev.filter((id) => id !== ch.id)
                          );
                        }}
                        className="rounded"
                      />
                      <span className="flex-1">{ch.title || ch.id}</span>
                    </label>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 mb-4">No chapters found for this course.</p>
              )}

              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => {
                    setShowChapterModal(false);
                    setSelectedChapters([]);
                    setSelectedCourseForUnlock(null);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleChapterUnlock}
                  disabled={unlockLoading || selectedChapters.length === 0}
                  className={`px-4 py-2 rounded text-white ${
                    unlockLoading || selectedChapters.length === 0
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-emerald-600 hover:bg-emerald-700'
                  }`}
                >
                  {unlockLoading ? 'Unlocking...' : `Unlock ${selectedChapters.length} Chapter${selectedChapters.length !== 1 ? 's' : ''}`}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </CheckTrainerAuth>
  );
}


