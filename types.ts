export interface GenerationResult {
  id: string;
  imageUrl?: string;
  text?: string;
  success: boolean;
  error?: string;
  createdAt: string;
}

export type DrawingMode = 'BRUSH' | 'ERASER' | 'LINE' | 'RECTANGLE' | 'CIRCLE';

export interface DrawingOptions {
  color: string;
  size: number;
  mode: DrawingMode;
}

export interface DesignIteration {
  id: string;
  prompt: string;
  inputImageUrl: string;
  model: string;
  results: GenerationResult[];
  createdAt: string;
}

export interface UploadedObject {
  id: string;
  imageUrl: string;
  width: number;
  height: number;
  x: number;
  y: number;
  rotation?: number;
  zIndex?: number;
  label?: string;
}