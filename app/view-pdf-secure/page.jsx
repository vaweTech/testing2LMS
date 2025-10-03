"use client";

import { useSearchParams } from "next/navigation";
import { ArrowLeft, FileText, AlertCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { Suspense, useState, useEffect, useCallback } from "react";

function SecurePDFViewerContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pdfUrl = searchParams.get("url");
  const title = searchParams.get("title") || "Document";
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Convert Google Drive sharing URL to embed URL
  const convertToEmbedUrl = useCallback(async (url) => {
    if (!url) return null;
    
    try {
      const response = await fetch(`/api/secure-pdf?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}`);
      if (response.ok) {
        const data = await response.json();
        return {
          embedUrl: data.embedUrl,
          fileId: data.fileId,
          method: 'api'
        };
      }
    } catch (error) {
      console.error('Error fetching secure PDF URL:', error);
    }
    
    // Fallback: Extract file ID from Google Drive URL directly
    let fileId = null;
    
    // Handle different Google Drive URL formats
    const patterns = [
      /\/d\/([a-zA-Z0-9-_]+)/,  // Standard /d/FILE_ID/ format
      /[?&]id=([a-zA-Z0-9-_]+)/, // ?id=FILE_ID format
      /\/file\/d\/([a-zA-Z0-9-_]+)/, // /file/d/FILE_ID format
    ];
    
    // Convert edit URLs to view URLs automatically
    let processedUrl = url;
    if (url.includes('/edit')) {
      processedUrl = url.replace('/edit', '/view');
      console.log('Converted edit URL to view URL:', processedUrl);
    }
    
    for (const pattern of patterns) {
      const match = processedUrl.match(pattern);
      if (match) {
        fileId = match[1];
        break;
      }
    }
    
    if (fileId) {
      // Use Google Drive preview with enhanced security parameters
      return {
        embedUrl: `https://drive.google.com/file/d/${fileId}/preview?usp=sharing&rm=minimal&ui=1&chrome=false&toolbar=0&navpanes=0&scrollbar=0&download=0&print=0`,
        fallbackUrl: `https://drive.google.com/file/d/${fileId}/view?usp=sharing&rm=minimal&ui=1`,
        fileId,
        method: 'direct'
      };
    }
    
    return null;
  }, [title]);

  const [embedData, setEmbedData] = useState(null);
  const [showFallback, setShowFallback] = useState(false);

  useEffect(() => {
    const fetchEmbedUrl = async () => {
      try {
        const data = await convertToEmbedUrl(pdfUrl);
        if (data) {
          setEmbedData(data);
          setLoading(false);
        } else {
          setError("Invalid Google Drive URL format. Please ensure the file is shared publicly.");
          setLoading(false);
        }
      } catch (error) {
        setError("Failed to load document URL");
        setLoading(false);
      }
    };

    if (pdfUrl) {
      fetchEmbedUrl();
    } else {
      setLoading(false);
    }
  }, [pdfUrl, title, convertToEmbedUrl]);

  if (!pdfUrl) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-sky-100 via-blue-50 to-cyan-100 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-800 mb-4">No PDF URL provided</h1>
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition"
          >
            <ArrowLeft size={18} /> Go Back
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-sky-100 via-blue-50 to-cyan-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading document...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-sky-100 via-blue-50 to-cyan-100 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Error Loading Document</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <div className="flex flex-col gap-3">
            <button
              onClick={() => router.back()}
              className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition"
            >
              Go Back
            </button>
            <a
              href={pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              Open Original Link
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-100 via-blue-50 to-cyan-100">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition"
            >
              <ArrowLeft size={18} /> Back
            </button>
            <div className="flex items-center gap-2">
              <FileText className="text-red-600" size={20} />
              <h1 className="text-lg font-semibold text-gray-800 truncate">
                {title}
              </h1>
              <span className="text-sm text-gray-500 bg-red-100 text-red-800 px-2 py-1 rounded">
                PDF
              </span>
            </div>
          </div>
          <div className="text-sm text-gray-500">
            Secure Document Viewer
          </div>
        </div>
      </div>

      {/* PDF Viewer */}
      <div className="max-w-7xl mx-auto p-4">
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div 
            className="w-full aspect-square min-h-[600px] relative overflow-hidden"
            style={{
              transform: 'scale(1.1)',
              transformOrigin: 'center center'
            }}
          >
            <iframe
              src={showFallback && embedData?.fallbackUrl ? embedData.fallbackUrl : embedData?.embedUrl}
              title={title}
              className="w-full h-full border-0"
              allow="fullscreen"
              loading="lazy"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                border: 'none',
                outline: 'none'
              }}
              onLoad={() => console.log('PDF iframe loaded successfully')}
              onError={() => {
                console.log('Primary embed failed, trying fallback');
                if (embedData?.fallbackUrl && !showFallback) {
                  setShowFallback(true);
                } else {
                  setError("Failed to load document. The file may not be publicly accessible or the URL format is incorrect.");
                }
              }}
            />
          </div>
          
          {/* Help section for common issues */}
          <div className="p-4 bg-blue-50 border-t border-blue-200">
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-2">Having trouble viewing the document?</p>
              <ul className="list-disc list-inside space-y-1 text-blue-700">
                <li>Document is displayed at 110% zoom for better readability</li>
                <li>Ensure the Google Drive file is set to &quot;Anyone with the link can view&quot;</li>
                <li>Check that the file is a PDF format</li>
                <li>Try refreshing the page if the document doesn&apos;t load</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SecurePDFViewer() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-b from-sky-100 via-blue-50 to-cyan-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-600 mx-auto mb-4"></div>
          <h1 className="text-2xl font-bold text-gray-800 mb-4">Loading...</h1>
        </div>
      </div>
    }>
      <SecurePDFViewerContent />
    </Suspense>
  );
}
