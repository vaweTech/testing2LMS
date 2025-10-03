"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { db } from "../../../lib/firebase";
import { collection, getDocs } from "firebase/firestore";
import CheckAdminAuth from "../../../lib/CheckAdminAuth";

export default function AdminAssignmentsPage() {
  const router = useRouter();
  const [courses, setCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCourses();
  }, []);

  const fetchCourses = async () => {
    try {
      const coursesSnap = await getDocs(collection(db, "courses"));
      const coursesData = [];
      
      for (const courseDoc of coursesSnap.docs) {
        const courseData = { id: courseDoc.id, ...courseDoc.data() };
        
        // Fetch assignments for each course
        const assignmentsSnap = await getDocs(collection(db, "courses", courseDoc.id, "assignments"));
        courseData.assignments = assignmentsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        coursesData.push(courseData);
      }
      
      setCourses(coursesData);
    } catch (error) {
      console.error("Error fetching courses:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSubmissions = async (courseId, assignmentId) => {
    try {
      const submissionsSnap = await getDocs(
        collection(db, "courses", courseId, "assignments", assignmentId, "submissions")
      );
      
      const submissionsData = submissionsSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        submittedAt: doc.data().submittedAt?.toDate?.() || new Date()
      }));
      
      // Sort by submission date (newest first)
      submissionsData.sort((a, b) => b.submittedAt - a.submittedAt);
      
      setSubmissions(submissionsData);
    } catch (error) {
      console.error("Error fetching submissions:", error);
    }
  };

  const handleAssignmentSelect = async (course, assignment) => {
    setSelectedCourse(course);
    setSelectedAssignment(assignment);
    await fetchSubmissions(course.id, assignment.id);
  };

  // Grading UI and handlers removed per requirements

  const calculateMCQScore = (submission, assignment) => {
    if (assignment.type !== 'mcq' || !submission.mcqAnswers) return null;
    
    let correctAnswers = 0;
    let totalQuestions = assignment.questions?.length || 0;
    
    assignment.questions?.forEach((question, index) => {
      if (submission.mcqAnswers[index] === question.correctAnswer) {
        correctAnswers++;
      }
    });
    
    return totalQuestions > 0 ? (correctAnswers / totalQuestions) * 100 : 0;
  };

  if (loading) return <div className="p-8">Loading...</div>;

  return (
    <CheckAdminAuth>
      <div className="min-h-screen bg-gray-50 p-6">
      <button
          onClick={() => router.back()}
          className={`mb-4 px-4 py-2 rounded bg-gray-500 hover:bg-gray-600 text-white`}
        >
          ⬅ Back
        </button>
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-800 mb-8">Assignment Submissions</h1>

          {/* Course and Assignment Selection */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Course Selection */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Select Course</h2>
              <select
                id="courseSelect"
                name="courseSelect"
                value={selectedCourse?.id || ""}
                onChange={(e) => {
                  const course = courses.find(c => c.id === e.target.value);
                  setSelectedCourse(course);
                  setSelectedAssignment(null);
                  setSubmissions([]);
                }}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-cyan-500 focus:border-cyan-500"
              >
                <option value="">Choose a course...</option>
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.title}
                  </option>
                ))}
              </select>
            </div>

            {/* Assignment Selection */}
            {selectedCourse && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold mb-4">Select Assignment</h2>
                <select
                  id="assignmentSelect"
                  name="assignmentSelect"
                  value={selectedAssignment?.id || ""}
                  onChange={(e) => {
                    const assignment = selectedCourse.assignments.find(a => a.id === e.target.value);
                    handleAssignmentSelect(selectedCourse, assignment);
                  }}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-cyan-500 focus:border-cyan-500"
                >
                  <option value="">Choose an assignment...</option>
                  {selectedCourse.assignments.map((assignment) => (
                    <option key={assignment.id} value={assignment.id}>
                      {assignment.title} ({assignment.type.toUpperCase()})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Submissions List */}
          {selectedAssignment && (
            <div className="bg-white rounded-lg shadow">
              <div className="p-6 border-b">
                <h2 className="text-2xl font-semibold text-gray-800">
                  Submissions for: {selectedAssignment.title}
                </h2>
                <p className="text-gray-600 mt-2">
                  Course: {selectedCourse.title} | Type: {selectedAssignment.type.toUpperCase()}
                </p>
              </div>

              {submissions.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  No submissions yet for this assignment.
                </div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {submissions.map((submission) => {
                    const mcqScore = selectedAssignment.type === 'mcq'
                      ? calculateMCQScore(submission, selectedAssignment)
                      : null;
                    const codingScore = selectedAssignment.type === 'coding'
                      ? (typeof submission.autoScore === 'number' ? submission.autoScore : (submission.testSummary && submission.testSummary.totalCount ? Math.round((submission.testSummary.passCount / submission.testSummary.totalCount) * 100) : null))
                      : null;
                    const displayAutoScore = selectedAssignment.type === 'mcq'
                      ? (mcqScore !== null && mcqScore !== undefined ? `${mcqScore.toFixed(1)}%` : 'N/A')
                      : (codingScore !== null && codingScore !== undefined ? `${codingScore}%` : 'N/A');
                    return (
                      <div key={submission.id} className="p-6">
                        <div className="flex justify-between items-center">
                          <div>
                            <h3 className="text-lg font-medium text-gray-800">
                              {submission.studentName}
                            </h3>
                            <p className="text-sm text-gray-600">
                              Submitted: {submission.submittedAt.toLocaleString()}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-gray-500">Auto Score</p>
                            <p className="text-xl font-semibold text-gray-800">{displayAutoScore}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </CheckAdminAuth>
  );
}
