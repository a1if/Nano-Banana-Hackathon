import React, { useState, useMemo, useRef } from 'react';
import { Header } from './components/Header';
import { ImageUploader } from './components/ImageUploader';
import { PromptInput } from './components/PromptInput';
import { ResultDisplay } from './components/ResultDisplay';
import { DrawingCanvas } from './components/DrawingCanvas';
import { DrawingToolbar } from './components/DrawingToolbar';
import { ObjectUploader } from './components/ObjectUploader';
import { visualizeDesign } from './services/geminiService';
import { GenerationResult, DrawingOptions, DesignIteration, UploadedObject } from './types';
import { ZoomControls } from './components/ZoomControls';

interface CanvasRef {
  getCombinedDataUrl: () => string | null;
  getMaskDataUrl: () => string | null;
  hasDrawings: () => boolean;
  getCanvas: () => HTMLCanvasElement | null;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
}

function App() {
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [designHistory, setDesignHistory] = useState<DesignIteration[]>([]);
  const [activeImageUrl, setActiveImageUrl] = useState<string | null>(null);
  const canvasRef = useRef<CanvasRef>(null);

  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [drawingOptions, setDrawingOptions] = useState<DrawingOptions>({
    color: '#EF4444',
    size: 10,
    mode: 'BRUSH',
  });
  const [undoTrigger, setUndoTrigger] = useState(0);
  const [clearTrigger, setClearTrigger] = useState(0);

  const [uploadedObject, setUploadedObject] = useState<UploadedObject | null>(null);
  const [canvasTransform, setCanvasTransform] = useState({ scale: 1 });

  const originalImageUrl = useMemo(() => {
    if (selectedImage) {
      return URL.createObjectURL(selectedImage);
    }
    return null;
  }, [selectedImage]);

  const handleImageSelect = (file: File) => {
    setSelectedImage(file);
    const newActiveUrl = URL.createObjectURL(file);
    setActiveImageUrl(newActiveUrl);
    setDesignHistory([]);
    setError(null);
    setPrompt('');
    setUploadedObject(null);
  };
  
  const handleGenerate = async () => {
    const drawnImageDataUrl = canvasRef.current?.getCombinedDataUrl();
    
    if (!drawnImageDataUrl) {
        setError("Could not get image data from the canvas.");
        return;
    }
    if (!prompt) {
        setError("Please enter a prompt.");
        return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
        const hasDrawings = canvasRef.current?.hasDrawings() ?? false;
        const maskDataUrl = hasDrawings ? canvasRef.current?.getMaskDataUrl() : null;
        
        const generationResults = await visualizeDesign(drawnImageDataUrl, prompt, maskDataUrl);
        
        const newIteration: DesignIteration = {
          prompt: prompt,
          inputImageUrl: activeImageUrl!,
          results: generationResults,
        };
        
        setDesignHistory(prev => [...prev, newIteration]);
        if (generationResults.length > 0) {
            setActiveImageUrl(generationResults[0].imageUrl);
            setUploadedObject(null); // Clear object after generation for a clean slate
        }

    } catch (e) {
        if (e instanceof Error) {
            setError(e.message);
        } else {
            setError("An unknown error occurred.");
        }
    } finally {
        setIsLoading(false);
    }
  };

  const handleSelectHistoryItem = (iterationIndex: number, resultIndex: number) => {
    const selectedIteration = designHistory[iterationIndex];
    if (selectedIteration && selectedIteration.results[resultIndex]) {
        setActiveImageUrl(selectedIteration.results[resultIndex].imageUrl);
        setDesignHistory(prev => prev.slice(0, iterationIndex + 1));
        setUploadedObject(null); // Clear any object when navigating history
    }
  };

  const handleReset = () => {
    setSelectedImage(null);
    setDesignHistory([]);
    setActiveImageUrl(null);
    setPrompt('');
    setIsLoading(false);
    setError(null);
    setUploadedObject(null);
    setDrawingOptions({
      color: '#EF4444',
      size: 10,
      mode: 'BRUSH',
    });
  };

  const handleObjectUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const imageUrl = e.target?.result as string;
      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current?.getCanvas();
        const canvasWidth = canvas?.width || 800; // Use a fallback width
        const aspectRatio = img.width / img.height;
        const defaultWidth = canvasWidth * 0.25;
        setUploadedObject({
          imageUrl: imageUrl,
          width: defaultWidth,
          height: defaultWidth / aspectRatio,
          x: 50,
          y: 50,
        });
      };
      img.src = imageUrl;
    };
    reader.readAsDataURL(file);
  };

  const handleObjectUpdate = (newObject: UploadedObject) => {
    setUploadedObject(newObject);
  };

  const handleObjectRemove = () => {
    setUploadedObject(null);
  };

  return (
    <div className="bg-gray-50 min-h-screen font-sans">
      <Header onReset={handleReset} />
      <main className="container mx-auto p-4 md:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column: Controls */}
          <div className="bg-white p-6 rounded-2xl shadow-lg space-y-6">
            <div>
              <h2 className="text-xl font-bold text-gray-800 mb-4">1. Upload your image</h2>
              <ImageUploader onImageSelect={handleImageSelect} selectedImage={selectedImage} />
            </div>

            {selectedImage && (
              <div>
                <h2 className="text-xl font-bold text-gray-800 mb-4">2. Place an object (optional)</h2>
                <ObjectUploader
                  onObjectUpload={handleObjectUpload}
                  onObjectRemove={handleObjectRemove}
                  uploadedObjectUrl={uploadedObject?.imageUrl || null}
                  disabled={!selectedImage || isLoading}
                />
              </div>
            )}
            
            {activeImageUrl && (
              <>
                <div>
                  <h2 className="text-xl font-bold text-gray-800 mb-4">3. Mark your changes (optional)</h2>
                  <DrawingToolbar
                    options={drawingOptions}
                    onOptionsChange={(opts) => setDrawingOptions(prev => ({ ...prev, ...opts }))}
                    onUndo={() => setUndoTrigger(t => t + 1)}
                    onClear={() => setClearTrigger(t => t + 1)}
                  />
                  <div className="mt-4 relative">
                     <DrawingCanvas
                        ref={canvasRef}
                        imageSrc={activeImageUrl}
                        options={drawingOptions}
                        undoTrigger={undoTrigger}
                        clearTrigger={clearTrigger}
                        uploadedObject={uploadedObject}
                        onObjectUpdate={handleObjectUpdate}
                        onTransformChange={setCanvasTransform}
                        key={activeImageUrl} // Force re-render when image source changes
                     />
                     <ZoomControls
                        scale={canvasTransform.scale}
                        onZoomIn={() => canvasRef.current?.zoomIn()}
                        onZoomOut={() => canvasRef.current?.zoomOut()}
                        onReset={() => canvasRef.current?.resetZoom()}
                      />
                  </div>
                </div>
              </>
            )}

            <div>
              <h2 className="text-xl font-bold text-gray-800 mb-4">
                {activeImageUrl ? '4. Describe your vision' : '2. Describe your vision'}
              </h2>
              <PromptInput
                value={prompt}
                onChange={setPrompt}
                onGenerate={handleGenerate}
                isLoading={isLoading}
                disabled={!selectedImage}
              />
            </div>
          </div>

          {/* Right Column: Results */}
          <div className="bg-white p-6 rounded-2xl shadow-lg">
             <ResultDisplay 
                originalImageUrl={originalImageUrl}
                designHistory={designHistory}
                isLoading={isLoading} 
                error={error}
                onSelect={handleSelectHistoryItem}
                activeImageUrl={activeImageUrl}
             />
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;