import React, { useRef, useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import { DrawingOptions, UploadedObject } from '../types';

interface DrawingCanvasProps {
  imageSrc: string;
  options: DrawingOptions;
  undoTrigger: number;
  clearTrigger: number;
  uploadedObject: UploadedObject | null;
  onObjectUpdate: (obj: UploadedObject) => void;
  onTransformChange: (transform: { scale: number }) => void;
}

type Interaction = 
  | { type: 'draw' }
  | { type: 'move'; startX: number; startY: number; }
  | { type: 'resize'; handle: 'br' | 'bl' | 'tr' | 'tl'; }
  | null;

const HANDLE_SIZE = 10;
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 4;

export const DrawingCanvas = forwardRef<{ 
  getCombinedDataUrl: () => string | null;
  getMaskDataUrl: () => string | null;
  hasDrawings: () => boolean;
  getCanvas: () => HTMLCanvasElement | null;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
}, DrawingCanvasProps>(
  ({ imageSrc, options, undoTrigger, clearTrigger, uploadedObject, onObjectUpdate, onTransformChange }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null); // Visible canvas
    const drawingCanvasRef = useRef<HTMLCanvasElement | null>(null); // Off-screen canvas for persistent drawings
    
    const [baseImage, setBaseImage] = useState<HTMLImageElement | null>(null);
    const [objectImage, setObjectImage] = useState<HTMLImageElement | null>(null);
    const [history, setHistory] = useState<ImageData[]>([]);

    // Interaction state
    const [isInteracting, setIsInteracting] = useState(false);
    const [interaction, setInteraction] = useState<Interaction>(null);
    const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);
    const [currentPos, setCurrentPos] = useState<{ x: number; y: number } | null>(null);

    // Viewport transform state
    const [transform, setTransform] = useState({ scale: 1, offsetX: 0, offsetY: 0 });
    const [isPanning, setIsPanning] = useState(false);
    const [panStart, setPanStart] = useState({ x: 0, y: 0 });

    // Load base image and initialize canvases
    useEffect(() => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = imageSrc;
      img.onload = () => {
        const canvas = canvasRef.current;
        if (canvas) {
          // Set visible canvas dimensions based on aspect ratio
          const containerWidth = canvas.parentElement?.clientWidth || img.naturalWidth;
          const scale = containerWidth / img.naturalWidth;
          canvas.width = containerWidth;
          canvas.height = img.naturalHeight * scale;

          // Create and size the off-screen drawing canvas to match the image's native resolution
          const offscreenCanvas = document.createElement('canvas');
          offscreenCanvas.width = img.naturalWidth;
          offscreenCanvas.height = img.naturalHeight;
          drawingCanvasRef.current = offscreenCanvas;
          
          setHistory([]);
        }
        setBaseImage(img);
      };
    }, [imageSrc]);
    
    // Load uploaded object image
    useEffect(() => {
        if (uploadedObject?.imageUrl) {
            const img = new Image();
            img.src = uploadedObject.imageUrl;
            img.onload = () => setObjectImage(img);
        } else {
            setObjectImage(null);
        }
    }, [uploadedObject?.imageUrl]);

    // Undo/Clear triggers
    useEffect(() => { if (undoTrigger > 0) handleUndo(); }, [undoTrigger]);
    useEffect(() => { if (clearTrigger > 0) handleClear(); }, [clearTrigger]);

    // Inform parent of transform changes
    useEffect(() => {
      onTransformChange({ scale: transform.scale });
    }, [transform.scale, onTransformChange]);

    // Main redraw effect
    useEffect(() => {
      redraw();
    }, [baseImage, objectImage, uploadedObject, history, transform, currentPos, isInteracting]);


    const getTransformedCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      
      const imageScaleX = canvas.width / (baseImage?.naturalWidth || canvas.width);
      const imageScaleY = canvas.height / (baseImage?.naturalHeight || canvas.height);

      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const canvasX = (mouseX - transform.offsetX) / transform.scale;
      const canvasY = (mouseY - transform.offsetY) / transform.scale;
      
      return { 
        x: canvasX / imageScaleX, 
        y: canvasY / imageScaleY,
      };
    };

    const redraw = () => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      const drawingCanvas = drawingCanvasRef.current;
      if (!canvas || !ctx || !baseImage) return;

      const imageScaleX = canvas.width / baseImage.naturalWidth;
      const imageScaleY = canvas.height / baseImage.naturalHeight;
      
      ctx.save();
      // Use a background color to prevent flickering during redraw
      ctx.fillStyle = '#f9fafb';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Apply viewport transform (pan and zoom)
      ctx.translate(transform.offsetX, transform.offsetY);
      ctx.scale(transform.scale, transform.scale);
      
      // Draw base image scaled to fit the visible canvas
      ctx.drawImage(baseImage, 0, 0, canvas.width, canvas.height);
      
      // Draw persistent drawings from the off-screen canvas
      if (drawingCanvas) {
        ctx.drawImage(drawingCanvas, 0, 0, canvas.width, canvas.height);
      }
      
      // Draw uploaded object, scaling its position and size to the visible canvas
      if (uploadedObject && objectImage) {
        ctx.drawImage(objectImage, uploadedObject.x * imageScaleX, uploadedObject.y * imageScaleY, uploadedObject.width * imageScaleX, uploadedObject.height * imageScaleY);
        drawObjectHandles(ctx, uploadedObject);
      }

      // Draw a temporary preview of the shape being drawn (line, rect, circle)
      if (isInteracting && interaction?.type === 'draw' && startPos && currentPos && ['LINE', 'RECTANGLE', 'CIRCLE'].includes(options.mode)) {
        ctx.strokeStyle = options.color;
        ctx.lineWidth = options.size;
        ctx.globalCompositeOperation = 'source-over';
        
        ctx.beginPath();
        switch (options.mode) {
          case 'LINE':
            ctx.moveTo(startPos.x * imageScaleX, startPos.y * imageScaleY);
            ctx.lineTo(currentPos.x * imageScaleX, currentPos.y * imageScaleY);
            break;
          case 'RECTANGLE':
            ctx.rect(startPos.x * imageScaleX, startPos.y * imageScaleY, (currentPos.x - startPos.x) * imageScaleX, (currentPos.y - startPos.y) * imageScaleY);
            break;
          case 'CIRCLE':
            const radiusX = (currentPos.x - startPos.x) * imageScaleX;
            const radiusY = (currentPos.y - startPos.y) * imageScaleY;
            const radius = Math.sqrt(radiusX * radiusX + radiusY * radiusY);
            ctx.arc(startPos.x * imageScaleX, startPos.y * imageScaleY, radius, 0, 2 * Math.PI);
            break;
        }
        ctx.stroke();
      }
      ctx.restore();
    };

    const drawObjectHandles = (ctx: CanvasRenderingContext2D, obj: UploadedObject) => {
        const imageScaleX = ctx.canvas.width / (baseImage?.naturalWidth || 1);
        const imageScaleY = ctx.canvas.height / (baseImage?.naturalHeight || 1);
        
        const x = obj.x * imageScaleX;
        const y = obj.y * imageScaleY;
        const width = obj.width * imageScaleX;
        const height = obj.height * imageScaleY;

        ctx.strokeStyle = '#007bff';
        ctx.lineWidth = 2 / transform.scale;
        ctx.strokeRect(x, y, width, height);
        
        const handleSize = HANDLE_SIZE / transform.scale;
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(x + width - handleSize / 2, y + height - handleSize / 2, handleSize, handleSize);
        ctx.strokeRect(x + width - handleSize / 2, y + height - handleSize / 2, handleSize, handleSize);
    };

    useImperativeHandle(ref, () => ({
        getCombinedDataUrl: () => {
            const drawingCanvas = drawingCanvasRef.current;
            if (!baseImage) return null;

            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = baseImage.naturalWidth;
            tempCanvas.height = baseImage.naturalHeight;
            const ctx = tempCanvas.getContext('2d');
            if (!ctx) return null;

            ctx.drawImage(baseImage, 0, 0);
            if (drawingCanvas) {
                ctx.drawImage(drawingCanvas, 0, 0);
            }
            if (uploadedObject && objectImage) {
                ctx.drawImage(objectImage, uploadedObject.x, uploadedObject.y, uploadedObject.width, uploadedObject.height);
            }
            
            return tempCanvas.toDataURL('image/png');
        },
        getMaskDataUrl: () => {
            const drawingCanvas = drawingCanvasRef.current;
            if (!baseImage || !drawingCanvas || history.length === 0) return null;

            const maskCanvas = document.createElement('canvas');
            maskCanvas.width = baseImage.naturalWidth;
            maskCanvas.height = baseImage.naturalHeight;
            const ctx = maskCanvas.getContext('2d');
            if (!ctx) return null;

            ctx.fillStyle = 'black';
            ctx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);
            ctx.drawImage(drawingCanvas, 0, 0);

            ctx.globalCompositeOperation = 'source-in';
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);

            return maskCanvas.toDataURL('image/png');
        },
        hasDrawings: () => history.length > 0,
        getCanvas: () => canvasRef.current,
        zoomIn: () => setTransform(t => ({ ...t, scale: Math.min(t.scale * 1.2, MAX_ZOOM) })),
        zoomOut: () => setTransform(t => ({ ...t, scale: Math.max(t.scale / 1.2, MIN_ZOOM) })),
        resetZoom: () => setTransform({ scale: 1, offsetX: 0, offsetY: 0 }),
    }));

    const saveToHistory = () => {
        const drawingCanvas = drawingCanvasRef.current;
        const ctx = drawingCanvas?.getContext('2d', { willReadFrequently: true });
        if (!drawingCanvas || !ctx) return;
        const imageData = ctx.getImageData(0, 0, drawingCanvas.width, drawingCanvas.height);
        setHistory(prev => [...prev, imageData]);
    };
    
    const handleUndo = () => {
      const newHistory = history.slice(0, -1);
      const drawingCanvas = drawingCanvasRef.current;
      if (drawingCanvas) {
        const ctx = drawingCanvas.getContext('2d');
        ctx?.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height);
        if (newHistory.length > 0) {
          ctx?.putImageData(newHistory[newHistory.length - 1], 0, 0);
        }
      }
      setHistory(newHistory);
    };

    const handleClear = () => {
      const drawingCanvas = drawingCanvasRef.current;
      if (drawingCanvas) {
        const ctx = drawingCanvas.getContext('2d');
        ctx?.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height);
      }
      setHistory([]);
    };

    const startInteraction = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (e.button === 2) { // Right-click for panning
            setIsPanning(true);
            setPanStart({ x: e.clientX, y: e.clientY });
            return;
        }

        const pos = getTransformedCoords(e);
        
        if (uploadedObject) {
            const { x, y, width, height } = uploadedObject;
            const handleSize = HANDLE_SIZE / transform.scale / (canvasRef.current?.width || 1 / (baseImage?.naturalWidth || 1));
            if (pos.x > x + width - handleSize && pos.x < x + width + handleSize && pos.y > y + height - handleSize && pos.y < y + height + handleSize) {
                setInteraction({ type: 'resize', handle: 'br' });
                setIsInteracting(true);
                return;
            }
            if (pos.x > x && pos.x < x + width && pos.y > y && pos.y < y + height) {
                setInteraction({ type: 'move', startX: pos.x - x, startY: pos.y - y });
                setIsInteracting(true);
                return;
            }
        }
      
        setInteraction({ type: 'draw' });
        setIsInteracting(true);
        setStartPos(pos);
        setCurrentPos(pos);
        
        if (options.mode === 'BRUSH' || options.mode === 'ERASER') {
            const drawingCtx = drawingCanvasRef.current?.getContext('2d');
            if (!drawingCtx) return;
            
            drawingCtx.strokeStyle = options.color;
            drawingCtx.lineWidth = options.size;
            drawingCtx.lineCap = 'round';
            drawingCtx.lineJoin = 'round';
            drawingCtx.globalCompositeOperation = options.mode === 'ERASER' ? 'destination-out' : 'source-over';
            
            drawingCtx.beginPath();
            drawingCtx.moveTo(pos.x, pos.y);
        }
    };

    const onInteraction = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (isPanning) {
            const dx = e.clientX - panStart.x;
            const dy = e.clientY - panStart.y;
            setTransform(t => ({ ...t, offsetX: t.offsetX + dx, offsetY: t.offsetY + dy }));
            setPanStart({ x: e.clientX, y: e.clientY });
            return;
        }

        if (!isInteracting || !interaction) return;
        const pos = getTransformedCoords(e);
        setCurrentPos(pos);

        if (interaction.type === 'move' && uploadedObject) {
            onObjectUpdate({ ...uploadedObject, x: pos.x - interaction.startX, y: pos.y - interaction.startY });
        } else if (interaction.type === 'resize' && uploadedObject) {
            const newWidth = Math.max(pos.x - uploadedObject.x, HANDLE_SIZE * 2);
            const aspectRatio = uploadedObject.height / uploadedObject.width;
            onObjectUpdate({ ...uploadedObject, width: newWidth, height: newWidth * aspectRatio });
        } else if (interaction.type === 'draw' && (options.mode === 'BRUSH' || options.mode === 'ERASER')) {
            const drawingCtx = drawingCanvasRef.current?.getContext('2d');
            if (drawingCtx) {
                drawingCtx.lineTo(pos.x, pos.y);
                drawingCtx.stroke();
            }
        }
    };

    const finishInteraction = () => {
        if (isPanning) {
          setIsPanning(false);
          return;
        }
        if (!isInteracting) return;

        if (interaction?.type === 'draw') {
          const drawingCtx = drawingCanvasRef.current?.getContext('2d');
          if (drawingCtx && startPos && currentPos) {
              drawingCtx.strokeStyle = options.color;
              drawingCtx.lineWidth = options.size;
              drawingCtx.lineCap = 'round';
              drawingCtx.lineJoin = 'round';
              drawingCtx.globalCompositeOperation = 'source-over'; // No eraser for shapes

              drawingCtx.beginPath();
              switch (options.mode) {
                  case 'LINE':
                      drawingCtx.moveTo(startPos.x, startPos.y);
                      drawingCtx.lineTo(currentPos.x, currentPos.y);
                      drawingCtx.stroke();
                      break;
                  case 'RECTANGLE':
                      drawingCtx.rect(startPos.x, startPos.y, currentPos.x - startPos.x, currentPos.y - startPos.y);
                      drawingCtx.stroke();
                      break;
                  case 'CIRCLE':
                      const radius = Math.sqrt(Math.pow(currentPos.x - startPos.x, 2) + Math.pow(currentPos.y - startPos.y, 2));
                      drawingCtx.arc(startPos.x, startPos.y, radius, 0, 2 * Math.PI);
                      drawingCtx.stroke();
                      break;
                  case 'BRUSH':
                  case 'ERASER':
                      // Already drawn, just close the path
                      drawingCtx.closePath();
                      break;
              }
          }
          saveToHistory();
        }
        
        setIsInteracting(false);
        setInteraction(null);
        setStartPos(null);
        setCurrentPos(null);
    };

    useEffect(() => {
        const canvas = canvasRef.current;
        const handleWheel = (e: WheelEvent) => {
            e.preventDefault();
            if (!canvas) return;

            const rect = canvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            const zoom = 1 - e.deltaY * 0.001;
            
            setTransform(prev => {
                const newScale = Math.max(MIN_ZOOM, Math.min(prev.scale * zoom, MAX_ZOOM));
                const worldX = (mouseX - prev.offsetX) / prev.scale;
                const worldY = (mouseY - prev.offsetY) / prev.scale;
                const newOffsetX = mouseX - worldX * newScale;
                const newOffsetY = mouseY - worldY * newScale;
                return { scale: newScale, offsetX: newOffsetX, offsetY: newOffsetY };
            });
        };

        canvas?.addEventListener('wheel', handleWheel, { passive: false });
        return () => canvas?.removeEventListener('wheel', handleWheel);
    }, []);

    let cursorClass = 'cursor-crosshair';
    if (interaction?.type === 'move') cursorClass = 'cursor-move';
    if (interaction?.type === 'resize') cursorClass = 'cursor-nwse-resize';
    if (isPanning) cursorClass = 'cursor-grabbing';

    return (
      <canvas
        ref={canvasRef}
        onMouseDown={startInteraction}
        onMouseMove={onInteraction}
        onMouseUp={finishInteraction}
        onMouseLeave={finishInteraction}
        onContextMenu={(e) => e.preventDefault()}
        style={{ touchAction: 'none' }}
        className={`w-full h-auto rounded-lg shadow-md bg-gray-200 ${cursorClass}`}
      />
    );
  }
);