"use client";
import { useState } from "react";
import CodeEditor from "../../components/CodeEditor";
import CheckAuth from "../../lib/CheckAuth";

// Default starter code snippets for each language
const defaultSnippets = {
  java: `public class Main {
    public static void main(String[] args) {
        System.out.println("Hello, Java!");
    }
}`,
  python: `print("Hello, Python!")`,
  c: `#include <stdio.h>
int main() {
    printf("Hello, C!\\n");
    return 0;
}`,
  javascript: `console.log("Hello, JavaScript!");`
};

export default function CompilerPage() {
  const [lang, setLang] = useState("java");
  const [code, setCode] = useState(defaultSnippets.java);
  const [stdin, setStdin] = useState("");
  const [output, setOutput] = useState("");

  const handleLangChange = (e) => {
    const newLang = e.target.value;
    setLang(newLang);
    setCode(defaultSnippets[newLang] || "");
  };

  const runCode = async () => {
    try {
      const res = await fetch("/api/compile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          language: lang,
          source: code,
          stdin: stdin
        })
      });
      const data = await res.json();
      if (res.ok) {
        setOutput(data.stdout || data.stderr || "No output");
      } else {
        setOutput("Error: " + data.error);
      }
    } catch (err) {
      setOutput("Request failed: " + err.message);
    }
  };

  return (
    <CheckAuth>
      <div className="max-w-4xl mx-auto p-4 sm:p-6">
        <h1 className="text-xl sm:text-2xl font-bold mb-4">Online Compiler</h1>

        {/* Language Selector */}
        <select
          value={lang}
          onChange={handleLangChange}
          className="border p-2 sm:p-3 rounded mb-4 text-sm sm:text-base w-full sm:w-auto"
        >
          <option value="java">Java</option>
          <option value="python">Python</option>
          <option value="c">C</option>
          <option value="javascript">JavaScript</option>
        </select>

        {/* Code Editor */}
        <div className="mb-4">
          <CodeEditor language={lang} code={code} setCode={setCode} />
        </div>

        {/* Standard Input */}
        <textarea
          value={stdin}
          onChange={(e) => setStdin(e.target.value)}
          placeholder="Standard input (optional)"
          className="w-full h-16 sm:h-20 border border-gray-300 rounded p-2 sm:p-3 mt-4 text-sm sm:text-base"
        />

        {/* Run Button */}
        <button
          onClick={runCode}
          className="bg-blue-500 text-white px-4 py-2 sm:py-3 rounded mt-4 hover:bg-blue-600 text-sm sm:text-base font-medium"
        >
          Run Code
        </button>

        {/* Output */}
        <pre className="bg-gray-100 p-3 sm:p-4 mt-4 rounded whitespace-pre-wrap text-xs sm:text-sm">{output}</pre>
      </div>
    </CheckAuth>
  );
}