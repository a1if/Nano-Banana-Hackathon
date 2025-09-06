import React from 'react';
import { ZoomInIcon, ZoomOutIcon, ZoomResetIcon } from './Icons';

interface ZoomControlsProps {
  scale: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
}

export const ZoomControls: React.FC<ZoomControlsProps> = ({ scale, onZoomIn, onZoomOut, onReset }) => {
  return (
    <div className="absolute bottom-2 right-2 bg-black bg-opacity-50 text-white rounded-lg p-1 flex items-center space-x-2 text-xs backdrop-blur-sm">
      <button onClick={onZoomOut} className="p-1.5 hover:bg-white/20 rounded-md" title="Zoom Out">
        <ZoomOutIcon className="w-4 h-4" />
      </button>
      <span className="font-mono w-12 text-center tabular-nums" title="Zoom Level">
        {Math.round(scale * 100)}%
      </span>
      <button onClick={onZoomIn} className="p-1.5 hover:bg-white/20 rounded-md" title="Zoom In">
        <ZoomInIcon className="w-4 h-4" />
      </button>
      <div className="w-px h-4 bg-white/20"></div>
      <button onClick={onReset} className="p-1.5 hover:bg-white/20 rounded-md" title="Reset Zoom">
        <ZoomResetIcon className="w-4 h-4" />
      </button>
    </div>
  );
};
