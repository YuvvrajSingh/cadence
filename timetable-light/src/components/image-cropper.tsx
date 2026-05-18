"use client";

import { useState, useRef, useEffect, useCallback } from "react";

interface Point {
  x: number;
  y: number;
}

interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ImageCropperProps {
  imageFile: File;
  onCrop: (croppedFile: File) => void;
  onCancel: () => void;
}

export function ImageCropper({ imageFile, onCrop, onCancel }: ImageCropperProps) {
  const [imageSrc, setImageSrc] = useState<string>("");
  const [crop, setCrop] = useState<CropArea>({ x: 15, y: 15, width: 70, height: 70 });
  const [rotation, setRotation] = useState(0);
  
  // Using refs for high-frequency updates to avoid laggy React renders
  const isDraggingRef = useRef(false);
  const dragTypeRef = useRef<string | null>(null);
  const dragStartRef = useRef<Point>({ x: 0, y: 0 });
  const currentCropRef = useRef<CropArea>({ x: 15, y: 15, width: 70, height: 70 });
  
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const reader = new FileReader();
    reader.onload = (e) => setImageSrc(e.target?.result as string);
    reader.readAsDataURL(imageFile);
  }, [imageFile]);

  // Sync state with ref for initial load
  useEffect(() => {
    currentCropRef.current = crop;
  }, []);

  const updateOverlayStyle = useCallback(() => {
    if (!overlayRef.current) return;
    const { x, y, width, height } = currentCropRef.current;
    overlayRef.current.style.left = `${x}%`;
    overlayRef.current.style.top = `${y}%`;
    overlayRef.current.style.width = `${width}%`;
    overlayRef.current.style.height = `${height}%`;
  }, []);

  const handleStart = (e: React.MouseEvent | React.TouchEvent, type: string) => {
    e.stopPropagation();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    isDraggingRef.current = true;
    dragTypeRef.current = type;
    dragStartRef.current = { x: clientX, y: clientY };
  };

  const handleMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (!isDraggingRef.current || !containerRef.current) return;

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    const rect = containerRef.current.getBoundingClientRect();
    const dx = ((clientX - dragStartRef.current.x) / rect.width) * 100;
    const dy = ((clientY - dragStartRef.current.y) / rect.height) * 100;

    const prev = currentCropRef.current;
    let { x, y, width, height } = { ...prev };
    const type = dragTypeRef.current;

    if (type === "move") {
      x = Math.max(0, Math.min(100 - width, x + dx));
      y = Math.max(0, Math.min(100 - height, y + dy));
    } else if (type === "nw") {
      const nx = Math.max(0, Math.min(x + width - 10, x + dx));
      width += (x - nx); x = nx;
      const ny = Math.max(0, Math.min(y + height - 10, y + dy));
      height += (y - ny); y = ny;
    } else if (type === "ne") {
      width = Math.max(10, Math.min(100 - x, width + dx));
      const ny = Math.max(0, Math.min(y + height - 10, y + dy));
      height += (y - ny); y = ny;
    } else if (type === "sw") {
      const nx = Math.max(0, Math.min(x + width - 10, x + dx));
      width += (x - nx); x = nx;
      height = Math.max(10, Math.min(100 - y, height + dy));
    } else if (type === "se") {
      width = Math.max(10, Math.min(100 - x, width + dx));
      height = Math.max(10, Math.min(100 - y, height + dy));
    } else if (type === "n") {
      const ny = Math.max(0, Math.min(y + height - 10, y + dy));
      height += (y - ny); y = ny;
    } else if (type === "s") {
      height = Math.max(10, Math.min(100 - y, height + dy));
    } else if (type === "w") {
      const nx = Math.max(0, Math.min(x + width - 10, x + dx));
      width += (x - nx); x = nx;
    } else if (type === "e") {
      width = Math.max(10, Math.min(100 - x, width + dx));
    }

    currentCropRef.current = { x, y, width, height };
    dragStartRef.current = { x: clientX, y: clientY };
    
    // Batch UI update with animation frame for ultra-smoothness
    requestAnimationFrame(updateOverlayStyle);
  }, [updateOverlayStyle]);

  const handleEnd = useCallback(() => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      dragTypeRef.current = null;
      setCrop(currentCropRef.current);
    }
  }, []);

  useEffect(() => {
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleEnd);
    window.addEventListener("touchmove", handleMove, { passive: false });
    window.addEventListener("touchend", handleEnd);
    
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleEnd);
      window.removeEventListener("touchmove", handleMove);
      window.removeEventListener("touchend", handleEnd);
    };
  }, [handleMove, handleEnd]);

  const executeCrop = () => {
    if (!imgRef.current) return;

    const canvas = document.createElement("canvas");
    const img = imgRef.current;
    const finalCrop = currentCropRef.current;

    const isRotated = rotation % 180 !== 0;
    const naturalWidth = isRotated ? img.naturalHeight : img.naturalWidth;
    const naturalHeight = isRotated ? img.naturalWidth : img.naturalHeight;

    canvas.width = (finalCrop.width / 100) * naturalWidth;
    canvas.height = (finalCrop.height / 100) * naturalHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = naturalWidth;
    tempCanvas.height = naturalHeight;
    const tCtx = tempCanvas.getContext("2d");
    if (tCtx) {
      tCtx.translate(naturalWidth / 2, naturalHeight / 2);
      tCtx.rotate((rotation * Math.PI) / 180);
      tCtx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
      
      ctx.drawImage(
        tempCanvas,
        (finalCrop.x / 100) * naturalWidth,
        (finalCrop.y / 100) * naturalHeight,
        (finalCrop.width / 100) * naturalWidth,
        (finalCrop.height / 100) * naturalHeight,
        0, 0, canvas.width, canvas.height
      );
    }

    canvas.toBlob((blob) => {
      if (blob) {
        onCrop(new File([blob], imageFile.name, { type: "image/jpeg" }));
      }
    }, "image/jpeg", 0.9);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/95 flex flex-col items-center justify-center p-2 sm:p-4">
      <div className="w-full max-w-xl bg-surface-container rounded-[2.5rem] overflow-hidden flex flex-col max-h-[95vh] shadow-2xl">
        <div className="p-5 flex justify-between items-center bg-surface-container-low border-b border-outline-variant/10">
          <div className="flex items-center gap-3">
             <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
               <span className="material-symbols-outlined text-base">crop</span>
             </div>
             <p className="text-xs font-black uppercase tracking-widest text-on-surface">Crop Selection</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setRotation(r => (r + 90) % 360)} className="w-10 h-10 rounded-xl hover:bg-surface-variant flex items-center justify-center transition-colors">
              <span className="material-symbols-outlined text-lg">rotate_right</span>
            </button>
            <button onClick={onCancel} className="w-10 h-10 rounded-xl hover:bg-error/10 hover:text-error flex items-center justify-center transition-colors">
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>
        </div>

        <div className="flex-1 relative overflow-hidden bg-[#050505] flex items-center justify-center" ref={containerRef}>
          {imageSrc && (
            <img
              ref={imgRef}
              src={imageSrc}
              alt="Source"
              style={{ transform: `rotate(${rotation}deg)` }}
              className="max-w-full max-h-full object-contain pointer-events-none select-none transition-transform duration-200"
            />
          )}
          
          {/* Static Masks (More performant than huge box-shadow) */}
          <div className="absolute inset-0 pointer-events-none opacity-60">
             {/* We use SVG for the mask to be super efficient */}
             <svg width="100%" height="100%" className="absolute inset-0">
               <defs>
                 <mask id="hole">
                   <rect width="100%" height="100%" fill="white" />
                   <rect 
                     x={`${crop.x}%`} 
                     y={`${crop.y}%`} 
                     width={`${crop.width}%`} 
                     height={`${crop.height}%`} 
                     fill="black" 
                   />
                 </mask>
               </defs>
               <rect width="100%" height="100%" fill="black" mask="url(#hole)" />
             </svg>
          </div>

          {/* Interactive Crop Box */}
          <div 
            ref={overlayRef}
            className="absolute border-2 border-primary cursor-move shadow-lg ring-1 ring-white/20"
            style={{
              left: `${crop.x}%`,
              top: `${crop.y}%`,
              width: `${crop.width}%`,
              height: `${crop.height}%`,
            }}
          >
            <div className="absolute inset-0" onMouseDown={(e) => handleStart(e, "move")} onTouchStart={(e) => handleStart(e, "move")} />
            
            {/* Optimized Corner Handles */}
            {["nw", "ne", "sw", "se"].map(id => (
              <div 
                key={id} 
                className={`absolute w-8 h-8 flex items-center justify-center z-10 ${
                  id === "nw" ? "-top-4 -left-4 cursor-nw-resize" :
                  id === "ne" ? "-top-4 -right-4 cursor-ne-resize" :
                  id === "sw" ? "-bottom-4 -left-4 cursor-sw-resize" :
                  "-bottom-4 -right-4 cursor-se-resize"
                }`}
                onMouseDown={(e) => handleStart(e, id)}
                onTouchStart={(e) => handleStart(e, id)}
              >
                <div className="w-4 h-4 bg-primary border-2 border-white rounded-full" />
              </div>
            ))}
            
            {/* Optimized Side Handles */}
            {["n", "s", "w", "e"].map(id => (
              <div 
                key={id}
                className={`absolute z-10 ${
                  id === "n" ? "top-0 left-0 right-0 h-4 -translate-y-1/2 cursor-n-resize" :
                  id === "s" ? "bottom-0 left-0 right-0 h-4 translate-y-1/2 cursor-s-resize" :
                  id === "w" ? "top-0 bottom-0 left-0 w-4 -translate-x-1/2 cursor-w-resize" :
                  "top-0 bottom-0 right-0 w-4 translate-x-1/2 cursor-e-resize"
                }`}
                onMouseDown={(e) => handleStart(e, id)}
                onTouchStart={(e) => handleStart(e, id)}
              />
            ))}
            
            {/* Visual Grid */}
            <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 opacity-30 pointer-events-none">
              <div className="border-r border-b border-white/50" />
              <div className="border-r border-b border-white/50" />
              <div className="border-b border-white/50" />
              <div className="border-r border-b border-white/50" />
              <div className="border-r border-b border-white/50" />
              <div className="border-b border-white/50" />
              <div className="border-r border-white/50" />
              <div className="border-r border-white/50" />
            </div>
          </div>
        </div>

        <div className="p-6 flex gap-4 bg-surface-container-low border-t border-outline-variant/10">
          <button onClick={onCancel} className="flex-1 py-4 text-xs font-bold uppercase tracking-widest text-on-surface-variant hover:bg-surface-variant rounded-2xl transition-colors">Cancel</button>
          <button onClick={executeCrop} className="flex-[2] py-4 bg-primary text-on-primary text-xs font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-primary/20 hover:scale-95 active:scale-90 transition-all flex items-center justify-center gap-2">
            <span className="material-symbols-outlined text-sm">check_circle</span>
            Apply Crop
          </button>
        </div>
      </div>
    </div>
  );
}
