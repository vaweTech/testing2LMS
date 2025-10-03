
"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { auth, db } from "../../../lib/firebase";
import {
  onAuthStateChanged,
  signOut
} from "firebase/auth";
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  deleteDoc,
  doc,
  updateDoc
} from "firebase/firestore";
// Cloudinary upload function
async function uploadToCloudinary(file) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || 'ml_default');
  
  try {
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload`,
      {
        method: 'POST',
        body: formData,
      }
    );
    
    if (!response.ok) {
      throw new Error('Upload failed');
    }
    
    const data = await response.json();
    return data.secure_url;
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    throw error;
  }
}
import CheckAdminAuth from "@/lib/CheckAdminAuth";

export default function ManageMCQs() {
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const [question, setQuestion] = useState("");
  const [questionImage, setQuestionImage] = useState("");
  const [options, setOptions] = useState(["", "", "", ""]);
  const [optionImages, setOptionImages] = useState(["", "", "", ""]);
  const [answer, setAnswer] = useState("");
  const [category, setCategory] = useState("java");
  const [description, setDescription] = useState("");
  const [editingId, setEditingId] = useState(null);

  const [mcqs, setMcqs] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("java");

  // Auth check
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        setIsAdmin(true); // Replace with real admin check
        loadMCQs("java");
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // Load MCQs by category
  async function loadMCQs(cat) {
    const q = query(collection(db, "mcqs"), where("category", "==", cat));
    const snap = await getDocs(q);
    setMcqs(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  }

  // Upload image to Cloudinary
  async function uploadImage(file) {
    if (!file) {
      console.log("No file provided to uploadImage");
      return "";
    }
    
    try {
      console.log("=== Starting Cloudinary upload ===");
      console.log("File name:", file.name);
      console.log("File size:", file.size, "bytes");
      console.log("File type:", file.type);
      
      // Check if Cloudinary environment variables are set
      if (!process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME) {
        console.error("Cloudinary cloud name not configured!");
        alert("Cloudinary configuration missing. Please check environment variables.");
        return "";
      }
      
      console.log("Uploading to Cloudinary...");
      const imageUrl = await uploadToCloudinary(file);
      console.log("=== Image uploaded successfully to Cloudinary ===");
      console.log("Image URL:", imageUrl);
      
      return imageUrl;
    } catch (error) {
      console.error("=== Error uploading image to Cloudinary ===");
      console.error("Error details:", error);
      console.error("Error message:", error.message);
      
      let errorMessage = "Failed to upload image to Cloudinary. ";
      if (error.message.includes('Upload failed')) {
        errorMessage += "Upload request failed. Please check your Cloudinary configuration.";
      } else {
        errorMessage += "Please try again.";
      }
      
      alert(errorMessage);
      return "";
    }
  }

  // Handle question image upload
  async function handleQuestionImageUpload(file) {
    console.log("Handling question image upload:", file.name);
    const imageUrl = await uploadImage(file);
    console.log("Question image URL set to:", imageUrl);
    setQuestionImage(imageUrl);
  }

  // Handle image upload for specific option
  async function handleImageUpload(file, index) {
    console.log("Handling option image upload:", file.name, "for index:", index);
    const imageUrl = await uploadImage(file);
    console.log("Option image URL set to:", imageUrl, "for index:", index);
    const newImages = [...optionImages];
    newImages[index] = imageUrl;
    setOptionImages(newImages);
  }

  // Save or Update MCQ
  async function saveMCQ() {
    const filteredOptions = options.filter(opt => opt.trim() !== "");
    if (!question || filteredOptions.length < 2 || !answer) {
      alert("Please fill question, at least 2 options, and select the correct answer.");
      return;
    }

    // Create options with images
    const optionsWithImages = options.map((opt, index) => ({
      text: opt,
      image: optionImages[index] || ""
    })).filter(opt => opt.text.trim() !== "");

    const payload = {
      question,
      questionImage: questionImage || "",
      options: optionsWithImages,
      answer,
      category,
      description: description?.trim() || ""
    };

    console.log("Saving MCQ with payload:", payload);
    console.log("Question image:", questionImage);
    console.log("Option images:", optionImages);

    try {
      if (editingId) {
        await updateDoc(doc(db, "mcqs", editingId), payload);
        console.log("MCQ updated successfully");
      } else {
        const docRef = await addDoc(collection(db, "mcqs"), payload);
        console.log("MCQ saved successfully with ID:", docRef.id);
      }
      
      setQuestion("");
      setQuestionImage("");
      setOptions(["", "", "", ""]);
      setOptionImages(["", "", "", ""]);
      setAnswer("");
      setCategory("java");
      setDescription("");
      setEditingId(null);
      loadMCQs(selectedCategory);
    } catch (error) {
      console.error("Error saving MCQ:", error);
      alert("Failed to save MCQ. Please try again.");
    }
  }

  function startEdit(mcq) {
    setEditingId(mcq.id);
    setQuestion(mcq.question || "");
    setQuestionImage(mcq.questionImage || "");
    
    // Handle options with images
    const baseOptions = Array.isArray(mcq.options) ? mcq.options : [];
    const padded = [...baseOptions, ...Array(Math.max(0, 4 - baseOptions.length)).fill({ text: "", image: "" })];
    
    const optionTexts = padded.slice(0, 4).map(opt => 
      typeof opt === 'string' ? opt : (opt.text || "")
    );
    const optionImages = padded.slice(0, 4).map(opt => 
      typeof opt === 'string' ? "" : (opt.image || "")
    );
    
    setOptions(optionTexts);
    setOptionImages(optionImages);
    setAnswer(mcq.answer || "");
    setCategory(mcq.category || "java");
    setDescription(mcq.description || "");
  }

  function cancelEdit() {
    setEditingId(null);
    setQuestion("");
    setQuestionImage("");
    setOptions(["", "", "", ""]);
    setOptionImages(["", "", "", ""]);
    setAnswer("");
    setCategory("java");
    setDescription("");
  }

  // Delete MCQ
  async function deleteMCQ(id) {
    if (confirm("Are you sure you want to delete this question?")) {
      await deleteDoc(doc(db, "mcqs", id));
      loadMCQs(selectedCategory);
    }
  }

  function handleCategoryChange(e) {
    setSelectedCategory(e.target.value);
    loadMCQs(e.target.value);
  }

  // Test Cloudinary connection
  async function testCloudinaryConnection() {
    try {
      console.log("=== Testing Cloudinary Connection ===");
      console.log("Cloud name:", process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME);
      console.log("Upload preset:", process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET);
      
      // Try to create a simple test image
      const canvas = document.createElement('canvas');
      canvas.width = 100;
      canvas.height = 100;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#4F46E5';
      ctx.fillRect(0, 0, 100, 100);
      ctx.fillStyle = 'white';
      ctx.font = '16px Arial';
      ctx.fillText('Test', 30, 55);
      
      canvas.toBlob(async (blob) => {
        const testFile = new File([blob], 'test.png', { type: 'image/png' });
        
        console.log("Test file created:", testFile.name, testFile.size, "bytes");
        
        const testURL = await uploadToCloudinary(testFile);
        console.log("Test upload successful:", testURL);
        
        alert("Cloudinary is working correctly!");
      }, 'image/png');
      
    } catch (error) {
      console.error("Cloudinary test failed:", error);
      alert(`Cloudinary test failed: ${error.message}`);
    }
  }

  if (loading) return <div>Loading...</div>;
  if (!user || !isAdmin) return <div>Access Denied</div>;

  return (
    <CheckAdminAuth>
      <div className="p-6 bg-gray-100 min-h-screen">
        <div className="flex justify-between items-center mb-6">
          <Link href="/Admin">
            <button className="bg-gray-500 text-white px-4 py-2 rounded">Back</button>
          </Link>
          <h1 className="text-2xl font-bold">Manage MCQs</h1>
          <div className="flex gap-2">
            {process.env.NODE_ENV === 'development' && (
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    console.log("Current state:");
                    console.log("Question:", question);
                    console.log("Question Image:", questionImage);
                    console.log("Options:", options);
                    console.log("Option Images:", optionImages);
                    console.log("Answer:", answer);
                    console.log("Category:", category);
                  }}
                  className="bg-blue-500 text-white px-4 py-2 rounded text-sm"
                >
                  Debug State
                </button>
                <button
                  onClick={testCloudinaryConnection}
                  className="bg-green-500 text-white px-4 py-2 rounded text-sm"
                >
                  Test Cloudinary
                </button>
              </div>
            )}
            <button onClick={() => signOut(auth)} className="bg-red-600 text-white px-4 py-2 rounded">
              Logout
            </button>
          </div>
        </div>

        {/* Add MCQ */}
        <div className="bg-white p-6 rounded shadow mb-8">
          <h2 className="text-lg font-semibold mb-3">Add MCQ</h2>

          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="border p-2 w-full mb-3"
          >
            <option value="java">Java</option>
            <option value="c">C</option>
            <option value="html">HTML/CSS</option>
            <option value="python">Python</option>
            <option value="javascript">JavaScript</option>
          </select>

          <input
            type="text"
            placeholder="Enter question"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            className="border p-2 w-full mb-3"
          />

          {/* Question Image Upload */}
          <div className="mb-3">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Question Image (Optional)
            </label>
            <div className="flex gap-2">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  if (e.target.files[0]) {
                    handleQuestionImageUpload(e.target.files[0]);
                  }
                }}
                className="border p-2 flex-1"
              />
              {questionImage && (
                <button
                  onClick={() => setQuestionImage("")}
                  className="bg-red-500 text-white px-3 py-2 rounded text-sm"
                >
                  Remove
                </button>
              )}
            </div>
            {questionImage && (
              <div className="mt-2">
                <Image 
                  src={questionImage} 
                  alt="Question image"
                  width={200}
                  height={128}
                  className="max-w-xs max-h-32 object-contain border rounded"
                />
              </div>
            )}
          </div>

          {/* Optional description */}
          <textarea
            placeholder="Enter optional description (e.g., explanation, context)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="border p-2 w-full mb-3"
            rows={3}
          />

          {options.map((opt, idx) => (
            <div key={idx} className="mb-4 p-3 border rounded">
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  placeholder={`Option ${idx + 1}`}
                  value={opt}
                  onChange={(e) => {
                    const newOpts = [...options];
                    newOpts[idx] = e.target.value;
                    setOptions(newOpts);
                    if (answer === opt) setAnswer("");
                  }}
                  className="border p-2 flex-1"
                />
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    if (e.target.files[0]) {
                      handleImageUpload(e.target.files[0], idx);
                    }
                  }}
                  className="border p-2"
                />
              </div>
              
              {/* Display uploaded image */}
              {optionImages[idx] && (
                <div className="mt-2">
                  <Image 
                    src={optionImages[idx]} 
                    alt={`Option ${idx + 1} image`}
                    width={200}
                    height={128}
                    className="max-w-xs max-h-32 object-contain border rounded"
                  />
                  <button
                    onClick={() => {
                      const newImages = [...optionImages];
                      newImages[idx] = "";
                      setOptionImages(newImages);
                    }}
                    className="ml-2 bg-red-500 text-white px-2 py-1 rounded text-sm"
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>
          ))}

          {/* Select correct answer from entered options */}
          <select
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            className="border p-2 w-full mb-3"
          >
            <option value="">Select correct answer</option>
            {options
              .filter(opt => opt.trim() !== "")
              .map((opt, i) => (
                <option key={i} value={opt}>{opt}</option>
              ))}
          </select>

          <div className="flex gap-3">
            <button onClick={saveMCQ} className="bg-green-600 text-white px-4 py-2 rounded">
              {editingId ? "Update MCQ" : "Save MCQ"}
            </button>
            {editingId && (
              <button onClick={cancelEdit} className="bg-gray-400 text-white px-4 py-2 rounded">
                Cancel
              </button>
            )}
          </div>
        </div>

        {/* Show MCQs */}
        <div className="bg-white p-6 rounded shadow">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Existing MCQs</h2>
            <select
              value={selectedCategory}
              onChange={handleCategoryChange}
              className="border p-2"
            >
              <option value="java">Java</option>
              <option value="c">C</option>
              <option value="html">HTML/CSS</option>
              <option value="python">Python</option>
              <option value="javascript">JavaScript</option>
            </select>
          </div>

          {mcqs.length === 0 && <p>No MCQs found for this category.</p>}

          {mcqs.map((m) => (
            <div key={m.id} className="bg-gray-50 p-3 rounded mt-2 flex justify-between items-start">
              <div className="flex-1">
                <p className="font-bold">{m.question}</p>
                {m.questionImage && (
                  <div className="mt-2">
                    <Image 
                      src={m.questionImage} 
                      alt="Question image"
                      width={200}
                      height={128}
                      className="max-w-xs max-h-32 object-contain border rounded"
                    />
                  </div>
                )}
                {m.description && (
                  <p className="text-sm text-gray-600 mt-1">Description: {m.description}</p>
                )}
                <ul className="list-disc ml-6">
                  {m.options.map((opt, i) => (
                    <li key={i} className="mb-2">
                      <div className="flex items-center gap-2">
                        <span>{typeof opt === 'string' ? opt : opt.text}</span>
                        {typeof opt === 'object' && opt.image && (
                          <Image 
                            src={opt.image} 
                            alt={`Option ${i + 1} image`}
                            width={200}
                            height={96}
                            className="max-w-xs max-h-24 object-contain border rounded"
                          />
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
                <p className="text-green-600">Answer: {m.answer}</p>
              </div>
              <div className="flex gap-2 h-fit">
                <button
                  onClick={() => startEdit(m)}
                  className="bg-blue-500 text-white px-3 py-1 rounded"
                >
                  Edit
                </button>
                <button
                  onClick={() => deleteMCQ(m.id)}
                  className="bg-red-500 text-white px-3 py-1 rounded"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </CheckAdminAuth>
  );
}
