import React from 'react';
import { DesignIteration } from '../types';
import { LoaderIcon, AlertTriangleIcon, DownloadIcon } from './Icons';

interface ResultDisplayProps {
  originalImageUrl: string | null;
  designHistory: DesignIteration[];
  isLoading: boolean;
  error: string | null;
  onSelect: (iterationIndex: number, resultIndex: number) => void;
  activeImageUrl: string | null;
}

export const ResultDisplay: React.FC<ResultDisplayProps> = ({ originalImageUrl, designHistory, isLoading, error, onSelect, activeImageUrl }) => {
  const handleDownload = (imageUrl: string) => {
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `design-result-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-gray-50 rounded-lg p-8 text-center">
        <LoaderIcon className="w-12 h-12 text-indigo-500 animate-spin mb-4" />
        <h3 className="text-xl font-semibold text-gray-700">Generating your design...</h3>
        <p className="text-gray-500 mt-2">The AI is working its magic. This might take a moment.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-red-50 text-red-700 rounded-lg p-8 text-center">
        <AlertTriangleIcon className="w-12 h-12 mb-4" />
        <h3 className="text-xl font-semibold">An Error Occurred</h3>
        <p className="mt-2">{error}</p>
      </div>
    );
  }

  if (!originalImageUrl) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-gray-50 rounded-lg p-8 text-center">
        <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
        <h3 className="text-xl font-semibold text-gray-700">Your results will appear here</h3>
        <p className="text-gray-500 mt-2">Upload an image, describe your changes, and click "Visualize" to see the magic happen.</p>
      </div>
    );
  }
  
  const isHistoryEmpty = designHistory.length === 0;

  return (
    <div className="h-full overflow-y-auto pr-2 space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-800 mb-4">Original Image</h2>
        <img src={originalImageUrl} alt="Original" className={`w-full h-auto rounded-lg shadow-md ${activeImageUrl === originalImageUrl ? 'ring-4 ring-indigo-500' : ''}`} />
      </div>

      {isHistoryEmpty && !isLoading && (
        <div className="text-center text-gray-500 pt-8">
            <p>Your design history will appear here.</p>
        </div>
      )}

      {designHistory.map((iteration, iterIndex) => (
        <div key={iterIndex}>
          <div className="mb-4">
            <h3 className="text-xl font-bold text-gray-800">Iteration {iterIndex + 1}</h3>
            <p className="text-sm text-gray-600 bg-gray-100 p-2 rounded-md mt-1">
              <strong>Prompt:</strong> {iteration.prompt}
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {iteration.results.map((result, resIndex) => (
              <div 
                key={resIndex} 
                className="bg-white rounded-lg shadow-md overflow-hidden cursor-pointer group"
                onClick={() => onSelect(iterIndex, resIndex)}
              >
                <div className={`relative ${activeImageUrl === result.imageUrl ? 'ring-4 ring-indigo-500' : ''}`}>
                  <img src={result.imageUrl} alt={`Generated design ${iterIndex + 1}-${resIndex + 1}`} className="w-full h-auto" />
                  <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all duration-300 flex items-center justify-center">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDownload(result.imageUrl); }}
                      className="opacity-0 group-hover:opacity-100 transform group-hover:scale-100 scale-90 transition-all duration-300 bg-white text-gray-800 font-semibold py-2 px-4 rounded-lg shadow-lg flex items-center gap-2"
                    >
                      <DownloadIcon className="w-5 h-5" />
                      Download
                    </button>
                  </div>
                </div>
                {result.text && result.text !== "No text description was generated." && (
                    <div className="p-3">
                        <p className="text-gray-600 text-sm">{result.text}</p>
                    </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};