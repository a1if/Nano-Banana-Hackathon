import React from 'react';
import { SparklesIcon, LoaderIcon } from './Icons';

interface PromptInputProps {
  value: string;
  onChange: (value: string) => void;
  onGenerate: () => void;
  isLoading: boolean;
  disabled: boolean;
}

const examplePrompts = [
    "Fill the area I marked in red with a large ficus plant.",
    "Change the wall color where I drew to a calming sage green.",
    "Turn the marked section of the floor into a patterned rug.",
    "Add a window to the wall where I drew the blue rectangle.",
];

export const PromptInput: React.FC<PromptInputProps> = ({ value, onChange, onGenerate, isLoading, disabled }) => {
    
    const handleExampleClick = (prompt: string) => {
        onChange(prompt);
    }
    
  return (
    <div className="space-y-4 bg-gray-800 p-4 rounded-xl shadow-inner">
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={disabled ? "Please upload an image first." : "e.g., 'Make the marked area a bookshelf...'"}
        className="w-full p-3 border bg-gray-900 text-gray-50 placeholder-gray-400 border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow duration-200 shadow-sm disabled:bg-gray-700 disabled:cursor-not-allowed"
        rows={4}
        disabled={disabled || isLoading}
      />
      <div className="text-xs text-gray-400">
        <p className="font-semibold mb-2 text-gray-300">Need ideas? Try these:</p>
        <ul className="space-y-1">
          {examplePrompts.map((p, i) => (
            <li key={i}>
                <button 
                  onClick={() => handleExampleClick(p)} 
                  className="text-left text-indigo-400 hover:underline disabled:text-gray-500 disabled:no-underline"
                  disabled={disabled || isLoading}
                >
                    {p}
                </button>
            </li>
          ))}
        </ul>
      </div>

      <button
        onClick={onGenerate}
        disabled={disabled || isLoading || !value}
        className="w-full flex items-center justify-center px-4 py-3 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 disabled:bg-indigo-400 disabled:cursor-not-allowed transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
      >
        {isLoading ? (
          <>
            <LoaderIcon className="w-5 h-5 mr-2 animate-spin" />
            <span>Generating...</span>
          </>
        ) : (
          <>
            <SparklesIcon className="w-5 h-5 mr-2" />
            <span>Visualize Design</span>
          </>
        )}
      </button>
    </div>
  );
};
