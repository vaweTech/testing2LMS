

// "use client";

// import { useParams } from "next/navigation";
// import { useState, useEffect, useRef } from "react";

// export default function PracticeMCQ() {
//   const { id } = useParams();

//   const mcqData = {
//     java: [
//       {
//         q: "Which keyword is used to inherit a class in Java?",
//         options: ["this", "super", "extends", "import"],
//         answer: "extends",
//       },
//       {
//         q: "Which of these is not a Java feature?",
//         options: ["Object-oriented", "Use of pointers", "Portable", "Robust"],
//         answer: "Use of pointers",
//       },
//     ],
//     crt: [
//       {
//         q: "What is the average of first 10 natural numbers?",
//         options: ["4", "5", "5.5", "6"],
//         answer: "5.5",
//       },
//     ],
//     c: [
//       {
//         q: "Which header file is required for printf() and scanf()?",
//         options: ["conio.h", "stdlib.h", "stdio.h", "math.h"],
//         answer: "stdio.h",
//       },
//     ],
//     python: [
//       {
//         q: "Which keyword is used to define a function in Python?",
//         options: ["function", "define", "def", "fun"],
//         answer: "def",
//       },
//     ],
//     react: [
//       {
//         q: "Which hook is used for state management in React?",
//         options: ["useData", "useState", "useEffect", "useReducer"],
//         answer: "useState",
//       },
//     ],
//   };

//   const questions = mcqData[id] || [];

//   const [selected, setSelected] = useState({});
//   const [showResult, setShowResult] = useState(false);
//   const [userEmail, setUserEmail] = useState("");
//   const [time, setTime] = useState(0);
//   const timerRef = useRef(null);

//   useEffect(() => {
//     setUserEmail("student@example.com"); // simulate login email

//     // Start timer
//     timerRef.current = setInterval(() => {
//       setTime((t) => t + 1);
//     }, 1000);

//     return () => clearInterval(timerRef.current);
//   }, []);

//   const handleSubmit = () => {
//     setShowResult(true);
//     clearInterval(timerRef.current);
//   };

//   const formatTime = (seconds) => {
//     const m = Math.floor(seconds / 60);
//     const s = seconds % 60;
//     return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
//   };

//   const score = Object.keys(selected).filter(
//     (i) => selected[i] === questions[i].answer
//   ).length;

//   return (
//     <div className="min-h-screen bg-gray-100 text-gray-800 p-8">
//       {/* Top bar */}
//       <div className="flex justify-between items-center mb-8">
//         <h1 className="text-3xl font-bold capitalize">{id} MCQs</h1>
//         <div className="flex items-center gap-4">
//           {userEmail && (
//             <span className="text-sm bg-gray-200 px-3 py-1 rounded-lg border border-gray-300">
//               {userEmail}
//             </span>
//           )}
//           <span className="text-sm font-medium bg-blue-100 text-blue-800 px-3 py-1 rounded-lg border border-blue-200">
//             ⏱ {formatTime(time)}
//           </span>
//         </div>
//       </div>

//       {/* MCQs */}
//       <div className="max-w-3xl mx-auto space-y-6">
//         {questions.map((q, index) => (
//           <div
//             key={index}
//             className={`p-6 rounded-xl shadow border ${
//               showResult
//                 ? "bg-gray-50 border-gray-300"
//                 : "bg-white border-gray-300"
//             }`}
//           >
//             <h2 className="text-lg font-medium mb-4">
//               {index + 1}. {q.q}
//             </h2>

//             <div className="space-y-2">
//               {q.options.map((option, idx) => {
//                 const isCorrect = option === q.answer;
//                 const isSelected = selected[index] === option;

//                 let bgClass = "bg-gray-100 border-gray-300 hover:bg-gray-200"; // default

//                 if (showResult) {
//                   if (isCorrect) bgClass = "bg-green-200 border-green-400"; // correct
//                   if (!isCorrect && isSelected) bgClass = "bg-red-200 border-red-400"; // wrong
//                 } else if (isSelected) {
//                   bgClass = "bg-blue-200 border-blue-400"; // selected before submission
//                 }

//                 return (
//                   <label
//                     key={idx}
//                     className={`block px-4 py-2 rounded-lg cursor-pointer border ${bgClass}`}
//                   >
//                     <input
//                       type="radio"
//                       name={`q${index}`}
//                       value={option}
//                       checked={isSelected}
//                       onChange={() =>
//                         !showResult &&
//                         setSelected({ ...selected, [index]: option })
//                       }
//                       className="hidden"
//                     />
//                     {option}
//                   </label>
//                 );
//               })}
//             </div>
//           </div>
//         ))}

