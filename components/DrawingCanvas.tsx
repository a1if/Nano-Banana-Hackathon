import React, { useRef, useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import { DrawingOptions, UploadedObject } from '../types';

interface DrawingCanvasProps {
  imageSrc: string;
  options: DrawingOptions;
  undoTrigger: number;
  clearTrigger: number;
  uploadedObjects: UploadedObject[];
  onObjectUpdate: (obj: UploadedObject) => void;
  onTransformChange: (transform: { scale: number }) => void;
}

type Interaction = 
  | { type: 'draw' }
  | { type: 'move'; objectId: string; startX: number; startY: number; }
  | { type: 'resize'; objectId: string; handle: 'br' }
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
  ({ imageSrc, options, undoTrigger, clearTrigger, uploadedObjects, onObjectUpdate, onTransformChange }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const drawingCanvasRef = useRef<HTMLCanvasElement | null>(null);
    
    const [baseImage, setBaseImage] = useState<HTMLImageElement | null>(null);
    const [objectImages, setObjectImages] = useState<Record<string, HTMLImageElement>>({});
    const [history, setHistory] = useState<ImageData[]>([]);
    
    // Interaction state
    const [isInteracting, setIsInteracting] = useState(false);
    const [interaction, setInteraction] = useState<Interaction>(null);
    const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);
    const [currentPos, setCurrentPos] = useState<{ x: number; y: number } | null>(null);
    const [activeObjectId, setActiveObjectId] = useState<string | null>(null);

    // Viewport transform state
    const [transform, setTransform] = useState({ scale: 1, offsetX: 0, offsetY: 0 });
    const [isPanning, setIsPanning] = useState(false);
    const [panStart, setPanStart] = useState({ x: 0, y: 0 });

    useEffect(() => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = imageSrc;
      img.onload = () => {
        const canvas = canvasRef.current;
        if (canvas) {
          const containerWidth = canvas.parentElement?.clientWidth || img.naturalWidth;
          const scale = containerWidth / img.naturalWidth;
          canvas.width = containerWidth;
          canvas.height = img.naturalHeight * scale;

          const offscreenCanvas = document.createElement('canvas');
          offscreenCanvas.width = img.naturalWidth;
          offscreenCanvas.height = img.naturalHeight;
          drawingCanvasRef.current = offscreenCanvas;
          
          setHistory([]);
        }
        setBaseImage(img);
      };
    }, [imageSrc]);
    
    useEffect(() => {
      const newImages: Record<string, HTMLImageElement> = {};
      const promises = uploadedObjects.map(obj => {
        return new Promise<void>(resolve => {
          const existingImage = objectImages[obj.id];
          if (existingImage && existingImage.src === obj.imageUrl) {
            newImages[obj.id] = existingImage;
            resolve();
            return;
          }
          const img = new Image();
          img.src = obj.imageUrl;
          img.onload = () => {
            newImages[obj.id] = img;
            resolve();
          };
          img.onerror = () => resolve();
        });
      });
      Promise.all(promises).then(() => {
        setObjectImages(newImages);
      });
    }, [uploadedObjects]);

    useEffect(() => { if (undoTrigger > 0) handleUndo(); }, [undoTrigger]);
    useEffect(() => { if (clearTrigger > 0) handleClear(); }, [clearTrigger]);

    useEffect(() => {
      onTransformChange({ scale: transform.scale });
    }, [transform.scale, onTransformChange]);

    useEffect(() => {
      redraw();
    }, [baseImage, objectImages, uploadedObjects, history, transform, currentPos, isInteracting, activeObjectId]);


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
      
      return { x: canvasX / imageScaleX, y: canvasY / imageScaleY };
    };

    const redraw = () => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      const drawingCanvas = drawingCanvasRef.current;
      if (!canvas || !ctx || !baseImage) return;

      const imageScaleX = canvas.width / baseImage.naturalWidth;
      const imageScaleY = canvas.height / baseImage.naturalHeight;
      
      ctx.save();
      ctx.fillStyle = '#f9fafb';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.translate(transform.offsetX, transform.offsetY);
      ctx.scale(transform.scale, transform.scale);
      ctx.drawImage(baseImage, 0, 0, canvas.width, canvas.height);
      
      if (drawingCanvas) {
        ctx.drawImage(drawingCanvas, 0, 0, canvas.width, canvas.height);
      }
      
      uploadedObjects.forEach(obj => {
        const objectImage = objectImages[obj.id];
        if (objectImage) {
          ctx.drawImage(objectImage, obj.x * imageScaleX, obj.y * imageScaleY, obj.width * imageScaleX, obj.height * imageScaleY);
          if (obj.id === activeObjectId) {
            drawObjectHandles(ctx, obj);
          }
        }
      });
      
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
            const radius = Math.sqrt(Math.pow((currentPos.x - startPos.x) * imageScaleX, 2) + Math.pow((currentPos.y - startPos.y) * imageScaleY, 2));
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
            uploadedObjects.forEach(obj => {
                const objectImage = objectImages[obj.id];
                if (objectImage) {
                    ctx.drawImage(objectImage, obj.x, obj.y, obj.width, obj.height);
                }
            });
            
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
            
            ctx.drawImage(drawingCanvas, 0, 0);
            ctx.globalCompositeOperation = 'source-in';
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);
            ctx.globalCompositeOperation = 'destination-over';
            ctx.fillStyle = 'black';
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
      if (history.length === 0) return;
      const newHistory = history.slice(0, -1);
      const drawingCanvas = drawingCanvasRef.current;
      const ctx = drawingCanvas?.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, drawingCanvas!.width, drawingCanvas!.height);
        if (newHistory.length > 0) {
          ctx.putImageData(newHistory[newHistory.length - 1], 0, 0);
        }
      }
      setHistory(newHistory);
    };

    const handleClear = () => {
      const drawingCanvas = drawingCanvasRef.current;
      if (drawingCanvas) {
        drawingCanvas.getContext('2d')?.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height);
      }
      setHistory([]);
    };

    const startInteraction = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (e.button === 2) {
            setIsPanning(true);
            setPanStart({ x: e.clientX, y: e.clientY });
            return;
        }

        const pos = getTransformedCoords(e);
        let objectHit = false;

        for (let i = uploadedObjects.length - 1; i >= 0; i--) {
          const obj = uploadedObjects[i];
          const { x, y, width, height } = obj;
          const handleSize = HANDLE_SIZE / transform.scale / (canvasRef.current!.width / baseImage!.naturalWidth);

          if (pos.x > x + width - handleSize && pos.x < x + width + handleSize && pos.y > y + height - handleSize && pos.y < y + height + handleSize) {
              setInteraction({ type: 'resize', handle: 'br', objectId: obj.id });
              setActiveObjectId(obj.id);
              objectHit = true;
              break;
          }
          if (pos.x > x && pos.x < x + width && pos.y > y && pos.y < y + height) {
              setInteraction({ type: 'move', startX: pos.x - x, startY: pos.y - y, objectId: obj.id });
              setActiveObjectId(obj.id);
              objectHit = true;
              break;
          }
        }

        setIsInteracting(true);
        if (objectHit) return;

        setActiveObjectId(null);
        setInteraction({ type: 'draw' });
        setStartPos(pos);
        setCurrentPos(pos);
        
        if (options.mode === 'BRUSH' || options.mode === 'ERASER') {
            const drawingCtx = drawingCanvasRef.current?.getContext('2d');
            if (!drawingCtx) return;
            saveToHistory();
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

        const currentObject = uploadedObjects.find(o => o.id === (interaction.type !== 'draw' ? interaction.objectId : null));

        if (interaction.type === 'move' && currentObject) {
            onObjectUpdate({ ...currentObject, x: pos.x - interaction.startX, y: pos.y - interaction.startY });
        } else if (interaction.type === 'resize' && currentObject) {
            const newWidth = Math.max(pos.x - currentObject.x, HANDLE_SIZE * 2);
            const aspectRatio = currentObject.height / currentObject.width;
            onObjectUpdate({ ...currentObject, width: newWidth, height: newWidth * aspectRatio });
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
              drawingCtx.globalCompositeOperation = 'source-over';

              drawingCtx.beginPath();
              switch (options.mode) {
                  case 'LINE':
                  case 'RECTANGLE':
                  case 'CIRCLE':
                      saveToHistory(); // Save before drawing shape
                      if (options.mode === 'LINE') {
                          drawingCtx.moveTo(startPos.x, startPos.y);
                          drawingCtx.lineTo(currentPos.x, currentPos.y);
                      } else if (options.mode === 'RECTANGLE') {
                          drawingCtx.rect(startPos.x, startPos.y, currentPos.x - startPos.x, currentPos.y - startPos.y);
                      } else { // CIRCLE
                          const radius = Math.sqrt(Math.pow(currentPos.x - startPos.x, 2) + Math.pow(currentPos.y - startPos.y, 2));
                          drawingCtx.arc(startPos.x, startPos.y, radius, 0, 2 * Math.PI);
                      }
                      drawingCtx.stroke();
                      break;
                  case 'BRUSH':
                  case 'ERASER':
                      drawingCtx.closePath();
                      break;
              }
          }
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
