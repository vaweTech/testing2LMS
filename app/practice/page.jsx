


"use client";

import CheckAuth from "../../lib/CheckAuth";
import { useRouter } from "next/navigation";
import Image from "next/image";

export default function PracticePage() {
  const router = useRouter();

  const topics = [
    {
      id: "java",
      name: "Java",
      description: "Test your Java knowledge with MCQs.",
      image: "/javaimage.jpg",
    },
    {
      id: "crt",
      name: "CRT",
      description: "Aptitude & reasoning practice for placements.",
      image: "/crtimage.jpeg",
    },
    {
      id: "c",
      name: "C Programming",
      description: "Fundamentals and advanced C language practice.",
      image: "/cimage.jpg",
    },
    {
      id: "python",
      name: "Python",
      description: "Python coding & problem-solving MCQs.",
      image: "/pythonimge.jpeg",
    },
    {
      id: "react",
      name: "React",
      description: "Frontend mastery with React MCQs.",
      image: "/react.jpg",
    },
  ];

  return (
    <CheckAuth>
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-800 p-4 sm:p-6 lg:p-10 text-white">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-center mb-8 sm:mb-10 lg:mb-12 px-4">
          Practice <span className="text-cyan-400">session</span>
        </h1>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 lg:gap-10">
          {topics.map((topic) => (
            <div
              key={topic.id}
              className="bg-white/10 border border-gray-700 rounded-xl sm:rounded-2xl shadow-lg overflow-hidden hover:shadow-cyan-500/40 hover:border-cyan-400 transition cursor-pointer"
            >
              <Image
                src={topic.image}
                alt={topic.name}
                width={400}
                height={160}
                className="h-32 sm:h-40 w-full object-cover"
              />
              <div className="p-4 sm:p-6">
                <h2 className="text-lg sm:text-xl lg:text-2xl font-semibold mb-2">{topic.name}</h2>
                <p className="text-gray-300 mb-3 sm:mb-4 text-xs sm:text-sm">{topic.description}</p>
                <button
                  onClick={() => router.push(`/practice/${topic.id}`)}
                  className="px-3 sm:px-4 py-2 bg-cyan-600 hover:bg-cyan-700 rounded-lg shadow-md text-white font-medium text-sm sm:text-base"
                >
                  Click to Start →
                </button>
              </div>
            </div>
          ))}

          {/* Extra Card: Coding Questions */}
          <div
            className="bg-white/10 border border-gray-700 rounded-xl sm:rounded-2xl shadow-lg overflow-hidden hover:shadow-cyan-500/40 hover:border-cyan-400 transition cursor-pointer"
          >
            <Image
              src="/codingimage.jpg"
              alt="Coding Questions"
              width={400}
              height={160}
              className="h-32 sm:h-40 w-full object-cover"
            />
            <div className="p-4 sm:p-6">
              <h2 className="text-lg sm:text-xl lg:text-2xl font-semibold mb-2">Coding Questions</h2>
              <p className="text-gray-300 mb-3 sm:mb-4 text-xs sm:text-sm">
                Solve coding challenges and improve your problem-solving skills.
              </p>
              <button
                onClick={() => router.push("/practice/coding")}
                className="px-3 sm:px-4 py-2 bg-cyan-600 hover:bg-cyan-700 rounded-lg shadow-md text-white font-medium text-sm sm:text-base"
              >
                Start Coding →
              </button>
            </div>
          </div>
        </div>
      </div>
    </CheckAuth>
  );
}
