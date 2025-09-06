export interface GenerationResult {
  imageUrl: string;
  text: string;
}

export type DrawingMode = 'BRUSH' | 'ERASER' | 'LINE' | 'RECTANGLE' | 'CIRCLE';

export interface DrawingOptions {
  color: string;
  size: number;
  mode: DrawingMode;
}

export interface DesignIteration {
  prompt: string;
  inputImageUrl: string;
  results: GenerationResult[];
}

export interface UploadedObject {
  imageUrl: string;
  width: number;
  height: number;
  x: number;
  y: number;
}
