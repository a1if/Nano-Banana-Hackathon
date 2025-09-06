import React from 'react';
import { BrushIcon, EraserIcon, UndoIcon, TrashIcon, LineIcon, SquareIcon, CircleIcon } from './Icons';
import type { DrawingOptions } from '../types';

interface DrawingToolbarProps {
  options: DrawingOptions;
  onOptionsChange: (options: Partial<DrawingOptions>) => void;
  onUndo: () => void;
  onClear: () => void;
}

const colors = ['#EF4444', '#F97316', '#84CC16', '#10B981', '#06B6D4', '#6366F1', '#EC4899', '#78716C'];

const tools = [
  { mode: 'BRUSH', icon: BrushIcon, title: 'Brush' },
  { mode: 'LINE', icon: LineIcon, title: 'Line' },
  { mode: 'RECTANGLE', icon: SquareIcon, title: 'Rectangle' },
  { mode: 'CIRCLE', icon: CircleIcon, title: 'Circle' },
  { mode: 'ERASER', icon: EraserIcon, title: 'Eraser' },
] as const;


export const DrawingToolbar: React.FC<DrawingToolbarProps> = ({ options, onOptionsChange, onUndo, onClear }) => {
  return (
    <div className="bg-gray-100 p-2 rounded-lg shadow-md flex flex-wrap items-center gap-4">
      <div className="flex items-center gap-1 bg-gray-200 p-1 rounded-md">
        {tools.map(tool => (
            <button
            key={tool.mode}
            onClick={() => onOptionsChange({ mode: tool.mode })}
            className={`p-2 rounded-md ${options.mode === tool.mode ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-600 hover:bg-gray-300'}`}
            title={tool.title}
          >
            <tool.icon className="w-5 h-5" />
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        {colors.map(color => (
          <button
            key={color}
            onClick={() => onOptionsChange({ color })}
            className={`w-6 h-6 rounded-full border-2 transition-transform transform hover:scale-110 ${options.color === color ? 'border-indigo-500 scale-110' : 'border-transparent'}`}
            style={{ backgroundColor: color }}
            title={color}
          />
        ))}
      </div>

      <div className="flex items-center gap-2">
        <label htmlFor="brush-size" className="text-sm text-gray-600">Size:</label>
        <input
          id="brush-size"
          type="range"
          min="1"
          max="50"
          value={options.size}
          onChange={(e) => onOptionsChange({ size: parseInt(e.target.value, 10) })}
          className="w-24 cursor-pointer"
        />
      </div>
      
      <div className="flex items-center gap-1 ml-auto">
        <button onClick={onUndo} className="p-2 rounded-md text-gray-600 hover:bg-gray-200" title="Undo">
          <UndoIcon className="w-5 h-5" />
        </button>
        <button onClick={onClear} className="p-2 rounded-md text-gray-600 hover:bg-gray-200" title="Clear All">
          <TrashIcon className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};
