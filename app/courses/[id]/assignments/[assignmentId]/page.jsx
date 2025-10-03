"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, useCallback, useMemo } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../../../../../lib/firebase";
import {
  doc,
  getDoc,
  getDocs,
  addDoc,
  collection,
  updateDoc,
  serverTimestamp,
  query,
  where,
  orderBy,
} from "firebase/firestore";
import CheckAuth from "../../../../../lib/CheckAuth";
import dynamic from "next/dynamic";
import { parseCourseUrl, createSlug } from "../../../../../lib/urlUtils";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

// Stateless helpers
const getDefaultStarter = (language) => {
  if (language === "java") return `public class Main {\n  public static void main(String[] args) {\n    // Write your solution here\n    System.out.println("Hello, World!");\n  }\n}`;
  if (language === "python") return `# Write your solution here\nprint("Hello, World!")`;
  if (language === "c") return `#include <stdio.h>\nint main(){\n  // Write your solution here\n  printf("Hello, World!\\n");\n  return 0;\n}`;
  if (language === "javascript") return `// Write your solution here\nconsole.log("Hello, World!");`;
  return "";
};

const mapLanguage = (lang) => {
  if (lang === "java") return "java";
  if (lang === "python") return "python";
  if (lang === "c") return "c";
  if (lang === "javascript") return "javascript";
  return "plaintext";
};