//         {/* Submit */}
//         {questions.length > 0 && !showResult && (
//           <div className="text-center mt-4">
//             <button
//               onClick={handleSubmit}
//               className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg shadow-md"
//             >
//               Submit
//             </button>
//           </div>
//         )}

//         {/* Result message */}
//         {showResult && (
//           <div className="mt-6 p-4 bg-blue-100 text-blue-900 rounded-lg shadow-md text-center">
//             <p className="text-xl font-semibold">🎉 Test Submitted Successfully!</p>
//             <p className="mt-2">
//               Score: <span className="font-bold">{score}</span> / {questions.length}
//             </p>
//             <p className="mt-1">Time Taken: {formatTime(time)}</p>
//           </div>
//         )}

//         {questions.length === 0 && (
//           <p className="text-gray-500 text-center">No questions available for this subject.</p>
//         )}
//       </div>
//     </div>
//   );
// }



"use client";

import { useParams } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { db } from "/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import CheckAuth from "../../../lib/CheckAuth";

export default function PracticeMCQ() {
  const { id } = useParams();
  const [questions, setQuestions] = useState([]);
  const [selected, setSelected] = useState({});
  const [showResult, setShowResult] = useState({});
  const [time, setTime] = useState({});
  const [loading, setLoading] = useState(true);
  const [imageErrors, setImageErrors] = useState({});
  const [selectedImage, setSelectedImage] = useState(null);
  const [currentSet, setCurrentSet] = useState(0);
  const [setScores, setSetScores] = useState({});
  const [setStartTime, setSetStartTime] = useState({});
  const timerRef = useRef(null);

  // Fetch MCQs from Firestore
  useEffect(() => {
    async function fetchMCQs() {
      try {
        setLoading(true);
        const q = query(collection(db, "mcqs"), where("category", "==", id));
        const snap = await getDocs(q);
        const mcqsData = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        console.log("Fetched MCQs:", mcqsData); // Debug log
        setQuestions(mcqsData);
      } catch (error) {
        console.error("Error fetching MCQs:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchMCQs();
  }, [id]);

  // Start timer for current set
  useEffect(() => {
    // Initialize timer for current set if it doesn't exist
    if (!setStartTime[currentSet]) {
      setSetStartTime(prev => ({
        ...prev,
        [currentSet]: Date.now()
      }));
      setTime(prev => ({
        ...prev,
        [currentSet]: 0
      }));
    }

    // Clear previous timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    // Start new timer for current set
    timerRef.current = setInterval(() => {
      setTime(prev => ({
        ...prev,
        [currentSet]: Math.floor((Date.now() - (setStartTime[currentSet] || Date.now())) / 1000)
      }));
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [currentSet, setStartTime]);

  const handleSubmitSet = (setIndex) => {
    setShowResult(prev => ({
      ...prev,
      [setIndex]: true
    }));
    
    // Stop timer for this set
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    
    // Calculate score for this set
    const set = questionSets[setIndex];
    const score = set.filter((_, qIndex) => {
      const globalIndex = setIndex * 15 + qIndex;
      const question = questions[globalIndex];
      const selectedAnswer = selected[globalIndex];
      const correctAnswer = question?.answer;
      
      if (Array.isArray(question?.options)) {
        const selectedOption = question.options.find(opt => 
          typeof opt === 'string' ? opt === selectedAnswer : opt.text === selectedAnswer
        );
        const correctOption = question.options.find(opt => 
          typeof opt === 'string' ? opt === correctAnswer : opt.text === correctAnswer
        );
        return selectedOption && correctOption && selectedOption === correctOption;
      }
      return selectedAnswer === correctAnswer;
    }).length;
    
    setSetScores(prev => ({
      ...prev,
      [setIndex]: score
    }));
  };

  const formatTime = (seconds) => {
    if (!seconds && seconds !== 0) return "00:00";
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  // Group questions into sets of 15
  const questionSets = [];
  for (let i = 0; i < questions.length; i += 15) {
    questionSets.push(questions.slice(i, i + 15));
  }

  // Calculate total score across all sets
  const totalScore = Object.values(setScores).reduce((sum, score) => sum + score, 0);
  const totalQuestions = questions.length;

  return (
    <CheckAuth>
      <div className="min-h-screen bg-gray-100 text-gray-800 p-4 sm:p-6 lg:p-8">
        {/* Top bar */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 sm:mb-8 gap-4">
          <h1 className="text-2xl sm:text-3xl font-bold capitalize">{id} MCQs</h1>
          <div className="flex items-center gap-4">
            <div className="text-sm font-medium bg-blue-100 text-blue-800 px-3 py-1 rounded-lg border border-blue-200">
              ⏱ Set {currentSet + 1}: {formatTime(time[currentSet])}
            </div>
          </div>
        </div>

        {/* Sets Navigation */}
        <div className="max-w-6xl mx-auto mb-8">
          {!loading && questionSets.length > 0 && (
            <div className="bg-white rounded-xl shadow border border-gray-300 p-6">
              <h2 className="text-xl font-semibold mb-4 text-center">Select a Set</h2>
              <div className="flex flex-wrap justify-center gap-3">
                {questionSets.map((set, setIndex) => {
                  const answeredCount = set.filter((_, qIndex) => {
                    const globalIndex = setIndex * 15 + qIndex;
                    return selected[globalIndex];
                  }).length;
                  
                  const isCompleted = showResult[setIndex];
                  const score = setScores[setIndex] || 0;
                  const isActive = currentSet === setIndex;
                  const setTime = time[setIndex] || 0;
                  
                  return (
                    <button
                      key={setIndex}
                      onClick={() => setCurrentSet(setIndex)}
                      className={`p-4 rounded-lg border-2 transition-all min-w-[120px] ${
                        isActive
                          ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-md'
                          : isCompleted
                          ? 'border-green-500 bg-green-50 text-green-700 hover:border-green-600'
                          : 'border-gray-300 bg-gray-50 hover:border-gray-400 hover:bg-gray-100'
                      }`}
                    >
                      <div className="text-sm font-medium">Set {setIndex + 1}</div>
                      <div className="text-xs text-gray-600 mt-1">
                        {answeredCount}/{set.length} answered
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        Time: {formatTime(setTime)}
                      </div>
                      {isCompleted && (
                        <div className="text-xs font-medium text-green-600 mt-1">
                          Score: {score}/{set.length}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Questions for Selected Set */}
        <div className="max-w-4xl mx-auto">
          {loading && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading questions...</p>
            </div>
          )}
          
          {!loading && questionSets.length > 0 && (
            <div className="bg-white rounded-xl shadow border border-gray-300 overflow-hidden">
              <div className="p-6 space-y-6">
                {/* Set Header */}
                <div className="text-center pb-4 border-b border-gray-200">
                  <h3 className="text-xl font-semibold text-gray-800">
                    Set {currentSet + 1} - {questionSets[currentSet].length} Questions
                  </h3>
                  <div className="flex justify-center items-center gap-4 mt-2">
                    <p className="text-sm text-gray-600">
                      {questionSets[currentSet].filter((_, qIndex) => {
                        const globalIndex = currentSet * 15 + qIndex;
                        return selected[globalIndex];
                      }).length}/{questionSets[currentSet].length} answered
                    </p>
                    <div className="text-sm font-medium bg-blue-100 text-blue-800 px-2 py-1 rounded">
                      ⏱ {formatTime(time[currentSet])}
                    </div>
                  </div>
                </div>

                {/* Questions */}
                {questionSets[currentSet].map((q, localIndex) => {
                  const globalIndex = currentSet * 15 + localIndex;
                  
                  return (
                    <div
                      key={q.id}
                      className={`p-4 sm:p-6 rounded-xl border ${
                        showResult[currentSet] ? "bg-gray-50 border-gray-300" : "bg-gray-50 border-gray-200"
                      }`}
                    >
                      <h2 className="text-base sm:text-lg font-medium mb-3 sm:mb-4">
                        {localIndex + 1}. {q.question}
                      </h2>
                      
                      {q.questionImage && (
                        <div className="mb-4">
                          <Image 
                            src={q.questionImage} 
                            alt="Question image"
                            width={400}
                            height={192}
                            className="max-w-full max-h-48 object-contain border rounded cursor-pointer hover:opacity-80 transition-opacity"
                            onClick={() => setSelectedImage({ src: q.questionImage, alt: "Question image" })}
                            onError={(e) => {
                              console.error("Failed to load question image:", q.questionImage);
                              setImageErrors(prev => ({ ...prev, [`question-${q.id}`]: true }));
                            }}
                            onLoad={() => {
                              console.log("Question image loaded successfully:", q.questionImage);
                            }}
                          />
                          {imageErrors[`question-${q.id}`] && (
                            <p className="text-red-500 text-sm mt-1">Failed to load question image</p>
                          )}
                          <p className="text-xs text-gray-500 mt-1">Click image to enlarge</p>
                        </div>
                      )}

                      <div className="space-y-2">
                        {q.options.map((option, idx) => {
                          // Handle both old string format and new object format
                          const optionText = typeof option === 'string' ? option : option.text;
                          const optionImage = typeof option === 'object' ? option.image : null;
                          const isCorrect = optionText === q.answer;
                          const isSelected = selected[globalIndex] === optionText;

                          let bgClass = "bg-white border-gray-300 hover:bg-gray-100";

                          if (showResult[currentSet]) {
                            if (isCorrect) bgClass = "bg-green-200 border-green-400";
                            if (!isCorrect && isSelected) bgClass = "bg-red-200 border-red-400";
                          } else if (isSelected) {
                            bgClass = "bg-blue-200 border-blue-400";
                          }

                          return (
                            <label
                              key={idx}
                              className={`block px-3 sm:px-4 py-2 sm:py-3 rounded-lg cursor-pointer border ${bgClass} text-sm sm:text-base ${
                                showResult[currentSet] ? 'cursor-default' : ''
                              }`}
                            >
                              <input
                                type="radio"
                                name={`q${globalIndex}`}
                                value={optionText}
                                checked={isSelected}
                                onChange={() =>
                                  !showResult[currentSet] &&
                                  setSelected({ ...selected, [globalIndex]: optionText })
                                }
                                className="hidden"
                                disabled={showResult[currentSet]}
                              />
                              <div className="flex items-center gap-3">
                                <span>{optionText}</span>
                                {optionImage && (
                                  <Image 
                                    src={optionImage} 
                                    alt={`Option ${idx + 1} image`}
                                    width={96}
                                    height={64}
                                    unoptimized={optionImage.includes('cloudinary.com')}
                                    className="max-w-24 max-h-16 object-contain border rounded cursor-pointer hover:opacity-80 transition-opacity"
                                    onClick={() => setSelectedImage({ src: optionImage, alt: `Option ${idx + 1} image` })}
                                    onError={(e) => {
                                      console.error("Failed to load option image:", optionImage);
                                      setImageErrors(prev => ({ ...prev, [`option-${q.id}-${idx}`]: true }));
                                    }}
                                    onLoad={() => {
                                      console.log("Option image loaded successfully:", optionImage);
                                    }}
                                  />
                                )}
                                {imageErrors[`option-${q.id}-${idx}`] && optionImage && (
                                  <p className="text-red-500 text-xs">Image failed to load</p>
                                )}
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
                
                {/* Set Submit Button */}
                {!showResult[currentSet] && (
                  <div className="text-center mt-6 pt-4 border-t border-gray-200">
                    <button
                      onClick={() => handleSubmitSet(currentSet)}
                      className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg shadow-md text-base"
                    >
                      Submit Set {currentSet + 1}
                    </button>
                  </div>
                )}
                
                {/* Set Result */}
                {showResult[currentSet] && (
                  <div className="mt-6 p-4 bg-green-100 text-green-900 rounded-lg shadow-md text-center">
                    <p className="text-lg font-semibold">✅ Set {currentSet + 1} Completed!</p>
                    <p className="mt-2 text-base">
                      Score: <span className="font-bold">{setScores[currentSet]}</span> / {questionSets[currentSet].length}
                    </p>
                    <p className="mt-1 text-sm text-gray-600">
                      Time Taken: {formatTime(time[currentSet])}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Overall Progress Summary */}
          {Object.keys(showResult).length > 0 && (
            <div className="mt-6 p-6 bg-blue-100 text-blue-900 rounded-lg shadow-md text-center">
              <p className="text-xl font-semibold">📊 Overall Progress</p>
              <p className="mt-2 text-base">
                Total Score: <span className="font-bold">{totalScore}</span> / {totalQuestions}
              </p>
              <p className="mt-1 text-base">
                Sets Completed: {Object.keys(showResult).length} / {questionSets.length}
              </p>
              <div className="mt-2 space-y-1">
                {Object.keys(showResult).map(setIndex => (
                  <p key={setIndex} className="text-sm">
                    Set {parseInt(setIndex) + 1}: {formatTime(time[setIndex])}
                  </p>
                ))}
              </div>
            </div>
          )}

          {!loading && questions.length === 0 && (
            <p className="text-gray-500 text-center text-sm sm:text-base">
              No questions available for this subject.
            </p>
          )}
        </div>

        {/* Image Modal */}
        {selectedImage && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
            onClick={() => setSelectedImage(null)}
          >
            <div className="relative max-w-4xl max-h-full">
              <button
                onClick={() => setSelectedImage(null)}
                className="absolute -top-12 right-0 text-white text-2xl font-bold hover:text-gray-300 transition-colors"
              >
                ✕
              </button>
              <Image
                src={selectedImage.src}
                alt={selectedImage.alt}
                width={800}
                height={600}
                unoptimized={selectedImage.src.includes('cloudinary.com')}
                className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              />
              <p className="text-white text-center mt-4 text-sm">
                Click outside to close
              </p>
            </div>
          </div>
        )}
      </div>
    </CheckAuth>
  );
}
