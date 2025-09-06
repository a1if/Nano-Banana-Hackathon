import React, { useRef, useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import { DrawingOptions, UploadedObject } from '../types';

interface DrawingCanvasProps {
  imageSrc: string;
  options: DrawingOptions;
  undoTrigger: number;
  clearTrigger: number;
  uploadedObject: UploadedObject | null;
  onObjectUpdate: (obj: UploadedObject) => void;
}

type Interaction = 
  | { type: 'draw' }
  | { type: 'move'; startX: number; startY: number; }
  | { type: 'resize'; handle: 'br' | 'bl' | 'tr' | 'tl'; }
  | null;

const HANDLE_SIZE = 10;

export const DrawingCanvas = forwardRef<{ getCombinedDataUrl: () => string | null, getCanvas: () => HTMLCanvasElement | null }, DrawingCanvasProps>(
  ({ imageSrc, options, undoTrigger, clearTrigger, uploadedObject, onObjectUpdate }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isInteracting, setIsInteracting] = useState(false);
    const [history, setHistory] = useState<ImageData[]>([]);
    const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);
    const [snapshot, setSnapshot] = useState<ImageData | null>(null);
    const [baseImage, setBaseImage] = useState<HTMLImageElement | null>(null);
    const [objectImage, setObjectImage] = useState<HTMLImageElement | null>(null);
    const [interaction, setInteraction] = useState<Interaction>(null);

    // Load base image
    useEffect(() => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = imageSrc;
      img.onload = () => {
        const canvas = canvasRef.current;
        if(canvas){
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
        }
        setBaseImage(img);
      };
    }, [imageSrc]);
    
    // Load object image
    useEffect(() => {
        if (uploadedObject) {
            const img = new Image();
            img.src = uploadedObject.imageUrl;
            img.onload = () => setObjectImage(img);
        } else {
            setObjectImage(null);
        }
    }, [uploadedObject?.imageUrl]);

    // Redraw canvas whenever a visual element changes
    useEffect(() => {
        redraw();
    }, [baseImage, objectImage, uploadedObject, history, options.mode]);

    const redraw = (excludeUi = false) => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Draw base image
        if (baseImage) {
            ctx.drawImage(baseImage, 0, 0, canvas.width, canvas.height);
        }

        // Draw the user's freehand drawings
        if (history.length > 0) {
            ctx.putImageData(history[history.length - 1], 0, 0);
        }

        // Draw placed object
        if (uploadedObject && objectImage) {
            ctx.drawImage(objectImage, uploadedObject.x, uploadedObject.y, uploadedObject.width, uploadedObject.height);
            if (!excludeUi) {
                drawObjectHandles(ctx, uploadedObject);
            }
        }
    };

    const drawObjectHandles = (ctx: CanvasRenderingContext2D, obj: UploadedObject) => {
        ctx.strokeStyle = '#007bff';
        ctx.lineWidth = 2;
        ctx.strokeRect(obj.x, obj.y, obj.width, obj.height);

        ctx.fillStyle = '#FFFFFF';
        // Bottom-right handle
        ctx.fillRect(obj.x + obj.width - HANDLE_SIZE / 2, obj.y + obj.height - HANDLE_SIZE / 2, HANDLE_SIZE, HANDLE_SIZE);
        ctx.strokeRect(obj.x + obj.width - HANDLE_SIZE / 2, obj.y + obj.height - HANDLE_SIZE / 2, HANDLE_SIZE, HANDLE_SIZE);
    };

    useImperativeHandle(ref, () => ({
        getCombinedDataUrl: () => {
            redraw(true); // Redraw without handles for export
            const dataUrl = canvasRef.current?.toDataURL('image/png') || null;
            redraw(false); // Redraw with handles for user
            return dataUrl;
        },
        getCanvas: () => canvasRef.current,
    }));

    // Initialize canvas on first image load
    useEffect(() => {
        if(baseImage){
            const canvas = canvasRef.current;
            const ctx = canvas?.getContext('2d', { willReadFrequently: true });
            if (!ctx || !canvas) return;
            ctx.drawImage(baseImage, 0, 0, canvas.width, canvas.height);
            saveToHistory();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [baseImage]);

    useEffect(() => { if (undoTrigger > 0) handleUndo(); }, [undoTrigger]);
    useEffect(() => { if (clearTrigger > 0) handleClear(); }, [clearTrigger]);

    const saveToHistory = () => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx || !baseImage) return;

        // Create a temporary canvas with just the drawings
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        const tempCtx = tempCanvas.getContext('2d');
        if (!tempCtx) return;

        // Clear and draw current state over base image, then get delta
        tempCtx.drawImage(baseImage, 0, 0);
        if (history.length > 0) {
            tempCtx.putImageData(history[history.length - 1], 0, 0);
        }
        tempCtx.globalCompositeOperation = "source-over";
        tempCtx.drawImage(canvas, 0, 0);

        const imageData = tempCtx.getImageData(0, 0, canvas.width, canvas.height);
        setHistory(prev => [...prev, imageData]);
    };
    
    const handleUndo = () => {
      setHistory(prev => (prev.length <= 1 ? prev : prev.slice(0, -1)));
    };

    const handleClear = () => {
      if (history.length > 0) setHistory([history[0]]);
    };

    const getScaledCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
    };

    const startInteraction = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const pos = getScaledCoords(e);
        
        // Check for object interaction first
        if (uploadedObject) {
            const { x, y, width, height } = uploadedObject;
            // Check resize handle
            if (pos.x > x + width - HANDLE_SIZE && pos.x < x + width + HANDLE_SIZE && pos.y > y + height - HANDLE_SIZE && pos.y < y + height + HANDLE_SIZE) {
                setInteraction({ type: 'resize', handle: 'br' });
                setIsInteracting(true);
                return;
            }
            // Check move
            if (pos.x > x && pos.x < x + width && pos.y > y && pos.y < y + height) {
                setInteraction({ type: 'move', startX: pos.x - x, startY: pos.y - y });
                setIsInteracting(true);
                return;
            }
        }
      
        // If no object interaction, start drawing
        setInteraction({ type: 'draw' });
        setIsInteracting(true);

        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!ctx) return;
        
        // Setup context for drawing
        ctx.strokeStyle = options.color;
        ctx.lineWidth = options.size;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.globalCompositeOperation = options.mode === 'ERASER' ? 'destination-out' : 'source-over';
        
        setStartPos(pos);
        
        if (['LINE', 'RECTANGLE', 'CIRCLE'].includes(options.mode)) {
            setSnapshot(ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height));
        } else {
            ctx.beginPath();
            ctx.moveTo(pos.x, pos.y);
        }
    };

    const onInteraction = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!isInteracting || !interaction) return;
        const pos = getScaledCoords(e);
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');

        if (interaction.type === 'move' && uploadedObject) {
            onObjectUpdate({ ...uploadedObject, x: pos.x - interaction.startX, y: pos.y - interaction.startY });
        } else if (interaction.type === 'resize' && uploadedObject) {
            const newWidth = Math.max(pos.x - uploadedObject.x, HANDLE_SIZE * 2);
            const aspectRatio = uploadedObject.height / uploadedObject.width;
            onObjectUpdate({ ...uploadedObject, width: newWidth, height: newWidth * aspectRatio });
        } else if (interaction.type === 'draw' && startPos && ctx) {
            if (snapshot) {
                ctx.putImageData(snapshot, 0, 0);
            }
            ctx.beginPath();
            switch (options.mode) {
                case 'BRUSH':
                case 'ERASER':
                    ctx.lineTo(pos.x, pos.y);
                    ctx.stroke();
                    break;
                case 'LINE':
                    ctx.moveTo(startPos.x, startPos.y);
                    ctx.lineTo(pos.x, pos.y);
                    ctx.stroke();
                    break;
                case 'RECTANGLE':
                    ctx.rect(startPos.x, startPos.y, pos.x - startPos.x, pos.y - startPos.y);
                    ctx.stroke();
                    break;
                case 'CIRCLE':
                    const radius = Math.sqrt(Math.pow(pos.x - startPos.x, 2) + Math.pow(pos.y - startPos.y, 2));
                    ctx.arc(startPos.x, startPos.y, radius, 0, 2 * Math.PI);
                    ctx.stroke();
                    break;
            }
        }
    };

    const finishInteraction = () => {
        if (interaction?.type === 'draw') {
            saveToHistory();
            setStartPos(null);
            setSnapshot(null);
        }
        setIsInteracting(false);
        setInteraction(null);
    };

    let cursorClass = 'cursor-crosshair';
    if(interaction?.type === 'move') cursorClass = 'cursor-move';
    if(interaction?.type === 'resize') cursorClass = 'cursor-nwse-resize';

    return (
      <canvas
        ref={canvasRef}
        onMouseDown={startInteraction}
        onMouseMove={onInteraction}
        onMouseUp={finishInteraction}
        onMouseLeave={finishInteraction}
        style={{ touchAction: 'none' }}
        className={`w-full h-auto rounded-lg shadow-md ${cursorClass}`}
      />
    );
  }
);