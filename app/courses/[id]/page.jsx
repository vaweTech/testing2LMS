"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../../../lib/firebase";
import {
  doc,
  getDoc,
  getDocs,
  collection,
  query,
  where,
  orderBy,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import CheckAuth from "../../../lib/CheckAuth";
import Image from "next/image";
import { parseCourseUrl, createSlug } from "../../../lib/urlUtils";
import {
  PlayCircle,
  FileText,
  Radio,
  BookOpen,
  FileDown,
  FileArchive,
  Video,
  AlertCircle,
  Clock,
  Calendar,
  ChevronDown,
  ChevronUp,
  X,
  CheckCircle,
  Circle,
  Star,
} from "lucide-react";

// Function to convert common video URLs to embeddable URLs (YouTube, Google Drive)
const getEmbedUrl = (url) => {
  if (!url) return "";

  // Google Drive file link patterns → convert to /preview
  // Examples:
  // - https://drive.google.com/file/d/FILE_ID/view → https://drive.google.com/file/d/FILE_ID/preview
  // - https://drive.google.com/open?id=FILE_ID → https://drive.google.com/file/d/FILE_ID/preview
  // - https://drive.google.com/uc?id=FILE_ID&export=download → https://drive.google.com/file/d/FILE_ID/preview
  try {
    const u = new URL(url);
    if (u.hostname.includes('drive.google.com')) {
      // Case 1: /file/d/FILE_ID/(view|preview|...) → normalize to /preview
      const fileMatch = u.pathname.match(/\/file\/d\/([^/]+)\//);
      if (fileMatch && fileMatch[1]) {
        const fileId = fileMatch[1];
        return `https://drive.google.com/file/d/${fileId}/preview`;
      }
      // Case 2: /open?id=FILE_ID
      const idFromQuery = u.searchParams.get('id');
      if (idFromQuery) {
        return `https://drive.google.com/file/d/${idFromQuery}/preview`;
      }
      // Case 3: /uc?id=FILE_ID
      const ucId = u.searchParams.get('id');
      if (u.pathname.startsWith('/uc') && ucId) {
        return `https://drive.google.com/file/d/${ucId}/preview`;
      }
    }
  } catch (_) {
    // Ignore URL parse errors and fall through
  }

  // YouTube: convert to embed
  const youtubeRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
  const match = url.match(youtubeRegex);
  if (match) {
    return `https://www.youtube.com/embed/${match[1]}`;
  }
  if (url.includes('youtube.com/embed/')) {
    return url;
  }

  // Default: return the original URL
  return url;
};

export default function CourseDetailsPage() {
  const { id: urlSlug } = useParams();
  const router = useRouter();
  
  // Parse the URL to get the course slug
  const { slug } = parseCourseUrl(urlSlug);
  const [course, setCourse] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [accessibleChapters, setAccessibleChapters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [openDay, setOpenDay] = useState(null);
  const [openVideoDay, setOpenVideoDay] = useState(null);
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);
  const [selectedDayAssignments, setSelectedDayAssignments] = useState([]);
  const [assignmentSubmissions, setAssignmentSubmissions] = useState({});

  // Feedback state
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [selectedChapterForFeedback, setSelectedChapterForFeedback] = useState(null);
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [feedbackTrainer, setFeedbackTrainer] = useState(0);
  const [feedbackPractical, setFeedbackPractical] = useState(0);
  const [feedbackAdmin, setFeedbackAdmin] = useState(0);
  const [feedbackComments, setFeedbackComments] = useState("");
  const [existingFeedbackLoaded, setExistingFeedbackLoaded] = useState(false);
  const [submittingFeedback, setSubmittingFeedback] = useState(false);

  const [currentUser, setCurrentUser] = useState(null);
  const [courseIdState, setCourseIdState] = useState(null);

  const fetchData = useCallback(async (user) => {
    try {
      setError(null);
      let allowedChapters = [];
      let courseId = null;

      // Get student data
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
        setError("Course not found");
        return;
      }

      courseId = matchingCourse.id;
      setCourse(matchingCourse);
      setCourseIdState(matchingCourse.id);

      if (studentData?.chapterAccess && studentData.chapterAccess[courseId]) {
        allowedChapters = studentData.chapterAccess[courseId];
      }
      setAccessibleChapters(allowedChapters);

      // Chapters (ordered by "order" field)
      const chaptersRef = collection(db, "courses", courseId, "chapters");
      const chapterQuery = query(chaptersRef, orderBy("order", "asc"));
      const chapterSnap = await getDocs(chapterQuery);

      const chapterData = chapterSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setChapters(chapterData);

      // Assignments with submission status
      const assignmentsRef = collection(db, "courses", courseId, "assignments");
      const assignmentSnap = await getDocs(assignmentsRef);
      const assignmentsData = assignmentSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      
      // Fetch submissions for each assignment
      const submissionsMap = {};
      for (const assignment of assignmentsData) {
        try {
          const submissionsRef = collection(db, "courses", courseId, "assignments", assignment.id, "submissions");
          const submissionsSnap = await getDocs(submissionsRef);
          const userSubmission = submissionsSnap.docs.find(doc => doc.data().studentId === user.uid);
          
          if (userSubmission) {
            submissionsMap[assignment.id] = {
              id: userSubmission.id,
              ...userSubmission.data(),
              submittedAt: userSubmission.data().submittedAt?.toDate?.() || new Date()
            };
          }
        } catch (error) {
          console.error(`Error fetching submissions for assignment ${assignment.id}:`, error);
        }
      }
      
      setAssignmentSubmissions(submissionsMap);
      setAssignments(assignmentsData);
    } catch (err) {
      console.error("❌ Error fetching data:", err);
      setError("Failed to load course details. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setCurrentUser(user);
        fetchData(user);
      } else {
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, [fetchData]);

  const getDaysUntilDue = (dueDate) => {
    if (!dueDate) return "No due date";
    
    const due = new Date(dueDate);
    const now = new Date();
    const diffTime = due - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return `${Math.abs(diffDays)} days overdue`;
    if (diffDays === 0) return "Due today";
    if (diffDays === 1) return "Due tomorrow";
    return `Due in ${diffDays} days`;
  };

  const handleAssignmentClick = (dayIndex) => {
    const dayAssignments = assignments.filter(a => a.day === dayIndex + 1);
    
    if (dayAssignments.length === 1) {
      // Single assignment - navigate directly
      router.push(`/courses/${urlSlug}/assignments/${dayAssignments[0].id}`);
    } else if (dayAssignments.length > 1) {
      // Multiple assignments - show modal
      setSelectedDayAssignments(dayAssignments);
      setShowAssignmentModal(true);
    }
  };

  const handleCloseModal = () => {
    setShowAssignmentModal(false);
    setSelectedDayAssignments([]);
  };

  const getSubmissionStatus = (assignmentId) => {
    return assignmentSubmissions[assignmentId] || null;
  };

  const getStatusColor = (submission) => {
    if (!submission) return "bg-gray-100 text-gray-800";
    
    switch (submission.resultStatus) {
      case 'success': return "bg-green-100 text-green-800";
      case 'partial': return "bg-yellow-100 text-yellow-800";
      case 'fail': return "bg-red-100 text-red-800";
      default: return "bg-blue-100 text-blue-800";
    }
  };

  const getStatusIcon = (submission) => {
    if (!submission) return <Circle size={16} className="text-gray-500" />;
    
    switch (submission.resultStatus) {
      case 'success': return <CheckCircle size={16} className="text-green-600" />;
      case 'partial': return <Clock size={16} className="text-yellow-600" />;
      case 'fail': return <X size={16} className="text-red-600" />;
      default: return <CheckCircle size={16} className="text-blue-600" />;
    }
  };

  const openFeedback = async (chapter) => {
    setSelectedChapterForFeedback(chapter);
    setShowFeedbackModal(true);
    setExistingFeedbackLoaded(false);
    try {
      if (!currentUser || !courseIdState) return;
      const feedbackRef = doc(
        db,
        "courses",
        courseIdState,
        "chapters",
        chapter.id,
        "feedback",
        currentUser.uid
      );
      const snap = await getDoc(feedbackRef);
      if (snap.exists()) {
        const data = snap.data();
        setFeedbackRating(data.rating || 0);
        setFeedbackTrainer((data.trainer ?? data.understanding) || 0);
        setFeedbackPractical((data.practicalOriented ?? data.pace) || 0);
        setFeedbackAdmin((data.admin ?? data.clarity) || 0);
        setFeedbackComments(data.comments || "");
      } else {
        setFeedbackRating(0);
        setFeedbackTrainer(0);
        setFeedbackPractical(0);
        setFeedbackAdmin(0);
        setFeedbackComments("");
      }
    } catch (e) {
      console.error("Error loading feedback:", e);
    } finally {
      setExistingFeedbackLoaded(true);
    }
  };

  const closeFeedback = () => {
    setShowFeedbackModal(false);
    setSelectedChapterForFeedback(null);
  };

  const submitFeedback = async () => {
    if (!currentUser || !courseIdState || !selectedChapterForFeedback) return;
    if (feedbackRating <= 0) return; // minimal validation
    setSubmittingFeedback(true);
    try {
      const feedbackRef = doc(
        db,
        "courses",
        courseIdState,
        "chapters",
        selectedChapterForFeedback.id,
        "feedback",
        currentUser.uid
      );
      await setDoc(
        feedbackRef,
        {
          rating: feedbackRating,
          trainer: feedbackTrainer,
          practicalOriented: feedbackPractical,
          admin: feedbackAdmin,
          comments: feedbackComments,
          userId: currentUser.uid,
          userEmail: currentUser.email || null,
          updatedAt: serverTimestamp(),
          createdAt: serverTimestamp(),
        },
        { merge: true }
      );
      closeFeedback();
    } catch (e) {
      console.error("Error submitting feedback:", e);
    } finally {
      setSubmittingFeedback(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-sky-100 via-blue-50 to-cyan-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading course details...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-sky-100 via-blue-50 to-cyan-100 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Error Loading Course</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => router.push('/courses')}
            className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition"
          >
            Back to Courses
          </button>
        </div>
      </div>
    );
  }

  if (!course) return <div className="p-8">Course not found.</div>;

  return (
    <CheckAuth>
      <div className="min-h-screen bg-gradient-to-b from-sky-100 via-blue-50 to-cyan-100 text-gray-800 p-10">
        {/* Header */}
        <div className="max-w-4xl mx-auto text-center mb-12">
          {course.image && (
            <div className="w-full max-h-72 rounded-xl mb-6 shadow-lg overflow-hidden">
              <Image
                src={course.image}
                alt={course.title}
                width={800}
                height={288}
                className="w-full h-full object-cover"
                priority
              />
            </div>
          )}
          <h1 className="text-4xl font-bold mb-3 bg-gradient-to-r from-cyan-500 to-blue-600 bg-clip-text text-transparent">
            {course.title}
          </h1>
          <p className="text-gray-700 text-lg line-clamp-2">
            {course.description}
          </p>
        </div>

        {/* Syllabus Overview */}
        {course.syllabus && (
          <div className="max-w-3xl mx-auto mb-10">
            <h2 className="text-2xl font-semibold mb-4 text-cyan-600 flex items-center gap-2">
              <BookOpen size={24} />
              Syllabus Overview
            </h2>
            <div className="bg-white p-6 rounded-lg shadow-md border">
              <ul className="list-disc list-inside text-gray-700 space-y-2">
                {typeof course.syllabus === 'string' 
                  ? course.syllabus
                      .split('$').filter(item => item.trim().length > 0)
                      .map(
                        (item, idx) => (
                          <li key={idx} className="mb-1">
                            {item.trim()}
                          </li>
                        )
                      )
                  : Array.isArray(course.syllabus)
                  ? course.syllabus.map((item, idx) => (
                      <li key={idx} className="mb-1">{item}</li>
                    ))
                  : <li>{String(course.syllabus)}</li>
                }
              </ul>
            </div>
          </div>
        )}

        {/* Chapters (Programme) */}
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-semibold mb-6 text-cyan-600 flex items-center gap-2">
            <Calendar size={24} />
            Programme
          </h2>

          <div className="space-y-4">
            {chapters.map((chapter, index) => {
              const hasAccess = accessibleChapters.includes(chapter.id);
              const isOpen = openDay === chapter.id;
              const hasVideo = chapter.video;
              const isVideoOpen = openVideoDay === chapter.id;

              return (
                <div
                  key={chapter.id}
                  className="border border-gray-300 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow"
                >
                  {/* Accordion Header */}
                  <button
                    disabled={!hasAccess}
                    onClick={() =>
                      setOpenDay(openDay === chapter.id ? null : chapter.id)
                    }
                    className={`w-full flex justify-between items-center px-4 py-3 ${
                      hasAccess
                        ? "bg-gray-200 hover:bg-gray-300 transition-colors"
                        : "bg-gray-100 cursor-not-allowed text-gray-400"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-medium">
                        Day {index + 1}: {chapter.title}
                      </span>
                      {!hasAccess && (
                        <span className="text-xs bg-gray-300 text-gray-600 px-2 py-1 rounded-full">
                          Locked
                        </span>
                      )}
                    </div>
                    <span className="text-xl">
                      {isOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </span>
                  </button>

                  {/* Accordion Content */}
                  {isOpen && (
                    <div className="p-4 bg-white flex flex-col gap-4">
                      {/* Topics */}
                      {chapter.topics && (
                        <div>
                          <h3 className="text-lg font-semibold text-cyan-600 flex items-center gap-2 mb-2">
                            <BookOpen size={18} /> Topics
                          </h3>
                          <ul className="list-disc list-inside text-gray-700 space-y-1">
                            {typeof chapter.topics === 'string' 
                              ? chapter.topics
                                  .split(".")
                                  .map(
                                    (topic, idx) =>
                                      topic.trim() && (
                                        <li key={idx}>{topic.trim()}</li>
                                      )
                                  )
                              : Array.isArray(chapter.topics)
                              ? chapter.topics.map((topic, idx) => (
                                  <li key={idx}>{topic}</li>
                                ))
                              : <li>{String(chapter.topics)}</li>
                            }
                          </ul>
                        </div>
                      )}

                      {/* Buttons */}
                      <div className="flex flex-wrap gap-4">
                        {chapter.liveClassLink && (
                          <a
                            href={chapter.liveClassLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg shadow-md transition"
                          >
                            <Radio size={18} /> Live Class
                          </a>
                        )}

                        {chapter.recordedClassLink && (
                          <a
                            href={chapter.recordedClassLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg shadow-md transition"
                          >
                            <Video size={18} /> Recorded Session
                          </a>
                        )}

                        {hasVideo && (
                          <button
                            onClick={() =>
                              setOpenVideoDay(
                                isVideoOpen ? null : chapter.id
                              )
                            }
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-md transition"
                          >
                            <PlayCircle size={18} />{" "}
                            {isVideoOpen ? "Hide Video" : "Watch Video"}
                          </button>
                        )}

                        {chapter.assessment && (
                          <a
                            href={chapter.assessment}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg shadow-md transition"
                          >
                            <FileText size={18} /> Assessment
                          </a>
                        )}

                        {chapter.pdfDocument && (
                          <button
                            onClick={() => router.push(`/view-pdf-secure?url=${encodeURIComponent(chapter.pdfDocument)}&title=${encodeURIComponent(chapter.title + ' - PDF')}`)}
                            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg shadow-md transition"
                          >
                            <FileDown size={18} /> View PDF
                          </button>
                        )}

                        {chapter.classDocs && (
                          <button
                            onClick={() => router.push(`/view-ppt?url=${encodeURIComponent(chapter.classDocs)}&title=${encodeURIComponent(chapter.title + ' - PPTs')}`)}
                            className="flex items-center gap-2 px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg shadow-md transition"
                          >
                            <FileArchive size={18} />PPTs
                          </button>
                        )}

                        {/* Assignment Button - Only show if user has access to this chapter */}
                        {hasAccess && (() => {
                          const dayAssignments = assignments.filter(a => a.day === index + 1);
                          return dayAssignments.length > 0 ? (
                            <button
                              onClick={() => handleAssignmentClick(index)}
                              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-md transition"
                            >
                              <FileText size={18} /> Assignment ({dayAssignments.length})
                            </button>
                          ) : null;
                        })()}
               {/* Feedback Button */}
               {hasAccess && (
                          <button
                            onClick={() => openFeedback(chapter)}
                            className="flex items-center gap-2 px-4 py-2 bg-pink-600 hover:bg-pink-700 text-white rounded-lg shadow-md transition"
                          >
                            <Star size={18} /> Feedback
                          </button>
                        )}


                      </div>

                      {/* Video */}
                      {isVideoOpen && hasVideo && (
                        <div className="w-full aspect-video rounded-lg overflow-hidden shadow-md border border-gray-300">
                          <iframe
                            src={getEmbedUrl(chapter.video)}
                            title={chapter.title}
                            className="w-full h-full transform scale-100 origin-center"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                          ></iframe>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Assignment Modal */}
        {showAssignmentModal && (
          <div className="fixed inset-0 bg-white-100/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
              {/* Modal Header */}
              <div className="flex items-center justify-between p-6 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-800">
                  Day {selectedDayAssignments[0]?.day || 1} Assignments
                </h2>
                <button
                  onClick={handleCloseModal}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
                <div className="space-y-4">
                  {selectedDayAssignments.map((assignment, idx) => {
                    const submission = getSubmissionStatus(assignment.id);
                    const isSubmitted = !!submission;
                    
                    return (
                      <div
                        key={assignment.id}
                        className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <h3 className="text-lg font-medium text-gray-800 mb-1">
                              {assignment.title}
                            </h3>
                            <div className="flex items-center gap-4 text-sm text-gray-600">
                              <span className="inline-flex items-center gap-1">
                                <FileText size={14} />
                                {assignment.type === 'mcq' ? 'MCQ' : 'Coding'}
                              </span>
                              <span className="inline-flex items-center gap-1">
                                <Clock size={14} />
                                Due: {assignment.dueDate || 'No due date'}
                              </span>
                              <span className="inline-flex items-center gap-1">
                                {getStatusIcon(submission)}
                                {isSubmitted ? 'Submitted' : 'Not Submitted'}
                              </span>
                            </div>
                          </div>
                          
                          {/* Status Badge */}
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(submission)}`}>
                            {isSubmitted ? (
                              submission.resultStatus === 'success' ? 'Completed' :
                              submission.resultStatus === 'partial' ? 'Partial' :
                              submission.resultStatus === 'fail' ? 'Failed' : 'Submitted'
                            ) : 'Pending'}
                          </span>
                        </div>

                        {/* Submission Details */}
                        {isSubmitted && (
                          <div className="bg-gray-50 rounded-lg p-3 mb-3">
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-gray-600">
                                Submitted: {submission.submittedAt.toLocaleDateString()}
                              </span>
                              {typeof submission.autoScore === 'number' && (
                                <span className="font-medium text-gray-800">
                                  Score: {submission.autoScore}%
                                </span>
                              )}
                            </div>
                            {submission.testSummary && (
                              <div className="mt-2 text-sm text-gray-600">
                                Tests: {submission.testSummary.passCount}/{submission.testSummary.totalCount} passed
                              </div>
                            )}
                          </div>
                        )}

                        {/* Action Button */}
                        <button
                          onClick={() => {
                            handleCloseModal();
                            router.push(`/courses/${urlSlug}/assignments/${assignment.id}`);
                          }}
                          className={`w-full px-4 py-2 rounded-lg font-medium transition-colors ${
                            isSubmitted
                              ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                              : 'bg-indigo-600 text-white hover:bg-indigo-700'
                          }`}
                        >
                          {isSubmitted ? 'View Submission' : 'Start Assignment'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex justify-end p-6 border-t border-gray-200">
                <button
                  onClick={handleCloseModal}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Feedback Modal */}
        {showFeedbackModal && (
          <div className="fixed inset-0 bg-white-100/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-xl w-full max-h-[90vh] overflow-hidden">
              <div className="flex items-center justify-between p-6 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-800">
                  {selectedChapterForFeedback ? `Day ${chapters.findIndex(c => c.id === selectedChapterForFeedback.id) + 1}: ${selectedChapterForFeedback.title}` : "Class Feedback"}
                </h2>
                <button onClick={closeFeedback} className="text-gray-400 hover:text-gray-600 transition-colors">
                  <X size={24} />
                </button>
              </div>

              <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
                {!existingFeedbackLoaded ? (
                  <div className="text-center text-gray-600">Loading...</div>
                ) : (
                  <div className="space-y-5">
                    {/* Overall 5-star rating */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Overall rating for trainer (1-5)</label>
                      <div className="flex items-center gap-2">
                        {[1,2,3,4,5].map(n => (
                          <button
                            key={n}
                            type="button"
                            onClick={() => setFeedbackRating(n)}
                            className="p-1"
                            aria-label={`Rate ${n}`}
                          >
                            <Star size={28} className={n <= feedbackRating ? "text-yellow-400 fill-yellow-400" : "text-gray-300"} />
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Category ratings */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm text-gray-700 mb-1">Trainer</label>
                        <div className="flex gap-1">
                          {[1,2,3,4,5].map(n => (
                            <button key={n} type="button" onClick={() => setFeedbackTrainer(n)} className="p-0.5">
                              <Star size={20} className={n <= feedbackTrainer ? "text-yellow-400 fill-yellow-400" : "text-gray-300"} />
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm text-gray-700 mb-1">Practical Oriented</label>
                        <div className="flex gap-1">
                          {[1,2,3,4,5].map(n => (
                            <button key={n} type="button" onClick={() => setFeedbackPractical(n)} className="p-0.5">
                              <Star size={20} className={n <= feedbackPractical ? "text-yellow-400 fill-yellow-400" : "text-gray-300"} />
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm text-gray-700 mb-1">Admin Support</label>
                        <div className="flex gap-1">
                          {[1,2,3,4,5].map(n => (
                            <button key={n} type="button" onClick={() => setFeedbackAdmin(n)} className="p-0.5">
                              <Star size={20} className={n <= feedbackAdmin ? "text-yellow-400 fill-yellow-400" : "text-gray-300"} />
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Comments */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Comments for trainer (optional)</label>
                      <textarea
                        value={feedbackComments}
                        onChange={(e) => setFeedbackComments(e.target.value)}
                        rows={4}
                        className="w-full border border-gray-300 rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                        placeholder="What went well? What can be improved?"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 p-6 border-t border-gray-200">
                <button onClick={closeFeedback} className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors">Cancel</button>
                <button
                  onClick={submitFeedback}
                  disabled={submittingFeedback || feedbackRating === 0}
                  className={`px-4 py-2 rounded-lg text-white ${submittingFeedback || feedbackRating === 0 ? "bg-gray-300 cursor-not-allowed" : "bg-pink-600 hover:bg-pink-700"}`}
                >
                  {submittingFeedback ? "Submitting..." : "Submit Feedback"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </CheckAuth>
  );
}

