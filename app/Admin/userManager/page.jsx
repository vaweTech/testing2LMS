"use client";

import { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  doc,
  deleteDoc,
  updateDoc,
  addDoc,
  writeBatch,
  arrayUnion,
  arrayRemove,
} from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { useRouter } from "next/navigation";
import CheckAdminAuth from "@/lib/CheckAdminAuth";
import AdmissionForm from "@/components/AdmissionForm";

export default function UserManagerPage() {
  const router = useRouter();
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [courses, setCourses] = useState([]);
  const [chapters, setChapters] = useState([]);
  const [showAdmissionModal, setShowAdmissionModal] = useState(false);
  const [expandedClasses, setExpandedClasses] = useState({});
  const [showEditClassModal, setShowEditClassModal] = useState(false);
  const [editClassId, setEditClassId] = useState("");
  const [editClassName, setEditClassName] = useState("");
  const [editSelectedStudentIds, setEditSelectedStudentIds] = useState([]);
  const [moveTargetClassId, setMoveTargetClassId] = useState("");

  // 🔹 State
  const [searchEmail, setSearchEmail] = useState("");
  const [selectedStudent, setSelectedStudent] = useState("");
  const [assignClass, setAssignClass] = useState("");

  const [selectedStudentIds, setSelectedStudentIds] = useState([]);

  const [selectedClass, setSelectedClass] = useState("");
  const [selectedCourse, setSelectedCourse] = useState("");
  const [selectedChapters, setSelectedChapters] = useState([]);
  const [newClass, setNewClass] = useState({ name: "" });

  // Fetch Data
  useEffect(() => {
    fetchClasses();
    fetchStudents();
    fetchCourses();
  }, []);

  async function handleAddClass(e) {
    e.preventDefault();
    if (!newClass.name) return alert("Class name is required");
    await addDoc(collection(db, "classes"), newClass);
    setNewClass({ name: "" });
    fetchClasses();
  }

  async function fetchClasses() {
    const snap = await getDocs(collection(db, "classes"));
    setClasses(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  }

  async function fetchStudents() {
    const snap = await getDocs(collection(db, "students"));
    setStudents(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  }

  async function fetchCourses() {
    const snap = await getDocs(collection(db, "courses"));
    setCourses(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  }

  // Edit Class helpers
  function openEditClass(c) {
    setEditClassId(c.id);
    setEditClassName(c.name || "");
    const classStudents = students.filter((s) => Array.isArray(s.classIds) ? s.classIds.includes(c.id) : s.classId === c.id);
    setEditSelectedStudentIds(classStudents.map((s) => s.id));
    setMoveTargetClassId("");
    setShowEditClassModal(true);
  }

  function toggleEditSelectOne(studentId) {
    setEditSelectedStudentIds((prev) =>
      prev.includes(studentId)
        ? prev.filter((id) => id !== studentId)
        : [...prev, studentId]
    );
  }

  function editSelectAllInClass() {
    const classStudents = students.filter((s) => Array.isArray(s.classIds) ? s.classIds.includes(editClassId) : s.classId === editClassId);
    setEditSelectedStudentIds(classStudents.map((s) => s.id));
  }

  function editClearSelection() {
    setEditSelectedStudentIds([]);
  }

  async function handleRenameClass(e) {
    e.preventDefault();
    if (!editClassId || !editClassName.trim()) return;
    await updateDoc(doc(db, "classes", editClassId), { name: editClassName.trim() });
    await fetchClasses();
    alert("✅ Class renamed");
  }

  async function handleRemoveSelectedFromClass() {
    if (!editClassId || editSelectedStudentIds.length === 0) return alert("Select students to remove");
    const batch = writeBatch(db);
    editSelectedStudentIds.forEach((id) => {
      batch.update(doc(db, "students", id), { classIds: arrayRemove(editClassId) });
    });
    await batch.commit();
    await fetchStudents();
    alert("✅ Removed selected students from class");
  }

  async function handleMoveSelectedToClass() {
    if (!editClassId || editSelectedStudentIds.length === 0) return alert("Select students to move");
    if (!moveTargetClassId) return alert("Select a target class");
    if (moveTargetClassId === editClassId) return alert("Target class is same as current class");
    const batch = writeBatch(db);
    editSelectedStudentIds.forEach((id) => {
      const ref = doc(db, "students", id);
      batch.update(ref, { classIds: arrayRemove(editClassId) });
      batch.update(ref, { classIds: arrayUnion(moveTargetClassId) });
    });
    await batch.commit();
    await fetchStudents();
    alert("✅ Moved selected students to target class");
  }

  async function handleDeleteClass() {
    if (!editClassId) return;
    const classStudents = students.filter((s) => Array.isArray(s.classIds) ? s.classIds.includes(editClassId) : s.classId === editClassId);
    const confirmed = confirm(
      classStudents.length > 0
        ? `This class has ${classStudents.length} student(s).\n\nDeleting will remove this class from those students.\n\nDo you want to continue?`
        : "Delete this class?"
    );
    if (!confirmed) return;

    // Remove class from all students first
    if (classStudents.length > 0) {
      const batch = writeBatch(db);
      classStudents.forEach((s) => {
        batch.update(doc(db, "students", s.id), { classIds: arrayRemove(editClassId) });
      });
      await batch.commit();
      await fetchStudents();
    }

    // Delete the class doc
    await deleteDoc(doc(db, "classes", editClassId));
    await fetchClasses();
    setShowEditClassModal(false);
    alert("🗑️ Class deleted successfully");
  }

  async function fetchChapters(courseId) {
    if (!courseId) {
      setChapters([]);
      return;
    }
    const snap = await getDocs(collection(db, "courses", courseId, "chapters"));
    const chaptersData = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    
    // Sort chapters by order field (if exists) or by creation timestamp
    const sortedChapters = chaptersData.sort((a, b) => {
      // If both have order, sort by order
      if (a.order !== undefined && b.order !== undefined) {
        return a.order - b.order;
      }
      // If only one has order, prioritize the one with order
      if (a.order !== undefined) return -1;
      if (b.order !== undefined) return 1;
      // If neither has order, maintain original order
      return 0;
    });
    
    setChapters(sortedChapters);
  }

  // 🔎 Helpers for filtering and selection
  const filteredStudents = students.filter((s) => {
    const emailMatch = !searchEmail.trim() || (s.email || "").toLowerCase().includes(searchEmail.trim().toLowerCase());
    return emailMatch;
  });

  function toggleSelectOne(studentId) {
    setSelectedStudentIds((prev) =>
      prev.includes(studentId)
        ? prev.filter((id) => id !== studentId)
        : [...prev, studentId]
    );
  }

  function handleSelectAllStudents() {
    setSelectedStudentIds(students.map((s) => s.id));
  }

  function handleSelectAllFiltered() {
    setSelectedStudentIds(filteredStudents.map((s) => s.id));
  }

  function handleClearSelection() {
    setSelectedStudentIds([]);
  }

  // 🔹 Assign Student(s) to Class
  async function handleAssignStudentToClass(e) {
    e.preventDefault();
    if (!assignClass) return alert("Select a class first.");
    if (!selectedStudentIds.length)
      return alert("Select at least one student.");

    const batch = writeBatch(db);
    selectedStudentIds.forEach((id) => {
      const ref = doc(db, "students", id);
      // Support both legacy classId and new classIds
      batch.update(ref, { classIds: arrayUnion(assignClass) });
    });

    await batch.commit();

    alert(`✅ Added ${selectedStudentIds.length} student(s) to class!`);
    fetchStudents();
    setSelectedStudentIds([]);
  }

  // 🔹 Assign Course & Chapters to Class
  async function handleAssignCourseToClass(e) {
    e.preventDefault();
    if (!selectedClass) return alert("Select a class first.");
    if (!selectedCourse) return alert("Select a course first.");

    // Get all students in the selected class
    const classStudents = students.filter((s) => Array.isArray(s.classIds) ? s.classIds.includes(selectedClass) : s.classId === selectedClass);
    if (classStudents.length === 0) {
      alert("No students found in this class.");
      return;
    }

    // Update all students in the class with course access
    const batch = writeBatch(db);
    const selectedCourseTitle = courses.find(c => c.id === selectedCourse)?.title || selectedCourse;
    
    classStudents.forEach((student) => {
      const studentRef = doc(db, "students", student.id);
      const updatedAccess = {
        ...(student.chapterAccess || {}),
        [selectedCourse]: selectedChapters,
      };
      
      // Update coursesTitle array - add course title if not already present
      const currentCoursesTitle = student.coursesTitle || [];
      const updatedCoursesTitle = currentCoursesTitle.includes(selectedCourseTitle) 
        ? currentCoursesTitle 
        : [...currentCoursesTitle, selectedCourseTitle];
      
      batch.update(studentRef, { 
        chapterAccess: updatedAccess,
        coursesTitle: updatedCoursesTitle
      });
    });

    await batch.commit();

    alert(`✅ Course & chapters assigned to ${classStudents.length} students in class!`);
    fetchStudents();
  }


  return (
    <CheckAdminAuth>
      <div className="p-8 bg-gray-100 min-h-screen">
        {/* Back Button */}
        <button
          onClick={() => router.back()}
          className="mb-4 bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded"
        >
          ⬅ Back
        </button>

        <h1 className="text-3xl font-bold mb-6">User Manager</h1>

        <div className="bg-white p-6 rounded shadow mb-8">
        <h2 className="text-xl font-semibold mb-4">Add Class</h2>
        <form onSubmit={handleAddClass} className="flex gap-4">
          <input
            className="border p-2 rounded flex-1"
            placeholder="Class Name"
            value={newClass.name}
            onChange={(e) => setNewClass({ name: e.target.value })}
          />
          <button
            type="submit"
            className="bg-blue-500 text-white px-4 py-2 rounded"
          >
            Add
          </button>
        </form>
      </div>

        {/* Admission - Better UX */}
        <div className="bg-white p-6 rounded shadow mb-8 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Admissions</h2>
            <p className="text-sm text-gray-500">Create a new student admission using the guided form.</p>
          </div>
          <button
            onClick={() => setShowAdmissionModal(true)}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded"
          >
            + Create New Admission
          </button>
        </div>

        {/* All Classes - Expandable with Student Lists */}
        <div className="bg-white p-6 rounded shadow mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">All Classes</h2>
            <div className="flex gap-2 items-center">
              <button
                className="text-sm bg-gray-200 hover:bg-gray-300 px-3 py-1 rounded"
                onClick={() => {
                  const allExpanded = {};
                  classes.forEach((c) => { allExpanded[c.id] = true; });
                  setExpandedClasses(allExpanded);
                }}
              >
                Expand All
              </button>
              <button
                className="text-sm bg-gray-200 hover:bg-gray-300 px-3 py-1 rounded"
                onClick={() => setExpandedClasses({})}
              >
                Collapse All
              </button>
              <span className="text-sm text-gray-500">Total: {classes.length}</span>
            </div>
          </div>
          {classes.length === 0 ? (
            <p className="text-gray-500">No classes yet. Add your first class above.</p>
          ) : (
            <div className="divide-y">
              {classes.map((c) => {
                const classStudents = students.filter((s) => Array.isArray(s.classIds) ? s.classIds.includes(c.id) : s.classId === c.id);
                const isOpen = !!expandedClasses[c.id];
                return (
                  <div key={c.id} className="py-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <button
                          className="w-8 h-8 flex items-center justify-center rounded bg-gray-100 hover:bg-gray-200"
                          onClick={() => setExpandedClasses((prev) => ({ ...prev, [c.id]: !prev[c.id] }))}
                          aria-label={isOpen ? 'Collapse' : 'Expand'}
                        >
                          {isOpen ? '−' : '+'}
                        </button>
                        <h3 className="font-semibold text-gray-800">{c.name}</h3>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-700">
                          {classStudents.length} student{classStudents.length === 1 ? '' : 's'}
                        </span>
                        <button
                          onClick={() => openEditClass(c)}
                          className="text-sm bg-gray-600 hover:bg-gray-700 text-white px-3 py-1 rounded"
                        >
                          Edit
                        </button>
                        
                      </div>
                    </div>
                    {isOpen && (
                      <div className="mt-3 bg-gray-50 border rounded">
                        {classStudents.length === 0 ? (
                          <p className="text-sm text-gray-500 p-3">No students in this class yet.</p>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="bg-gray-200">
                                  <th className="p-2 text-left">Name</th>
                                  <th className="p-2 text-left">Email</th>
                                  <th className="p-2 text-left">Courses</th>
                                </tr>
                              </thead>
                              <tbody>
                                {classStudents.map((s) => (
                                  <tr key={s.id} className="border-t">
                                    <td className="p-2">{s.name || '-'}</td>
                                    <td className="p-2">{s.email || '-'}</td>
                                    <td className="p-2">
                                      {Array.isArray(s.coursesTitle)
                                        ? s.coursesTitle.join(', ')
                                        : s.coursesTitle || '-'}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 🔹 Assign Student(s) to Class */}
        <div className="bg-white p-6 rounded shadow mb-8">
          <h2 className="text-xl font-semibold mb-4">Assign Student(s) to Class</h2>
          <form onSubmit={handleAssignStudentToClass} className="space-y-4">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Search by Email"
                value={searchEmail}
                onChange={(e) => setSearchEmail(e.target.value)}
                className="border p-2 rounded flex-1"
              />
            </div>

            {/* Students Multi-select */}
            <div className="border rounded p-3 max-h-64 overflow-auto">
              <div className="flex items-center gap-2 mb-2">
                <button
                  type="button"
                  onClick={handleSelectAllStudents}
                  className="bg-gray-200 px-3 py-1 rounded"
                >
                  Select All Students
                </button>
                <button
                  type="button"
                  onClick={handleSelectAllFiltered}
                  className="bg-gray-200 px-3 py-1 rounded"
                >
                  Select All (Filtered)
                </button>
                <button
                  type="button"
                  onClick={handleClearSelection}
                  className="bg-gray-200 px-3 py-1 rounded"
                >
                  Clear
                </button>
                <span className="text-sm text-gray-600">
                  Selected: {selectedStudentIds.length} / {students.length}
                </span>
              </div>
              {filteredStudents.length === 0 ? (
                <p className="text-sm text-gray-500">No students match your search.</p>
              ) : (
                <ul className="space-y-1">
                  {filteredStudents.map((s) => (
                    <li key={s.id} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selectedStudentIds.includes(s.id)}
                        onChange={() => toggleSelectOne(s.id)}
                      />
                      <span className="text-sm">
                        {s.name} — {s.email || "No email"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Select Class for Student */}
            <select
              value={assignClass}
              onChange={(e) => setAssignClass(e.target.value)}
              className="border p-2 rounded w-full"
            >
              <option value="">Select Class</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            <button
              type="submit"
              className="bg-blue-500 text-white px-4 py-2 rounded"
            >
              Assign Selected
            </button>
          </form>
        </div>

        {/* 🔹 Assign Course & Chapters to Class */}
        <div className="bg-white p-6 rounded shadow mb-8">
          <h2 className="text-xl font-semibold mb-4">Assign Course Access to Entire Class</h2>
          <form onSubmit={handleAssignCourseToClass} className="space-y-4">
            {/* Select Class */}
            <select
              value={selectedClass}
              onChange={(e) => {
                setSelectedClass(e.target.value);
                setSelectedCourse("");
                setSelectedChapters([]);
              }}
              className="border p-2 rounded w-full"
            >
              <option value="">Select Class</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            {/* Select Course */}
            <select
              value={selectedCourse}
              onChange={(e) => {
                const courseId = e.target.value;
                setSelectedCourse(courseId);
                fetchChapters(courseId);
                // Prefill selectedChapters based on previous assignments for this class
                const classStudents = students.filter((s) => s.classId === selectedClass);
                const studentWithAccess = classStudents.find((s) => Array.isArray(s?.chapterAccess?.[courseId]) && s.chapterAccess[courseId].length > 0);
                if (studentWithAccess) {
                  setSelectedChapters(studentWithAccess.chapterAccess[courseId]);
                } else {
                  setSelectedChapters([]);
                }
              }}
              className="border p-2 rounded w-full"
            >
              <option value="">Select Course</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.title}
                </option>
              ))}
            </select>

            {/* Select Chapters */}
            {selectedCourse && chapters.length > 0 && (
              <div className="space-y-2 border p-3 rounded">
                <p className="font-semibold">Select Chapters</p>
                {chapters.map((chapter) => (
                  <label key={chapter.id} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={selectedChapters.includes(chapter.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedChapters([...selectedChapters, chapter.id]);
                        } else {
                          setSelectedChapters(
                            selectedChapters.filter((id) => id !== chapter.id)
                          );
                        }
                      }}
                    />
                    <span>{chapter.title}</span>
                  </label>
                ))}
              </div>
            )}

            <button
              type="submit"
              className="bg-blue-500 text-white px-4 py-2 rounded"
            >
              Assign Course
            </button>
          </form>
        </div>

        {/* Students List */}
        <div className="bg-white p-6 rounded shadow">
          <h2 className="text-xl font-semibold mb-4">Students</h2>
          {students.length === 0 ? (
            <p className="text-gray-500">No students yet.</p>
          ) : (
            <table className="w-full border">
              <thead>
                <tr className="bg-gray-200">
                  <th className="border p-2">Name</th>
                  <th className="border p-2">Email</th>
                  <th className="border p-2">Class</th>
                  
                </tr>
              </thead>
              <tbody>
                {students.map((s) => (
                  <tr key={s.id}>
                    <td className="border p-2">{s.name}</td>
                    <td className="border p-2">{s.email}</td>
                    <td className="border p-2">
                      {Array.isArray(s.classIds) && s.classIds.length > 0
                        ? s.classIds
                            .map((cid) => classes.find((c) => c.id === cid)?.name)
                            .filter(Boolean)
                            .join(', ')
                        : (classes.find((c) => c.id === s.classId)?.name || "N/A")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Admission Modal */}
      {showAdmissionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-0 md:p-4">
          <div className="bg-white w-full h-full max-h-screen overflow-y-auto md:h-auto md:max-h-[90vh] md:rounded-lg md:max-w-4xl shadow-lg">
            <div className="flex items-center justify-between px-5 py-3 border-b sticky top-0 bg-white z-10">
              <h3 className="text-lg font-semibold">New Admission</h3>
              <button
                onClick={() => setShowAdmissionModal(false)}
                className="text-gray-600 hover:text-gray-800"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div className="p-5">
              <AdmissionForm
                onStudentAdded={() => {
                  fetchStudents();
                  setShowAdmissionModal(false);
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Edit Class Modal */}
      {showEditClassModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-3xl">
            <div className="flex items-center justify-between px-5 py-3 border-b">
              <h3 className="text-lg font-semibold">Edit Class</h3>
              <button
                onClick={() => setShowEditClassModal(false)}
                className="text-gray-600 hover:text-gray-800"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div className="p-5 space-y-5">
              <form onSubmit={handleRenameClass} className="flex items-center gap-3">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Class Name</label>
                  <input
                    className="border p-2 rounded w-full"
                    value={editClassName}
                    onChange={(e) => setEditClassName(e.target.value)}
                    placeholder="Enter class name"
                  />
                </div>
                <button type="submit" className="h-10 mt-6 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded">Rename</button>
                <button type="button" onClick={handleDeleteClass} className="h-10 mt-6 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded">Delete Class</button>
              </form>

              <div className="border rounded p-3">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold">Students in this class</h4>
                  <div className="flex gap-2">
                    <button onClick={editSelectAllInClass} className="text-sm bg-gray-200 px-3 py-1 rounded">Select All</button>
                    <button onClick={editClearSelection} className="text-sm bg-gray-200 px-3 py-1 rounded">Clear</button>
                  </div>
                </div>
                <div className="max-h-60 overflow-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="p-2 text-left">Select</th>
                        <th className="p-2 text-left">Name</th>
                        <th className="p-2 text-left">Email</th>
                      </tr>
                    </thead>
                    <tbody>
                      {students.filter((s) => Array.isArray(s.classIds) ? s.classIds.includes(editClassId) : s.classId === editClassId).map((s) => (
                        <tr key={s.id} className="border-t">
                          <td className="p-2">
                            <input
                              type="checkbox"
                              checked={editSelectedStudentIds.includes(s.id)}
                              onChange={() => toggleEditSelectOne(s.id)}
                            />
                          </td>
                          <td className="p-2">{s.name || '-'}</td>
                          <td className="p-2">{s.email || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button onClick={handleRemoveSelectedFromClass} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded">Remove from Class</button>
                <div className="flex items-center gap-2">
                  <select
                    value={moveTargetClassId}
                    onChange={(e) => setMoveTargetClassId(e.target.value)}
                    className="border p-2 rounded"
                  >
                    <option value="">Move to class...</option>
                    {classes.filter((c) => c.id !== editClassId).map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  <button onClick={handleMoveSelectedToClass} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded">Move Selected</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </CheckAdminAuth>
  );
}