export default function AssignmentSubmissionPage() {
  const { id: urlSlug, assignmentId } = useParams();
  const router = useRouter();
  
  // Parse the URL to get the course slug
  const { slug } = parseCourseUrl(urlSlug);
  const [assignment, setAssignment] = useState(null);
  const [course, setCourse] = useState(null);
  const [courseId, setCourseId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submission, setSubmission] = useState({
    mcqAnswers: {},
    codingSolution: "",
    language: "javascript"
  });
  const [existingSubmission, setExistingSubmission] = useState(null);
  const [hasAccess, setHasAccess] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [runningHidden, setRunningHidden] = useState(false);
  const [hiddenSummary, setHiddenSummary] = useState(null);
  const [hiddenStats, setHiddenStats] = useState(null); // { passCount, totalCount }

  // Memoized progress computation (replaces repeated inline IIFEs)
  const answeredProgress = useMemo(() => {
    if (!assignment) return { answered: 0, total: 0 };
    if (assignment.type === 'mcq') {
      const totalQuestions = assignment.questions?.length || 0;
      const answeredQuestions = Object.keys(submission.mcqAnswers).length;
      return { answered: answeredQuestions, total: totalQuestions };
    }
    // For coding assignments, count questions that have meaningful code
    const totalQuestions = assignment.questions?.length || 0;
    if (totalQuestions === 0) return { answered: 0, total: 0 };
    
    // Check if the coding solution is meaningful (not empty and not just the starter code)
    const hasMeaningfulCode = Boolean(
      submission.codingSolution &&
      submission.codingSolution.trim() !== '' &&
      submission.codingSolution !== getDefaultStarter(submission.language)
    );
    
    // For coding, if there's meaningful code, consider all questions as potentially answered
    // since coding solutions typically address all problems in the assignment
    return { answered: hasMeaningfulCode ? totalQuestions : 0, total: totalQuestions };
  }, [assignment, submission]);

  const fetchData = useCallback(async (user) => {
    try {
      let foundCourseId = null;

      // Find course by title/slug
      const coursesRef = collection(db, "courses");
      const coursesSnap = await getDocs(coursesRef);
      const allCourses = coursesSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      
      // Find course that matches the URL slug
      const matchingCourse = allCourses.find(course => {
        const courseSlug = createSlug(course.title);
        return courseSlug === slug;
      });

      if (!matchingCourse) {
        router.push(`/courses`);
        return;
      }

      foundCourseId = matchingCourse.id;
      setCourse(matchingCourse);
      setCourseId(matchingCourse.id);

      // Fetch assignment details
      const assignmentRef = doc(db, "courses", foundCourseId, "assignments", assignmentId);
      const assignmentSnap = await getDoc(assignmentRef);
      
      if (!assignmentSnap.exists()) {
        router.push(`/courses/${urlSlug}`);
        return;
      }

      const assignmentData = assignmentSnap.data();
      setAssignment({ id: assignmentSnap.id, ...assignmentData });

      // Check student access to the specific day/chapter
      const directRef = doc(db, "students", user.uid);
      const directSnap = await getDoc(directRef);
      let studentData = null;

      if (directSnap.exists()) {
        studentData = directSnap.data();
      } else {
        const q = query(
          collection(db, "students"),
          where("uid", "==", user.uid)
        );
        const qSnap = await getDocs(q);
        if (!qSnap.empty) {
          studentData = qSnap.docs[0].data();
        }
      }

      // Check if user has access to the chapter corresponding to the assignment day
      if (studentData?.chapterAccess && studentData.chapterAccess[foundCourseId]) {
        const allowedChapters = studentData.chapterAccess[foundCourseId];
        const assignmentDay = assignmentData.day || 1;
        
        // Get chapters to find the chapter ID for this day
        const chaptersRef = collection(db, "courses", foundCourseId, "chapters");
        const chapterQuery = query(chaptersRef, orderBy("order", "asc"));
        const chapterSnap = await getDocs(chapterQuery);
        const chapters = chapterSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        
        // Check if the chapter for this day is accessible
        const targetChapter = chapters[assignmentDay - 1]; // Day 1 = index 0
        if (targetChapter && allowedChapters.includes(targetChapter.id)) {
          setHasAccess(true);
        }
      }

      // Check for existing submission
      const submissionRef = collection(db, "courses", foundCourseId, "assignments", assignmentId, "submissions");
      const submissionQuery = await getDocs(submissionRef);
      const userSubmission = submissionQuery.docs.find(doc => doc.data().studentId === user.uid);
      
      if (userSubmission) {
        setExistingSubmission({ id: userSubmission.id, ...userSubmission.data() });
        setSubmission({
          mcqAnswers: userSubmission.data().mcqAnswers || {},
          codingSolution: userSubmission.data().codingSolution || "",
          language: userSubmission.data().language || "javascript"
        });
      }

    } catch (error) {
      console.error("Error fetching assignment:", error);
    } finally {
      setLoading(false);
    }
  }, [slug, assignmentId, router, urlSlug]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        await fetchData(user);
      } else {
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, [fetchData]);

  const handleMCQAnswer = (questionIndex, answerIndex) => {
    setSubmission(prev => ({
      ...prev,
      mcqAnswers: {
        ...prev.mcqAnswers,
        [questionIndex]: answerIndex
      }
    }));
  };

  const handleCodingChange = (value) => {
    setSubmission(prev => ({
      ...prev,
      codingSolution: value || ""
    }));
  };

  const handleLanguageChange = (language) => {
    setSubmission(prev => ({
      ...prev,
      language
    }));
  };

  const handleSubmitClick = () => {
    setShowConfirmDialog(true);
  };

  const handleConfirmSubmit = async () => {
    if (!auth.currentUser) return;

    setShowConfirmDialog(false);
    setSubmitting(true);
    try {
      // If coding assignment, run all test cases (visible + hidden) again before submitting
      let resultStatus = null;
      let testSummary = null;
      if (assignment?.type === 'coding') {
        const allTestCases = (assignment.questions || [])
          .flatMap((q) => Array.isArray(q.testCases) ? q.testCases : [])
          .filter(Boolean);
        let passCount = 0;
        let totalCount = allTestCases.length;
        let hadCompilerError = false;
        if (totalCount > 0) {
          for (const tc of allTestCases) {
            try {
              const res = await fetch('/api/compile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  language: submission.language,
                  source: submission.codingSolution,
                  stdin: tc.input,
                }),
              });
              if (!res.ok) throw new Error(`HTTP ${res.status}`);
              const data = await res.json();
              const actual = (data.stdout || '').trim();
              const expected = (tc.output || '').trim();
              const stderr = (data.stderr || '').trim();
              if (stderr) hadCompilerError = true;
              if (actual.toLowerCase() === expected.toLowerCase()) {
                passCount += 1;
              }
            } catch (_) {
              // Treat as failed test
            }
          }
        }
        // Determine result status
        if (totalCount > 0 && passCount === totalCount) {
          resultStatus = 'success';
        } else if (passCount > 0 && !hadCompilerError) {
          resultStatus = 'partial';
        } else {
          resultStatus = 'fail';
        }
        testSummary = { passCount, totalCount };
      } else if (assignment?.type === 'mcq') {
        const questions = assignment.questions || [];
        const totalCount = questions.length;
        let passCount = 0;
        if (totalCount > 0) {
          for (let i = 0; i < questions.length; i++) {
            const q = questions[i];
            const correctIndex = typeof q.correctAnswer === 'number' ? q.correctAnswer : null;
            const userIndex = submission.mcqAnswers?.[i];
            if (correctIndex !== null && userIndex === correctIndex) passCount += 1;
          }
        }
        if (totalCount > 0 && passCount === totalCount) {
          resultStatus = 'success';
        } else if (passCount > 0) {
          resultStatus = 'partial';
        } else {
          resultStatus = 'fail';
        }
        testSummary = { passCount, totalCount };
      }

      const baseData = {
        studentId: auth.currentUser.uid,
        studentName: auth.currentUser.displayName || auth.currentUser.email,
        submittedAt: serverTimestamp(),
        resultStatus,
        testSummary,
        ...submission,
      };

      const autoScore = testSummary?.totalCount
        ? Math.round((testSummary.passCount / testSummary.totalCount) * 100)
        : null;

      const submissionData = autoScore !== null ? { ...baseData, autoScore } : baseData;

      if (existingSubmission) {
        // Update existing submission
        await updateDoc(
          doc(db, "courses", courseId || course?.id, "assignments", assignmentId, "submissions", existingSubmission.id),
          submissionData
        );
      } else {
        // Create new submission
        await addDoc(
          collection(db, "courses", courseId || course?.id, "assignments", assignmentId, "submissions"),
          submissionData
        );
      }

      if (assignment?.type === 'coding') {
        if (submissionData.resultStatus === 'success') {
          alert('Submission result: Success - All tests passed');
        } else if (submissionData.resultStatus === 'partial') {
          alert(`Submission result: Partial - ${submissionData.testSummary?.passCount || 0}/${submissionData.testSummary?.totalCount || 0} tests passed`);
        } else {
          alert('Submission result: Fail - 0 tests passed or compiler error');
        }
      } else {
        const scorePct = typeof submissionData.autoScore === 'number' ? `${submissionData.autoScore}%` : 'N/A';
        alert(`Assignment submitted! MCQ Score: ${scorePct}`);
      }
      router.push(`/courses/${urlSlug}`);
    } catch (error) {
      console.error("Error submitting assignment:", error);
      alert("Error submitting assignment. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReview = () => {
    setShowConfirmDialog(false);
  };

  // getDefaultStarter and mapLanguage are hoisted as stateless helpers above

  if (loading) return <div className="p-8">Loading assignment...</div>;
  if (!assignment) return <div className="p-8">Assignment not found.</div>;
  if (!hasAccess) return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto text-center">
        <h1 className="text-2xl font-bold text-red-600 mb-4">Access Denied</h1>
        <p className="text-gray-600 mb-4">
          You don&apos;t have access to this assignment yet. Please complete the previous chapters first.
        </p>
        <button
          onClick={() => router.push(`/courses/${urlSlug}`)}
          className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700"
        >
          Back to Course
        </button>
      </div>
    </div>
  );

  return (
    <CheckAuth>
      <div className=" bg-gradient-to-b from-sky-100 via-blue-50 to-cyan-100 text-gray-800 p-6">
        <div className=" mx-auto">
          {/* Header */}
          <div className="mb-8">
            <button
              onClick={() => router.push(`/courses/${urlSlug}`)}
              className="flex items-center gap-2 text-cyan-600 hover:text-cyan-700 mb-4"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Course
            </button>
            
            <div className="flex flex-wrap items-center gap-3 mb-2">
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">{assignment.title}</h1>
              <span className="px-2 py-1 text-xs rounded-full bg-cyan-100 text-cyan-800">
                {assignment.type === 'mcq' ? 'MCQ' : 'Coding'}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
              <span className="inline-flex items-center gap-1">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6l4 2"/></svg>
                Day {assignment.day || 1}
              </span>
              <span className="inline-flex items-center gap-1">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3M3 11h18M5 19h14"/></svg>
                Due: {assignment.dueDate || '—'}
              </span>
              <span className="inline-flex items-center gap-1">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 14l9-5-9-5-9 5 9 5z"/></svg>
                Course: {course?.title}
              </span>
            </div>
            
            {/* Progress Indicator */}
            {(() => {
              const { answered, total } = answeredProgress;
              const progressPercentage = total > 0 ? (answered / total) * 100 : 0;
              return (
                <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-blue-800">
                      Progress: {answered} of {total} questions answered
                    </span>
                    <span className="text-sm text-blue-600">
                      {Math.round(progressPercentage)}%
                    </span>
                  </div>
                  <div className="w-full bg-blue-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${progressPercentage}%` }}
                    ></div>
                  </div>
                </div>
              );
            })()}
            
            {/* Submission Status */}
            {existingSubmission && (
              <div className="mt-4 p-4 rounded-lg border flex flex-wrap items-center justify-between gap-3 "
                style={{ borderColor: existingSubmission.resultStatus === 'success' ? '#bbf7d0' : existingSubmission.resultStatus === 'partial' ? '#fef08a' : '#fecaca', background: existingSubmission.resultStatus === 'success' ? '#f0fdf4' : existingSubmission.resultStatus === 'partial' ? '#fefce8' : '#fef2f2' }}
              >
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                    existingSubmission.resultStatus === 'success' ? 'bg-green-100 text-green-800' : existingSubmission.resultStatus === 'partial' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {existingSubmission.resultStatus === 'success' ? 'Success' : existingSubmission.resultStatus === 'partial' ? 'Partial' : 'Fail'}
                  </span>
                  <p className={`font-medium ${existingSubmission.resultStatus === 'success' ? 'text-green-800' : existingSubmission.resultStatus === 'partial' ? 'text-yellow-800' : 'text-red-800'}`}>
                    Submitted on {existingSubmission.submittedAt?.toDate?.()?.toLocaleDateString() || 'Unknown date'}
                  </p>
                </div>
                {typeof existingSubmission.autoScore === 'number' && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-700">Auto Score</span>
                    <span className="text-sm font-semibold text-gray-900">{existingSubmission.autoScore}%</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Assignment Content */}
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            {assignment.type === 'mcq' ? (
              // MCQ Assignment
              <div>
                <h2 className="text-2xl font-semibold mb-6 text-cyan-600">Multiple Choice Questions</h2>
                {assignment.questions && assignment.questions.map((question, qIndex) => (
                  <div key={qIndex} className="mb-8 p-4 border rounded-lg">
                    <h3 className="text-lg font-medium mb-4">
                      Question {qIndex + 1}: {question.question}
                    </h3>
                    <div className="space-y-2">
                      {question.options.map((option, oIndex) => (
                        <label key={oIndex} className={`flex items-center space-x-3 ${existingSubmission ? 'cursor-default' : 'cursor-pointer'}`}>
                          <input
                            type="radio"
                            name={`question-${qIndex}`}
                            value={oIndex}
                            checked={submission.mcqAnswers[qIndex] === oIndex}
                            onChange={existingSubmission ? undefined : () => handleMCQAnswer(qIndex, oIndex)}
                            disabled={existingSubmission}
                            className={`text-cyan-600 focus:ring-cyan-500 ${existingSubmission ? 'opacity-50' : ''}`}
                          />
                          <span className={`text-gray-700 ${existingSubmission ? 'opacity-75' : ''}`}>{option}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              // Coding Assignment
              <div>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-semibold text-cyan-600">Coding Assignment</h2>
                  {hiddenStats && (
                    <div className="flex items-center gap-3">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                          hiddenStats.passCount === hiddenStats.totalCount
                            ? 'bg-green-100 text-green-800'
                            : hiddenStats.passCount === 0
                            ? 'bg-red-100 text-red-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {hiddenStats.passCount}/{hiddenStats.totalCount} tests passed
                      </span>
                      <div className="w-40 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`${
                            hiddenStats.passCount === hiddenStats.totalCount ? 'bg-green-600' : 'bg-yellow-500'
                          } h-2`}
                          style={{ width: `${Math.round((hiddenStats.passCount / hiddenStats.totalCount) * 100)}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Problem Description */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div>
                {assignment.questions && assignment.questions.map((question, qIndex) => (
                  <div key={qIndex} className="mb-6 p-5 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-lg font-semibold">Problem {qIndex + 1}</h3>
                      <span className="text-xs text-gray-500">Test cases: {question.testCases?.length || 0}</span>
                    </div>
                    <p className="text-gray-700 mb-4 leading-7">{question.question}</p>
                    {question.description && (
                      <div className="mb-4 p-3 bg-white rounded border">
                        <h4 className="font-medium text-gray-800 font-semibold mb-2">Description</h4>
                        <p className="text-gray-700 leading-7">{question.description}</p>
                      </div>
                    )}
                    {question.testCases && question.testCases.length > 0 && (
                      <div>
                        <h4 className="font-medium text-gray-800 mb-2">Sample Test Cases</h4>
                        <div className="grid sm:grid-cols-2 gap-2">
                          {question.testCases.map((testCase, tIndex) => (
                            <div key={tIndex} className="text-sm bg-white p-3 rounded border">
                              <p className="font-medium text-gray-800 font-semibold mb-1">Input</p>
                              <pre className="bg-gray-100 rounded p-2 overflow-x-auto text-gray-700">{testCase.input}</pre>
                              <p className="font-medium text-gray-800 font-semibold mt-2 mb-1">Expected Output</p>
                              <pre className="bg-gray-100 rounded p-2 overflow-x-auto text-gray-700">{testCase.output}</pre>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                  </div>
                  {/* Language Selection */}
                  <div>
                <div className="mb-4">
                  <label className="block font-semibold text-sm font-medium text-gray-700 mb-2">
                    Programming Language:
                  </label>
                  <select
                    value={submission.language}
                    onChange={existingSubmission ? undefined : (e) => handleLanguageChange(e.target.value)}
                    disabled={existingSubmission}
                    className={`w-full p-2 border border-gray-300 rounded-md focus:ring-cyan-500 focus:border-cyan-500 ${existingSubmission ? 'bg-gray-100 opacity-75' : ''}`}
                  >
                    <option value="javascript">JavaScript</option>
                    <option value="python">Python</option>
                    <option value="java">Java</option>
                    <option value="c">C</option>
                  </select>
                </div>

                {/* Code Editor */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {existingSubmission ? 'Your Submitted Solution:' : 'Your Solution:'}
                  </label>
                  <div className="border rounded-lg overflow-hidden shadow-sm">
                    <MonacoEditor
                      height="400px"
                      language={mapLanguage(submission.language)}
                      value={submission.codingSolution || getDefaultStarter(submission.language)}
                      onChange={existingSubmission ? undefined : handleCodingChange}
                      options={{
                        fontSize: 14,
                        minimap: { enabled: false },
                        scrollBeyondLastLine: false,
                        readOnly: existingSubmission,
                      }}
                    />
                  </div>
                </div>

                {/* Run Hidden Tests (no details shown) */}
                {!existingSubmission && (
                  <div className="mb-6 flex flex-wrap items-center gap-3">
                    <button
                      onClick={async () => {
                        if (!submission.codingSolution || submission.codingSolution.trim() === '') {
                          alert('Please write some code before running tests.');
                          return;
                        }
                        try {
                          setRunningHidden(true);
                          setHiddenSummary(null);
                          // Collect test cases across all coding questions
                          const allTestCases = (assignment.questions || [])
                            .flatMap((q) => Array.isArray(q.testCases) ? q.testCases : [])
                            .filter(Boolean);
                          // Detect hidden by multiple conventions
                          const hiddenTests = allTestCases.filter((tc) => tc && (tc.hidden === true || tc.isHidden === true || tc.visibility === 'hidden'));
                          const testsToRun = hiddenTests.length > 0 ? hiddenTests : allTestCases;
                          if (testsToRun.length === 0) {
                            alert('No tests configured.');
                            setRunningHidden(false);
                            return;
                          }
                          let passCount = 0;
                          for (const tc of testsToRun) {
                            try {
                              const res = await fetch('/api/compile', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  language: submission.language,
                                  source: submission.codingSolution,
                                  stdin: tc.input,
                                }),
                              });
                              if (!res.ok) throw new Error(`HTTP ${res.status}`);
                              const data = await res.json();
                              const actual = (data.stdout || '').trim();
                              const expected = (tc.output || '').trim();
                              if (actual.toLowerCase() === expected.toLowerCase()) passCount += 1;
                            } catch (_) {
                              // Treat error as failed test, do not reveal details
                            }
                          }
                          const label = hiddenTests.length > 0 ? 'hidden tests' : 'tests';
                          const summary = `${passCount}/${testsToRun.length} ${label} passed`;
                          setHiddenSummary(summary);
                          setHiddenStats({ passCount, totalCount: testsToRun.length });
                          alert(summary);
                        } catch (e) {
                          console.error('Hidden tests run failed:', e);
                          alert('Failed to run hidden tests. Please try again.');
                        } finally {
                          setRunningHidden(false);
                        }
                      }}
                      disabled={runningHidden}
                      className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-md shadow"
                    >
                      {runningHidden ? 'Running Hidden Tests...' : 'Run Hidden Tests'}
                    </button>
                    {hiddenStats && (
                      <div className="flex items-center gap-3">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                            hiddenStats.passCount === hiddenStats.totalCount
                              ? 'bg-green-100 text-green-800'
                              : hiddenStats.passCount === 0
                              ? 'bg-red-100 text-red-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}
                        >
                          {hiddenStats.passCount}/{hiddenStats.totalCount} tests passed
                        </span>
                        <div className="w-40 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className={`${
                              hiddenStats.passCount === hiddenStats.totalCount
                                ? 'bg-green-600'
                                : 'bg-yellow-500'
                            } h-2`}
                            style={{ width: `${Math.round((hiddenStats.passCount / hiddenStats.totalCount) * 100)}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Submit Button - Only show if no existing submission */}
          {!existingSubmission && (
            <div className="flex justify-end">
              <button
                onClick={handleSubmitClick}
                disabled={submitting}
                className="px-6 py-3 bg-cyan-600 hover:bg-cyan-700 disabled:bg-gray-400 text-white font-medium rounded-lg shadow-md transition"
              >
                {submitting ? "Submitting..." : "Submit Assignment"}
              </button>
            </div>
          )}

          {/* Confirmation Dialog */}
          {showConfirmDialog && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
                <div className="flex items-center mb-4">
                  <div className="flex-shrink-0">
                    <svg className="h-6 w-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                  </div>
                  <h3 className="ml-3 text-lg font-medium text-gray-900">
                    Confirm Submission
                  </h3>
                </div>
                
                <div className="mb-6">
                  <p className="text-sm text-gray-600">
                     <strong>Alert:</strong> Once you submit this assignment, you cannot edit it anymore.
                  </p>
                  
                  {/* Progress Summary */}
                  {(() => {
                    const { answered, total } = answeredProgress;
                    const progressPercentage = total > 0 ? (answered / total) * 100 : 0;
                    return (
                      <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-gray-700">
                            Questions Answered: {answered} out of {total}
                          </span>
                          <span className="text-sm text-gray-600">
                            {Math.round(progressPercentage)}% Complete
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-cyan-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${progressPercentage}%` }}
                          ></div>
                        </div>
                      </div>
                    );
                  })()}
                  
                  <p className="text-sm text-gray-600 mt-4">
                    Are you sure you want to submit your assignment?
                  </p>
                </div>
                
                <div className="flex gap-3 justify-end">
                  <button
                    onClick={handleReview}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                  >
                    Review
                  </button>
                  <button
                    onClick={handleConfirmSubmit}
                    disabled={submitting}
                    className="px-4 py-2 text-sm font-medium text-white bg-cyan-600 border border-transparent rounded-md hover:bg-cyan-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-500 disabled:bg-gray-400"
                  >
                    {submitting ? "Submitting..." : "Submit"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </CheckAuth>
  );
}