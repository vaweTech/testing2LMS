"use client";
import { useEffect, useState } from "react";
import { db } from "../../../lib/firebase";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc
} from "firebase/firestore";
import { useRouter } from "next/navigation";
import CheckAdminAuth from "@/lib/CheckAdminAuth";

export default function AdminPage() {
    const router = useRouter();
  const [courses, setCourses] = useState([]);
  const [newCourse, setNewCourse] = useState({ title: "", description: "", syllabus: "", courseCode: "" });
  const [newChapter, setNewChapter] = useState({ id: null, title: "", topics: "", video: "", liveClassLink: "", recordedClassLink: "", pdfDocument: "", classDocs: "", order: 0 });
  const [newAssignment, setNewAssignment] = useState({ 
    id: null, 
    title: "", 
    dueDate: "", 
    day: 1, // Day number for chapter association
    type: "mcq", // "mcq" or "coding"
    questions: []
  });
  const [currentQuestion, setCurrentQuestion] = useState({
    question: "",
    options: ["", "", "", ""],
    correctAnswer: 0,
    explanation: ""
  });
  const [codingQuestion, setCodingQuestion] = useState({
    question: "",
    description: "",
    testCases: [],
    language: "javascript"
  });
  const [selectedCourseId, setSelectedCourseId] = useState(null);
  const [editingChapterId, setEditingChapterId] = useState(null);
  const [practiceQuestions, setPracticeQuestions] = useState([]);
  const [showQuestionBank, setShowQuestionBank] = useState(false);
  const [selectedQuestions, setSelectedQuestions] = useState([]);
  const [selectedDifficulty, setSelectedDifficulty] = useState("all");
  const [selectedMCQCategory, setSelectedMCQCategory] = useState("all");

  // Fetch courses with chapters + assignments
  async function fetchCourses() {
    const snap = await getDocs(collection(db, "courses"));
    const courseList = [];

    for (const courseDoc of snap.docs) {
      const courseData = { id: courseDoc.id, ...courseDoc.data(), chapters: [], assignments: [] };

      const chapterSnap = await getDocs(collection(db, "courses", courseDoc.id, "chapters"));
      courseData.chapters = chapterSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

      const assignmentSnap = await getDocs(collection(db, "courses", courseDoc.id, "assignments"));
      courseData.assignments = assignmentSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

      courseList.push(courseData);
    }

    setCourses(courseList);
  }

  useEffect(() => {
    fetchCourses();
  }, []);

  // Add or Update Course
  async function handleAddOrUpdateCourse(e) {
    e.preventDefault();
    const syllabusArray = typeof newCourse.syllabus === "string"
  ? newCourse.syllabus.split(",")
  : [];

    if (newCourse.id) {
      await updateDoc(doc(db, "courses", newCourse.id), {
        title: newCourse.title,
        description: newCourse.description,
        courseCode: newCourse.courseCode,
        syllabus: syllabusArray
      });
    } else {
      await addDoc(collection(db, "courses"), {
        title: newCourse.title,
        description: newCourse.description,
        courseCode: newCourse.courseCode,
        syllabus: syllabusArray,
        createdAt: new Date().toISOString()
      });
    }
    setNewCourse({ title: "", description: "", syllabus: "", courseCode: "" });
    fetchCourses();
  }

  async function handleDeleteCourse(id) {
    if (confirm("Are you sure you want to delete this course?")) {
      await deleteDoc(doc(db, "courses", id));
      fetchCourses();
    }
  }

  // Add or Update Chapter
  async function handleAddOrUpdateChapter(courseId, e) {
    e.preventDefault();
    
    // Calculate order for new chapters
    let chapterOrder = newChapter.order;
    if (!newChapter.id) {
      // For new chapters, get the highest order and add 1, or use timestamp if no order specified
      if (chapterOrder === 0) {
        const course = courses.find(c => c.id === courseId);
        if (course && course.chapters.length > 0) {
          const maxOrder = Math.max(...course.chapters.map(ch => ch.order || 0));
          chapterOrder = maxOrder + 1;
        } else {
          chapterOrder = 1;
        }
      }
    }
    
    if (newChapter.id) {
      await updateDoc(doc(db, "courses", courseId, "chapters", newChapter.id), {
        title: newChapter.title,
        topics: newChapter.topics,
        video: newChapter.video,
        liveClassLink: newChapter.liveClassLink,
        recordedClassLink: newChapter.recordedClassLink,
        pdfDocument: newChapter.pdfDocument,
        classDocs: newChapter.classDocs,
        order: chapterOrder
      });
    } else {
      await addDoc(collection(db, "courses", courseId, "chapters"), {
        title: newChapter.title,
        topics: newChapter.topics,
        video: newChapter.video,
        liveClassLink: newChapter.liveClassLink,
        recordedClassLink: newChapter.recordedClassLink,
        pdfDocument: newChapter.pdfDocument,
        classDocs: newChapter.classDocs,
        order: chapterOrder,
        createdAt: new Date().toISOString()
      });
    }
    clearChapterForm();
    fetchCourses();
  }

  async function handleDeleteChapter(courseId, chapterId) {
    if (confirm("Delete this chapter?")) {
      await deleteDoc(doc(db, "courses", courseId, "chapters", chapterId));
      fetchCourses();
    }
  }

  // Clear chapter form
  function clearChapterForm() {
    setNewChapter({ 
      id: null, 
      title: "", 
      topics: "", 
      video: "", 
      liveClassLink: "", 
      recordedClassLink: "", 
      pdfDocument: "", 
      classDocs: "",
      order: 0
    });
    setEditingChapterId(null);
  }

  // Add or Update Assignment
  async function handleAddOrUpdateAssignment(courseId, e) {
    e.preventDefault();

    // Basic validation
    const safeTitle = (newAssignment.title || "").trim();
    const safeDue = newAssignment.dueDate || "";
    const safeDay = parseInt(newAssignment.day) || 1;
    const safeType = newAssignment.type || "mcq";

    // Sanitize questions array to remove undefined values
    const safeQuestions = Array.isArray(newAssignment.questions)
      ? newAssignment.questions.map((q) => {
          const base = {
            type: q?.type || safeType,
          };
          if ((q?.type || safeType) === "mcq") {
            return {
              ...base,
              question: (q?.question || "").trim(),
              options: Array.isArray(q?.options)
                ? q.options.map((opt) => (opt || ""))
                : ["", "", "", ""],
              correctAnswer: typeof q?.correctAnswer === "number" ? q.correctAnswer : 0,
              explanation: q?.explanation || "",
            };
          } else {
            return {
              ...base,
              question: (q?.question || "").trim(),
              description: (q?.description || "").trim(),
              language: q?.language || "javascript",
              testCases: Array.isArray(q?.testCases) ? q.testCases : [],
            };
          }
        })
      : [];

    const payload = {
      title: safeTitle,
      dueDate: safeDue,
      day: safeDay,
      type: safeType,
      questions: safeQuestions,
    };

    try {
      if (newAssignment.id) {
        await updateDoc(doc(db, "courses", courseId, "assignments", newAssignment.id), payload);
      } else {
        await addDoc(collection(db, "courses", courseId, "assignments"), payload);
      }
      setNewAssignment({ id: null, title: "", dueDate: "", day: 1, type: "mcq", questions: [] });
      fetchCourses();
    } catch (err) {
      console.error("Error saving assignment:", err);
      alert("Failed to save assignment. Please verify fields and try again.");
    }
  }

  async function handleDeleteAssignment(courseId, assignmentId) {
    if (confirm("Delete this assignment?")) {
      await deleteDoc(doc(db, "courses", courseId, "assignments", assignmentId));
      fetchCourses();
    }
  }

  // Add MCQ Question
  function addMCQQuestion() {
    if (currentQuestion.question.trim() && currentQuestion.options.some(opt => opt.trim())) {
      setNewAssignment({
        ...newAssignment,
        questions: [...newAssignment.questions, { ...currentQuestion, type: "mcq" }]
      });
      setCurrentQuestion({
        question: "",
        options: ["", "", "", ""],
        correctAnswer: 0,
        explanation: ""
      });
    }
  }

  // Add Coding Question
  function addCodingQuestion() {
    if (codingQuestion.question.trim() && codingQuestion.description.trim()) {
      setNewAssignment({
        ...newAssignment,
        questions: [...newAssignment.questions, { ...codingQuestion, type: "coding" }]
      });
      setCodingQuestion({
        question: "",
        description: "",
        testCases: [],
        language: "javascript"
      });
    }
  }

  // Remove Question
  function removeQuestion(index) {
    const updatedQuestions = newAssignment.questions.filter((_, i) => i !== index);
    setNewAssignment({ ...newAssignment, questions: updatedQuestions });
  }

  // Update MCQ option
  function updateMCQOption(index, value) {
    const updatedOptions = [...currentQuestion.options];
    updatedOptions[index] = value;
    setCurrentQuestion({ ...currentQuestion, options: updatedOptions });
  }

  // Fetch practice questions from mcqs collection
  async function fetchPracticeQuestions() {
    const snap = await getDocs(collection(db, "mcqs"));
    const questions = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    setPracticeQuestions(questions);
    setSelectedDifficulty("all");
    setSelectedMCQCategory("all");
    setShowQuestionBank(true);
  }

  // Fetch coding questions from practice bank
  async function fetchCodingQuestions() {
    try {
      const snap = await getDocs(collection(db, "questions"));
      const questions = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setPracticeQuestions(questions);
      setSelectedDifficulty("all");
      setSelectedMCQCategory("all");
      setShowQuestionBank(true);
    } catch (error) {
      console.error("Error fetching coding questions:", error);
      setPracticeQuestions([]);
      setShowQuestionBank(true);
    }
  }

  // Add selected practice questions to assignment
  function addSelectedPracticeQuestions() {
    const questionsToAdd = selectedQuestions.map(qId => {
      const question = practiceQuestions.find(q => q.id === qId);
      
      if (newAssignment.type === "mcq") {
        // Handle both string and object options
        const processedOptions = question.options.map(opt => 
          typeof opt === 'object' ? opt.text : opt
        );
        
        return {
          question: (question.title || question.question || ""),
          options: processedOptions,
          correctAnswer: processedOptions.indexOf(question.answer),
          explanation: "",
          type: "mcq"
        };
      } else {
        return {
          question: (question.title || question.question || ""),
          description: question.description,
          language: question.language || "javascript",
          testCases: Array.isArray(question.testCases) ? question.testCases : [],
          type: "coding"
        };
      }
    });

    setNewAssignment({
      ...newAssignment,
      questions: [...newAssignment.questions, ...questionsToAdd]
    });
    setSelectedQuestions([]);
    setSelectedDifficulty("all");
    setSelectedMCQCategory("all");
    setShowQuestionBank(false);
  }

  // Toggle question selection
  function toggleQuestionSelection(questionId) {
    setSelectedQuestions(prev => 
      prev.includes(questionId) 
        ? prev.filter(id => id !== questionId)
        : [...prev, questionId]
    );
  }

  // Move chapter up in order
  async function moveChapterUp(courseId, chapterId) {
    const course = courses.find(c => c.id === courseId);
    if (!course) return;
    
    const chapters = course.chapters.sort((a, b) => (a.order || 0) - (b.order || 0));
    const currentIndex = chapters.findIndex(ch => ch.id === chapterId);
    
    if (currentIndex > 0) {
      const currentChapter = chapters[currentIndex];
      const previousChapter = chapters[currentIndex - 1];
      
      // Swap orders
      await updateDoc(doc(db, "courses", courseId, "chapters", currentChapter.id), {
        order: previousChapter.order || 0
      });
      await updateDoc(doc(db, "courses", courseId, "chapters", previousChapter.id), {
        order: currentChapter.order || 0
      });
      
      fetchCourses();
    }
  }

  // Move chapter down in order
  async function moveChapterDown(courseId, chapterId) {
    const course = courses.find(c => c.id === courseId);
    if (!course) return;
    
    const chapters = course.chapters.sort((a, b) => (a.order || 0) - (b.order || 0));
    const currentIndex = chapters.findIndex(ch => ch.id === chapterId);
    
    if (currentIndex < chapters.length - 1) {
      const currentChapter = chapters[currentIndex];
      const nextChapter = chapters[currentIndex + 1];
      
      // Swap orders
      await updateDoc(doc(db, "courses", courseId, "chapters", currentChapter.id), {
        order: nextChapter.order || 0
      });
      await updateDoc(doc(db, "courses", courseId, "chapters", nextChapter.id), {
        order: currentChapter.order || 0
      });
      
      fetchCourses();
    }
  }

  // Reorder all chapters sequentially
  async function reorderChapters(courseId) {
    const course = courses.find(c => c.id === courseId);
    if (!course) return;
    
    const chapters = course.chapters.sort((a, b) => (a.order || 0) - (b.order || 0));
    
    // Update each chapter with sequential order
    for (let i = 0; i < chapters.length; i++) {
      await updateDoc(doc(db, "courses", courseId, "chapters", chapters[i].id), {
        order: i + 1
      });
    }
    
    fetchCourses();
  }



  return (
    <CheckAdminAuth>
    <div className="p-8 bg-gray-100 min-h-screen">
      <button
        onClick={() => router.back()}
        className="mb-4 bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded"
      >
        ⬅ Back
      </button>
      <h1 className="text-3xl font-bold mb-6">Admin Dashboard</h1>

      {/* Add / Edit Course */}
      <div className="bg-white p-6 rounded shadow mb-8">
        <h2 className="text-xl font-semibold mb-4">{newCourse.id ? "Edit Course" : "Add New Course"}</h2>
        <form onSubmit={handleAddOrUpdateCourse} className="grid grid-cols-2 gap-4">
          <input className="border p-2 rounded" placeholder="Course Title" value={newCourse.title} onChange={(e) => setNewCourse({ ...newCourse, title: e.target.value })} />
          <input className="border p-2 rounded" placeholder="Course Code (Unique)" value={newCourse.courseCode} onChange={(e) => setNewCourse({ ...newCourse, courseCode: e.target.value })} />
          <textarea className="border p-2 rounded col-span-2" placeholder="Description" value={newCourse.description} onChange={(e) => setNewCourse({ ...newCourse, description: e.target.value })} />
          <textarea className="border p-2 rounded col-span-2" placeholder="Syllabus (comma separated)" value={newCourse.syllabus} onChange={(e) => setNewCourse({ ...newCourse, syllabus: e.target.value })} />
          <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded col-span-2">{newCourse.id ? "Update Course" : "Add Course"}</button>
        </form>
      </div>

      {/* Course List */}
      <div className="bg-white p-6 rounded shadow">
        <h2 className="text-xl font-semibold mb-4">Courses</h2>
        {courses.map((course) => (
          <div key={course.id} className="border rounded p-4 mb-4">
            <div className="flex justify-between">
              <div>
                <h3 className="font-bold text-lg">{course.title}</h3>
                <p className="text-sm">{course.description}</p>
                <p className="text-xs text-gray-500">Code: {course.courseCode}</p>
              </div>
              <div className="flex gap-2">
                <button className="bg-yellow-500 text-white px-3 py-1 rounded" onClick={() => setNewCourse(course)}>Edit</button>
                <button className="bg-red-500 text-white px-3 py-1 rounded" onClick={() => handleDeleteCourse(course.id)}>Delete</button>
                <button className="bg-gray-500 text-white px-3 py-1 rounded" onClick={() => setSelectedCourseId(selectedCourseId === course.id ? null : course.id)}>{selectedCourseId === course.id ? "Hide" : "View"}</button>
              </div>
            </div>

            {/* Expanded Details */}
            {selectedCourseId === course.id && (
              <div className="mt-4">
                {/* Chapters */}
                <div className="flex justify-between items-center">
                  <h4 className="font-semibold">Chapters</h4>
                  {course.chapters.length > 0 && (
                    <button 
                      onClick={() => reorderChapters(course.id)}
                      className="bg-blue-500 text-white px-3 py-1 rounded text-sm"
                      title="Reorder chapters sequentially"
                    >
                      🔄 Reorder
                    </button>
                  )}
                </div>
                {course.chapters
                  .sort((a, b) => (a.order || 0) - (b.order || 0))
                  .map((ch) => (
                  <div key={ch.id} className="border p-3 rounded mb-2">
                    <div className="flex justify-between">
                                              <div>
                          <div className="flex items-center gap-2">
                            <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded font-medium">
                              Order: {ch.order || 0}
                            </span>
                            <p className="font-bold">{ch.title}</p>
                          </div>
                          <p className="text-sm text-gray-600">{ch.topics}</p>
                           <div className="flex flex-wrap gap-2 mt-2">
                            {ch.video && <a href={ch.video} target="_blank" rel="noopener noreferrer" className="text-blue-500 underline text-sm">Video</a>}
                            {ch.liveClassLink && <a href={ch.liveClassLink} target="_blank" rel="noopener noreferrer" className="text-green-500 underline text-sm">Live Class</a>}
                            {ch.recordedClassLink && <a href={ch.recordedClassLink} target="_blank" rel="noopener noreferrer" className="text-purple-500 underline text-sm">Watch Video</a>}
                            {ch.pdfDocument && <span className="text-red-500 text-sm">📄 PDF: {ch.pdfDocument.substring(0, 50)}...</span>}
                            {ch.classDocs && <span className="text-orange-500 text-sm">📊 PPTs: {ch.classDocs.substring(0, 50)}...</span>}
                          </div>
                        </div>
                                             <div className="flex gap-2">
                         <button 
                           className="text-blue-600" 
                           onClick={() => moveChapterUp(course.id, ch.id)}
                           title="Move Up"
                         >
                           ⬆️
                         </button>
                         <button 
                           className="text-blue-600" 
                           onClick={() => moveChapterDown(course.id, ch.id)}
                           title="Move Down"
                         >
                           ⬇️
                         </button>
                         <button className="text-yellow-600" onClick={() => {
                           setNewChapter({
                             ...ch,
                             classDocs: ch.classDocs || "",
                             liveClassLink: ch.liveClassLink || "",
                             recordedClassLink: ch.recordedClassLink || "",
                             pdfDocument: ch.pdfDocument || "",
                             order: ch.order || 0
                           });
                           setEditingChapterId(ch.id);
                         }}>Edit</button>
                         <button className="text-red-600" onClick={() => handleDeleteChapter(course.id, ch.id)}>Delete</button>
                       </div>
                    </div>
                    
                    {/* Inline Edit Form - appears when this chapter is being edited */}
                    {editingChapterId === ch.id && (
                      <div className="mt-4 border-t pt-4 bg-gray-50 p-3 rounded">
                        <h5 className="font-semibold mb-3 text-blue-600">Editing: {ch.title}</h5>
                        <form onSubmit={(e) => handleAddOrUpdateChapter(course.id, e)} className="grid grid-cols-2 gap-2">
                          <input className="border p-2 rounded" placeholder="Chapter Title" value={newChapter.title || ""} onChange={(e) => setNewChapter({ ...newChapter, title: e.target.value })} />
                          <input 
                            type="number" 
                            className="border p-2 rounded" 
                            placeholder="Order (Optional)" 
                            value={newChapter.order || ""} 
                            onChange={(e) => setNewChapter({ ...newChapter, order: parseInt(e.target.value) || 0 })} 
                          />
                          <input className="border p-2 rounded" placeholder="Video URL (Optional)" value={newChapter.video || ""} onChange={(e) => setNewChapter({ ...newChapter, video: e.target.value })} />
                          <input className="border p-2 rounded" placeholder="Live Class Link (Optional)" value={newChapter.liveClassLink || ""} onChange={(e) => setNewChapter({ ...newChapter, liveClassLink: e.target.value })} />
                          <input className="border p-2 rounded" placeholder="Class Live Video Link (Optional)" value={newChapter.recordedClassLink || ""} onChange={(e) => setNewChapter({ ...newChapter, recordedClassLink: e.target.value })} />
                          <input className="border p-2 rounded" placeholder="PPTs (Google Drive Link)" value={newChapter.classDocs || ""} onChange={(e) => setNewChapter({ ...newChapter, classDocs: e.target.value })} />
                         <input className="border p-2 rounded" placeholder="PDF Document (Google Drive Link)" value={newChapter.pdfDocument || ""} onChange={(e) => setNewChapter({ ...newChapter, pdfDocument: e.target.value })} />
                                         <textarea className="border p-2 rounded col-span-2" placeholder="topics" value={newChapter.topics || ""} onChange={(e) => setNewChapter({ ...newChapter, topics: e.target.value })} />
                          <div className="col-span-2 flex gap-2">
                            <button type="submit" className="bg-green-500 text-white px-4 py-2 rounded flex-1">{newChapter.id ? "Update Chapter" : "Add Chapter"}</button>
                            <button type="button" onClick={clearChapterForm} className="bg-gray-500 text-white px-4 py-2 rounded">Cancel</button>
                          </div>
                        </form>
                      </div>
                    )}
                  </div>
                ))}
                {/* Chapter Form - Only show when not editing any chapter */}
                {!editingChapterId && (
                  <form onSubmit={(e) => handleAddOrUpdateChapter(course.id, e)} className="grid grid-cols-2 gap-2 mt-2">
                   <input className="border p-2 rounded" placeholder="Chapter Title" value={newChapter.title || ""} onChange={(e) => setNewChapter({ ...newChapter, title: e.target.value })} />
                   <input 
                     type="number" 
                     className="border p-2 rounded" 
                     placeholder="Order (Optional)" 
                     value={newChapter.order || ""} 
                     onChange={(e) => setNewChapter({ ...newChapter, order: parseInt(e.target.value) || 0 })} 
                   />
                   <input className="border p-2 rounded" placeholder="Video URL (Optional)" value={newChapter.video || ""} onChange={(e) => setNewChapter({ ...newChapter, video: e.target.value })} />
                   <input className="border p-2 rounded" placeholder="Live Class Link (Optional)" value={newChapter.liveClassLink || ""} onChange={(e) => setNewChapter({ ...newChapter, liveClassLink: e.target.value })} />
                   <input className="border p-2 rounded" placeholder="Class Live Video Link (Optional)" value={newChapter.recordedClassLink || ""} onChange={(e) => setNewChapter({ ...newChapter, recordedClassLink: e.target.value })} />
                   <input className="border p-2 rounded" placeholder="PPTs (Google Drive Link)" value={newChapter.classDocs || ""} onChange={(e) => setNewChapter({ ...newChapter, classDocs: e.target.value })} />
                  <input className="border p-2 rounded" placeholder="PDF Document (Google Drive Link)" value={newChapter.pdfDocument || ""} onChange={(e) => setNewChapter({ ...newChapter, pdfDocument: e.target.value })} />
                                     <textarea className="border p-2 rounded col-span-2" placeholder="topics" value={newChapter.topics || ""} onChange={(e) => setNewChapter({ ...newChapter, topics: e.target.value })} />
                   <div className="col-span-2 flex gap-2">
                     <button type="submit" className="bg-green-500 text-white px-4 py-2 rounded flex-1">{newChapter.id ? "Update Chapter" : "Add Chapter"}</button>
                     <button type="button" onClick={clearChapterForm} className="bg-gray-500 text-white px-4 py-2 rounded">Clear Form</button>
                   </div>
                  </form>
                )}

                {/* Assignments */}
                <h4 className="font-semibold mt-4">Assignments</h4>
                                 {course.assignments.map((a) => (
                   <div key={a.id} className="border p-3 rounded mb-2">
                     <div className="flex justify-between">
                       <div>
                         <p className="font-bold">{a.title}</p>
                         <p className="text-sm text-gray-600">Due: {a.dueDate} | Day: {a.day || 1}</p>
                         <p className="text-xs text-gray-500">
                           Type: {a.type === "mcq" ? "MCQ" : "Coding"} | 
                           Questions: {a.questions ? a.questions.length : 0}
                         </p>
                         {a.questions && a.questions.length > 0 && (
                           <div className="mt-2">
                             {a.questions.slice(0, 2).map((q, idx) => (
                               <p key={idx} className="text-xs text-gray-600">
                                 {idx + 1}. {(q.question || "").substring(0, 50)}...
                               </p>
                             ))}
                             {a.questions.length > 2 && (
                               <p className="text-xs text-gray-500">+{a.questions.length - 2} more questions</p>
                             )}
                           </div>
                         )}
                       </div>
                       <div className="flex gap-2">
                         <button className="text-yellow-600" onClick={() => setNewAssignment({
                           ...a,
                           questions: a.questions || []
                         })}>Edit</button>
                         <button className="text-red-600" onClick={() => handleDeleteAssignment(course.id, a.id)}>Delete</button>
                       </div>
                     </div>
                   </div>
                 ))}
                                 {/* Assignment Form */}
                 <div className="border p-4 rounded mt-4">
                   <h5 className="font-semibold mb-3">{newAssignment.id ? "Edit Assignment" : "Add New Assignment"}</h5>
                   
                   <form onSubmit={(e) => handleAddOrUpdateAssignment(course.id, e)} className="space-y-4">
                     <div className="grid grid-cols-3 gap-4">
                       <input 
                         className="border p-2 rounded" 
                         placeholder="Assignment Title" 
                         value={newAssignment.title || ""} 
                         onChange={(e) => setNewAssignment({ ...newAssignment, title: e.target.value })} 
                       />
                       <input 
                         type="date" 
                         className="border p-2 rounded" 
                         value={newAssignment.dueDate || ""} 
                         onChange={(e) => setNewAssignment({ ...newAssignment, dueDate: e.target.value })} 
                       />
                       <input 
                         type="number" 
                         min="1"
                         className="border p-2 rounded" 
                         placeholder="Day Number" 
                         value={newAssignment.day || 1} 
                         onChange={(e) => setNewAssignment({ ...newAssignment, day: parseInt(e.target.value) || 1 })} 
                       />
                     </div>
                     
                     <div className="flex gap-2">
                       <button 
                         type="button"
                         className={`px-3 py-1 rounded ${newAssignment.type === "mcq" ? "bg-blue-500 text-white" : "bg-gray-200"}`}
                         onClick={() => setNewAssignment({ ...newAssignment, type: "mcq" })}
                       >
                         MCQ Questions
                       </button>
                       <button 
                         type="button"
                         className={`px-3 py-1 rounded ${newAssignment.type === "coding" ? "bg-blue-500 text-white" : "bg-gray-200"}`}
                         onClick={() => setNewAssignment({ ...newAssignment, type: "coding" })}
                       >
                         Coding Questions
                       </button>
                     </div>

                                           {/* MCQ Question Form */}
                      {newAssignment.type === "mcq" && (
                        <div className="border p-3 rounded">
                          <div className="flex justify-between items-center mb-2">
                            <h6 className="font-medium">Add MCQ Question</h6>
                            <button 
                              type="button" 
                              onClick={fetchPracticeQuestions}
                              className="bg-blue-500 text-white px-3 py-1 rounded text-sm"
                            >
                              Select from Practice Bank
                            </button>
                          </div>
                          <div className="space-y-2">
                           <textarea 
                             className="border p-2 rounded w-full" 
                             placeholder="Question" 
                             value={currentQuestion.question || ""} 
                             onChange={(e) => setCurrentQuestion({ ...currentQuestion, question: e.target.value })} 
                           />
                           <div className="grid grid-cols-2 gap-2">
                             {currentQuestion.options.map((option, index) => (
                               <div key={index} className="flex items-center gap-2">
                                 <input 
                                   type="radio" 
                                   name="correctAnswer" 
                                   checked={currentQuestion.correctAnswer === index}
                                   onChange={() => setCurrentQuestion({ ...currentQuestion, correctAnswer: index })}
                                 />
                                 <input 
                                   className="border p-1 rounded flex-1" 
                                   placeholder={`Option ${index + 1}`} 
                                   value={option || ""} 
                                   onChange={(e) => updateMCQOption(index, e.target.value)} 
                                 />
                               </div>
                             ))}
                           </div>
                           <textarea 
                             className="border p-2 rounded w-full" 
                             placeholder="Explanation (Optional)" 
                             value={currentQuestion.explanation || ""} 
                             onChange={(e) => setCurrentQuestion({ ...currentQuestion, explanation: e.target.value })} 
                           />
                           <button 
                             type="button" 
                             onClick={addMCQQuestion}
                             className="bg-green-500 text-white px-3 py-1 rounded"
                           >
                             Add MCQ Question
                           </button>
                         </div>
                       </div>
                     )}

                                                                 {/* Coding Question Form */}
                      {newAssignment.type === "coding" && (
                        <div className="border p-3 rounded">
                          <div className="flex justify-between items-center mb-2">
                            <h6 className="font-medium">Add Coding Question</h6>
                            <button 
                              type="button" 
                              onClick={fetchCodingQuestions}
                              className="bg-blue-500 text-white px-3 py-1 rounded text-sm"
                            >
                              Select from Practice Bank
                            </button>
                          </div>
                          <p className="text-sm text-gray-600">Click &quot;Select from Practice Bank&quot; to choose coding questions from the question bank.</p>
                        </div>
                      )}

                     {/* Display Added Questions */}
                     {newAssignment.questions && newAssignment.questions.length > 0 && (
                       <div className="border p-3 rounded">
                         <h6 className="font-medium mb-2">Added Questions ({newAssignment.questions.length})</h6>
                         <div className="space-y-2">
                           {newAssignment.questions.map((q, index) => (
                             <div key={index} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                               <div>
                                 <p className="text-sm font-medium">
                                   {index + 1}. {(q.question || "").substring(0, 50)}...
                                 </p>
                                 <p className="text-xs text-gray-500">Type: {q.type}</p>
                               </div>
                               <button 
                                 type="button" 
                                 onClick={() => removeQuestion(index)}
                                 className="text-red-500 text-sm"
                               >
                                 Remove
                               </button>
                             </div>
                           ))}
                         </div>
                       </div>
                     )}

                     <div className="flex gap-2">
                       <button type="submit" className="bg-purple-500 text-white px-4 py-2 rounded flex-1">
                         {newAssignment.id ? "Update Assignment" : "Add Assignment"}
                       </button>
                       <button 
                         type="button" 
                         onClick={() => setNewAssignment({ id: null, title: "", dueDate: "", type: "mcq", questions: [] })}
                         className="bg-gray-500 text-white px-4 py-2 rounded"
                       >
                         Clear Form
                       </button>
                                           </div>
                    </form>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Question Bank Modal */}
      {showQuestionBank && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-4xl max-h-[80vh] overflow-y-auto">
                         <div className="flex justify-between items-center mb-4">
               <h3 className="text-lg font-semibold">
                 Select {newAssignment.type === "mcq" ? "MCQ" : "Coding"} Questions from Practice Bank
               </h3>
               <button 
                 onClick={() => setShowQuestionBank(false)}
                 className="text-gray-500 hover:text-gray-700"
               >
                 ✕
               </button>
             </div>
             
             {/* Difficulty Filter for Coding Questions */}
             {newAssignment.type === "coding" && (
               <div className="mb-4">
                 <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Difficulty:</label>
                 <div className="flex gap-2">
                   <button
                     type="button"
                     className={`px-3 py-1 rounded text-sm ${
                       selectedDifficulty === "all" ? "bg-blue-500 text-white" : "bg-gray-200"
                     }`}
                     onClick={() => setSelectedDifficulty("all")}
                   >
                     All
                   </button>
                                       <button
                      type="button"
                      className={`px-3 py-1 rounded text-sm ${
                        selectedDifficulty === "Easy" ? "bg-green-500 text-white" : "bg-gray-200"
                      }`}
                      onClick={() => setSelectedDifficulty("Easy")}
                    >
                      Easy
                    </button>
                    <button
                      type="button"
                      className={`px-3 py-1 rounded text-sm ${
                        selectedDifficulty === "Medium" ? "bg-yellow-500 text-white" : "bg-gray-200"
                      }`}
                      onClick={() => setSelectedDifficulty("Medium")}
                    >
                      Medium
                    </button>
                    <button
                      type="button"
                      className={`px-3 py-1 rounded text-sm ${
                        selectedDifficulty === "Hard" ? "bg-red-500 text-white" : "bg-gray-200"
                      }`}
                      onClick={() => setSelectedDifficulty("Hard")}
                    >
                      Hard
                    </button>
                 </div>
               </div>
             )}

             {/* Category Filter for MCQ Questions */}
             {newAssignment.type === "mcq" && (
               <div className="mb-4">
                 <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Category:</label>
                 <div className="flex gap-2">
                   <button
                     type="button"
                     className={`px-3 py-1 rounded text-sm ${
                       selectedMCQCategory === "all" ? "bg-blue-500 text-white" : "bg-gray-200"
                     }`}
                     onClick={() => setSelectedMCQCategory("all")}
                   >
                     All
                   </button>
                   <button
                     type="button"
                     className={`px-3 py-1 rounded text-sm ${
                       selectedMCQCategory === "javascript" ? "bg-green-500 text-white" : "bg-gray-200"
                     }`}
                     onClick={() => setSelectedMCQCategory("javascript")}
                   >
                     JavaScript
                   </button>
                   <button
                     type="button"
                     className={`px-3 py-1 rounded text-sm ${
                       selectedMCQCategory === "react" ? "bg-yellow-500 text-white" : "bg-gray-200"
                     }`}
                     onClick={() => setSelectedMCQCategory("react")}
                   >
                     React
                   </button>
                   <button
                     type="button"
                     className={`px-3 py-1 rounded text-sm ${
                       selectedMCQCategory === "nodejs" ? "bg-purple-500 text-white" : "bg-gray-200"
                     }`}
                     onClick={() => setSelectedMCQCategory("nodejs")}
                   >
                     Node.js
                   </button>
                   <button
                     type="button"
                     className={`px-3 py-1 rounded text-sm ${
                       selectedMCQCategory === "python" ? "bg-orange-500 text-white" : "bg-gray-200"
                     }`}
                     onClick={() => setSelectedMCQCategory("python")}
                   >
                     Python
                   </button>
                   <button
                     type="button"
                     className={`px-3 py-1 rounded text-sm ${
                       selectedMCQCategory === "java" ? "bg-red-500 text-white" : "bg-gray-200"
                     }`}
                     onClick={() => setSelectedMCQCategory("java")}
                   >
                     Java
                   </button>
                 </div>
               </div>
             )}
            
                         <div className="space-y-4">
                               {practiceQuestions
                  .filter(q => {
                    if (newAssignment.type === "coding" && selectedDifficulty !== "all") {
                      return q.category === selectedDifficulty;
                    }
                    if (newAssignment.type === "mcq" && selectedMCQCategory !== "all") {
                      return q.category === selectedMCQCategory;
                    }
                    return true;
                  })
                 .map((q) => (
                 <div 
                   key={q.id} 
                   className={`border p-3 rounded cursor-pointer ${
                     selectedQuestions.includes(q.id) ? 'bg-blue-100 border-blue-300' : 'bg-gray-50'
                   }`}
                   onClick={() => toggleQuestionSelection(q.id)}
                 >
                   <div className="flex items-start gap-3">
                     <input 
                       type="checkbox" 
                       checked={selectedQuestions.includes(q.id)}
                       onChange={() => toggleQuestionSelection(q.id)}
                       className="mt-1"
                     />
                     <div className="flex-1">
                       <p className="font-medium">{q.title || q.question}</p>
                       
                       {/* Show options for MCQ questions */}
                       {q.options && (
                         <div className="mt-2 space-y-1">
                           {q.options.map((opt, idx) => (
                             <p key={idx} className={`text-sm ${
                               (typeof opt === 'object' ? opt.text : opt) === q.answer ? 'text-green-600 font-medium' : 'text-gray-600'
                             }`}>
                               {String.fromCharCode(65 + idx)}. {typeof opt === 'object' ? opt.text : opt}
                             </p>
                           ))}
                         </div>
                       )}
                       
                       {/* Show description for coding questions */}
                       {q.description && (
                         <div className="mt-2">
                           <p className="text-sm text-gray-700">{q.description}</p>
                         </div>
                       )}
                       
                                               <div className="flex gap-2 mt-2">
                          <p className="text-xs text-gray-500">Category: {q.category}</p>
                          {q.language && (
                            <p className="text-xs text-blue-500">Language: {q.language}</p>
                          )}
                                                     {q.category && (
                             <span className={`text-xs px-2 py-1 rounded ${
                               q.category === "Easy" ? "bg-green-100 text-green-800" :
                               q.category === "Medium" ? "bg-yellow-100 text-yellow-800" :
                               "bg-red-100 text-red-800"
                             }`}>
                               {q.category}
                             </span>
                           )}
                        </div>
                     </div>
                   </div>
                 </div>
               ))}
             </div>
            
            <div className="flex justify-end gap-2 mt-4">
              <button 
                onClick={() => setShowQuestionBank(false)}
                className="bg-gray-500 text-white px-4 py-2 rounded"
              >
                Cancel
              </button>
              <button 
                onClick={addSelectedPracticeQuestions}
                disabled={selectedQuestions.length === 0}
                className="bg-blue-500 text-white px-4 py-2 rounded disabled:bg-gray-300"
              >
                Add Selected ({selectedQuestions.length})
              </button>
            </div>
          </div>
        </div>
      )}
    </CheckAdminAuth>
  );
}
