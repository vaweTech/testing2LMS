"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { db, firestoreHelpers } from "../../lib/firebase";
import CheckAuth from "../../lib/CheckAuth";
import Image from "next/image";
import { createCourseUrl } from "../../lib/urlUtils";


export default function CoursesPage() {
  const router = useRouter();
  const [courses, setCourses] = useState([]);

  // Function to get the appropriate image based on course title
  const getCourseImage = (courseTitle) => {
    const title = courseTitle.toLowerCase();
    
    if (title.includes('java')) {
      return '/javaimage.jpg';
    } else if (title.includes('python')) {
      return '/pythonimge.jpeg';
    } else if (title.includes('crt') || title.includes('certificate')) {
      return '/crtimage.jpeg';
    } else if (title.includes('workshop')) {
      return '/workshopimg.jpg';
    } else {
      // Default fallback image
      return '/LmsImg.jpg';
    }
  };

  useEffect(() => {
    async function fetchCourses() {
      try {
        const snap = await firestoreHelpers.getDocs(
          firestoreHelpers.collection(db, "courses")
        );
        setCourses(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      } catch (err) {
        console.error("❌ Error fetching courses:", err);
      }
    }
    fetchCourses();
  }, []);

  return (
    <CheckAuth>
      <div className="min-h-screen bg-gradient-to-br from-black via-gray-700 to-blue-800 p-4 sm:p-6 lg:p-10">
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-center mb-4 sm:mb-6 lg:mb-8 text-white tracking-wide px-4">
          Choose Your <span className="text-cyan-400">Learning Path</span>
        </h1>
        <p className="text-center text-gray-300 mb-8 sm:mb-12 lg:mb-14 px-4 max-w-3xl mx-auto">
          Explore our comprehensive programming courses designed to help you build a successful career in software development.
        </p>

        {courses.length === 0 ? (
          <p className="text-center text-gray-300">No courses available.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 lg:gap-12">
            {courses.map((course) => (
              <div
                key={course.id}
                onClick={() => router.push(`/courses/${createCourseUrl(course.title)}`)}
                className="relative group backdrop-blur-lg bg-white/10 rounded-2xl sm:rounded-3xl overflow-hidden 
                           border border-white/20 shadow-lg cursor-pointer 
                           hover:border-cyan-400 hover:shadow-cyan-500/50 transition-all duration-300"
              >
                {/* Course Image */}
                <div className="relative overflow-hidden rounded-t-2xl sm:rounded-t-3xl">
                  <Image
                    src={getCourseImage(course.title)}
                    alt={`VAWE LMS - ${course.title}`}
                    width={400}
                    height={200}
                    className="w-full h-40 sm:h-48 object-cover transition-transform duration-300 hover:scale-105"
                    onError={(e) => {
                      e.target.src = "/LmsImg.jpg";
                    }}
                  />
                </div>

                {/* Content */}
                <div className="p-4 sm:p-6 text-white">
                  <h3 className="text-lg sm:text-xl lg:text-2xl font-semibold mb-2 sm:mb-3">{course.title}</h3>
                  <p className="text-gray-300 text-xs sm:text-sm mb-3 sm:mb-4 line-clamp-2">{course.description}</p>

                  {/* Button with neon glow */}
                  <button className="px-3 sm:px-4 py-2 bg-cyan-500/20 border border-cyan-400 text-cyan-300 
                                     rounded-lg text-xs sm:text-sm font-medium 
                                     group-hover:bg-cyan-500/40 group-hover:text-white
                                     shadow-md group-hover:shadow-cyan-400/60 transition">
                    View Course →
                  </button>
                </div>

                {/* Neon border effect */}
                <div className="absolute inset-0 border-2 border-transparent group-hover:border-cyan-400 rounded-2xl sm:rounded-3xl transition"></div>
              </div>
            ))}
          </div>
        )}
      </div>
    </CheckAuth>
  );
}

//-------------------------------------------------------------------

