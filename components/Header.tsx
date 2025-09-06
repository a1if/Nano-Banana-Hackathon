import React from 'react';
import { PaintBrushIcon, RefreshCwIcon } from './Icons';

interface HeaderProps {
  onReset: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onReset }) => {
  return (
    <header className="bg-white shadow-md">
      <div className="container mx-auto px-4 md:px-8 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <PaintBrushIcon className="h-8 w-8 text-indigo-600" />
          <h1 className="text-2xl font-bold text-gray-800 tracking-tight">
            Interior AI Visualizer
          </h1>
        </div>
        <div className="flex items-center space-x-4">
            <button
                onClick={onReset}
                className="flex items-center space-x-2 text-gray-500 hover:text-indigo-600 transition-colors"
                title="Start Over"
            >
                <RefreshCwIcon className="h-5 w-5" />
                <span className="text-sm font-medium hidden sm:inline">Start Over</span>
            </button>
            <a 
              href="https://github.com/google/genai-js" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-gray-500 hover:text-indigo-600 transition-colors"
              title="View on GitHub"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path></svg>
            </a>
        </div>
      </div>
    </header>
  );
};