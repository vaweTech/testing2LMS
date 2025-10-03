"use client";

import { useRouter } from "next/navigation";
import { useState } from 'react';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import CheckAdminAuth from "@/lib/CheckAdminAuth";

export default function AddQuestionPage() {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Easy');
  const [testCases, setTestCases] = useState([{ input: '', output: '', hidden: false }]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleAddTestCase = () => {
    setTestCases([...testCases, { input: '', output: '', hidden: false }]);
  };

  const handleTestCaseChange = (index, field, value) => {
    const updated = [...testCases];
    updated[index][field] = value;
    setTestCases(updated);
  };

  const handleSave = async () => {
    if (!title.trim()) {
      alert("Title cannot be empty");
      return;
    }
    if (!description.trim()) {
      alert("Description cannot be empty");
      return;
    }

    setLoading(true);
    try {
      await addDoc(collection(db, 'questions'), {
        title,
        description,
        category,
        testCases
      });
      alert('✅ Question saved!');
      setTitle('');
      setDescription('');
      setCategory('Easy');
      setTestCases([{ input: '', output: '', hidden: false }]);
    } catch (err) {
      console.error('Error saving question:', err);
      alert('❌ Failed to save question');
    }
    setLoading(false);
  };

  return (
    <CheckAdminAuth>
      <div className="p-6 max-w-3xl mx-auto">
        <button
          onClick={() => router.back()}
          className="mb-4 bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded"
        >
          ⬅ Back
        </button>

        <h1 className="text-2xl font-bold mb-4">Add New Question</h1>

        {/* Title */}
        <label className="block font-medium mb-1">Title:</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full border border-gray-300 rounded p-2 mb-4"
          placeholder="Enter question title"
        />

        {/* Description */}
        <label className="block font-medium mb-1">Description:</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          className="w-full border border-gray-300 rounded p-2 mb-4"
          placeholder="Enter question description"
        />

        {/* Category */}
        <label className="block font-medium mb-1">Category:</label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="border border-gray-300 rounded p-2 mb-4"
        >
          <option value="Easy">Easy</option>
          <option value="Medium">Medium</option>
          <option value="Hard">Hard</option>
        </select>

        {/* Test cases */}
        <h3 className="text-lg font-semibold mb-2">Test Cases</h3>
        {testCases.map((test, index) => (
          <div
            key={index}
            className="border border-gray-300 p-3 rounded mb-3 bg-gray-50"
          >
            <input
              type="text"
              placeholder="Input"
              value={test.input}
              onChange={(e) => handleTestCaseChange(index, 'input', e.target.value)}
              className="w-full border border-gray-300 rounded p-2 mb-2"
            />
            <input
              type="text"
              placeholder="Expected Output"
              value={test.output}
              onChange={(e) => handleTestCaseChange(index, 'output', e.target.value)}
              className="w-full border border-gray-300 rounded p-2 mb-2"
            />
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={test.hidden}
                onChange={(e) => handleTestCaseChange(index, 'hidden', e.target.checked)}
              /> 
              Hidden
            </label>
          </div>
        ))}

        {/* Add test case button */}
        <button
          onClick={handleAddTestCase}
          className="mb-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
        >
          ➕ Add Test Case
        </button>

        <br />

        {/* Save button */}
        <button
          onClick={handleSave}
          disabled={loading}
          className={`px-6 py-2 rounded text-white ${loading ? 'bg-gray-400' : 'bg-green-600 hover:bg-green-700'}`}
        >
          {loading ? 'Saving...' : 'Save Question'}
        </button>
      </div>
    </CheckAdminAuth>
  );
}
