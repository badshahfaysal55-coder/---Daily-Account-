import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  X, 
  ZoomIn, 
  ZoomOut, 
  RotateCw, 
  Check, 
  Camera, 
  Upload, 
  Image as ImageIcon, 
  Move, 
  Maximize2, 
  Square, 
  RefreshCw,
  AlertCircle
} from 'lucide-react';

interface ImageCropModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImageCropped: (dataUrl: string) => void;
  title?: string;
  initialImage?: string | null;
  cropShape?: 'round' | 'rect';
  aspectRatioPreset?: '1:1' | 'free' | '4:3' | '16:9';
}

export const ImageCropModal: React.FC<ImageCropModalProps> = ({
  isOpen,
  onClose,
  onImageCropped,
  title = 'Edit & Crop Image',
  initialImage = null,
  cropShape = 'round',
  aspectRatioPreset = '1:1',
}) => {
  const [imageSrc, setImageSrc] = useState<string | null>(initialImage);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0); // in degrees: 0, 90, 180, 270
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [aspectRatio, setAspectRatio] = useState<'1:1' | 'free' | '4:3' | '16:9'>(aspectRatioPreset);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (initialImage) {
      setImageSrc(initialImage);
    }
    setZoom(1);
    setRotation(0);
    setPan({ x: 0, y: 0 });
    setErrorMsg(null);
  }, [initialImage, isOpen]);

  if (!isOpen) return null;

  // Handle image selection from input
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg(null);
    const file = e.target.files?.[0];
    if (!file) return;

    // Support any valid image format (JPG, PNG, WEBP, GIF, HEIC/HEIF, BMP, SVG)
    if (!file.type.startsWith('image/') && !file.name.match(/\.(jpe?g|png|webp|gif|heic|heif|bmp|svg)$/i)) {
      setErrorMsg('Please select a valid image file (JPG, PNG, WebP, GIF, or HEIC).');
      return;
    }

    if (file.size > 25 * 1024 * 1024) {
      setErrorMsg('Image file size is too large (max 25MB). Please choose a smaller photo.');
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => {
      setErrorMsg('Failed to read the selected image file. Please try another image.');
    };
    reader.onload = () => {
      setImageSrc(reader.result as string);
      setZoom(1);
      setRotation(0);
      setPan({ x: 0, y: 0 });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Dragging / Pan handling
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Touch handlers for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      setIsDragging(true);
      setDragStart({ x: touch.clientX - pan.x, y: touch.clientY - pan.y });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || e.touches.length !== 1) return;
    const touch = e.touches[0];
    setPan({
      x: touch.clientX - dragStart.x,
      y: touch.clientY - dragStart.y,
    });
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  // Rotate 90 degrees
  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  // Reset transforms
  const handleReset = () => {
    setZoom(1);
    setRotation(0);
    setPan({ x: 0, y: 0 });
  };

  // Generate cropped output on HTML5 Canvas
  const handleApplyCrop = () => {
    if (!imageSrc || !imageRef.current) return;

    try {
      const img = imageRef.current;
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not get canvas context');

      // Target output dimension (sharp & high resolution, max 800px)
      let targetWidth = 600;
      let targetHeight = 600;

      if (aspectRatio === '4:3') {
        targetWidth = 800;
        targetHeight = 600;
      } else if (aspectRatio === '16:9') {
        targetWidth = 800;
        targetHeight = 450;
      } else if (aspectRatio === 'free') {
        const aspect = img.naturalWidth / img.naturalHeight;
        if (aspect > 1) {
          targetWidth = 800;
          targetHeight = Math.round(800 / aspect);
        } else {
          targetHeight = 800;
          targetWidth = Math.round(800 * aspect);
        }
      }

      canvas.width = targetWidth;
      canvas.height = targetHeight;

      // Fill clean background (white for opaque output)
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, targetWidth, targetHeight);

      // Translate to center of canvas
      ctx.translate(targetWidth / 2, targetHeight / 2);

      // Apply user rotation
      ctx.rotate((rotation * Math.PI) / 180);

      // Apply zoom and panning
      const scale = zoom;
      ctx.scale(scale, scale);

      // Calculate source image draw size
      const drawWidth = targetWidth;
      const drawHeight = (img.naturalHeight / img.naturalWidth) * targetWidth;

      // Pan offset proportional to zoom
      const panFactor = targetWidth / 280; // container view scale
      ctx.drawImage(
        img,
        -drawWidth / 2 + (pan.x * panFactor) / scale,
        -drawHeight / 2 + (pan.y * panFactor) / scale,
        drawWidth,
        drawHeight
      );

      // Export as high quality WebP/JPEG (0.88 quality is visually indistinguishable from raw but ~100-200KB)
      const croppedDataUrl = canvas.toDataURL('image/jpeg', 0.88);
      onImageCropped(croppedDataUrl);
      onClose();
    } catch (err) {
      console.error('Error cropping image:', err);
      setErrorMsg('Failed to crop image. Please try again or select another image.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-4 sm:p-6 shadow-2xl relative my-auto border border-slate-200 dark:border-slate-800 text-xs">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base font-heading">
              {title}
            </h3>
            <p className="text-[11px] text-slate-400">
              Drag to reposition, use slider to zoom, and rotate any image format
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {errorMsg && (
          <div className="mt-3 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Image Selection Buttons */}
        <div className="mt-3.5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Upload className="w-3.5 h-3.5 text-amber-500" />
            <span>Choose from Files / Gallery</span>
          </button>

          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Camera className="w-3.5 h-3.5 text-blue-500" />
            <span>Take Photo (Camera)</span>
          </button>

          {imageSrc && (
            <button
              type="button"
              onClick={handleReset}
              className="px-2.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 font-medium flex items-center gap-1 ml-auto cursor-pointer"
              title="Reset Zoom & Position"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          )}
        </div>

        {/* Hidden inputs */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.heic,.heif"
          onChange={handleFileChange}
          className="hidden"
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileChange}
          className="hidden"
        />

        {/* Interactive Viewport Canvas Area */}
        <div className="mt-4 flex flex-col items-center">
          <div
            ref={containerRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            className={`relative w-72 h-72 sm:w-80 sm:h-80 bg-slate-950 rounded-2xl overflow-hidden shadow-inner flex items-center justify-center cursor-grab active:cursor-grabbing border-2 border-slate-700 select-none touch-none ${
              aspectRatio === '4:3' ? '!h-60' : aspectRatio === '16:9' ? '!h-48' : ''
            }`}
          >
            {imageSrc ? (
              <img
                ref={imageRef}
                src={imageSrc}
                alt="Crop Target"
                draggable={false}
                style={{
                  transform: `translate(${pan.x}px, ${pan.y}px) rotate(${rotation}deg) scale(${zoom})`,
                  transformOrigin: 'center center',
                  maxHeight: '100%',
                  maxWidth: '100%',
                  objectFit: 'contain',
                }}
                className="transition-transform duration-75 pointer-events-none select-none"
              />
            ) : (
              <div className="text-center text-slate-400 p-6 flex flex-col items-center">
                <ImageIcon className="w-12 h-12 mb-2 opacity-50" />
                <p className="font-semibold text-xs text-slate-300">No Image Selected</p>
                <p className="text-[10px] text-slate-500 mt-1">
                  Choose an image from files or take a photo with your camera
                </p>
              </div>
            )}

            {/* Overlay Guide Mask */}
            {imageSrc && (
              <div className="absolute inset-0 pointer-events-none">
                {cropShape === 'round' && aspectRatio === '1:1' ? (
                  <div className="w-full h-full rounded-full border-2 border-amber-400/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.55)]" />
                ) : (
                  <div className="w-full h-full border-2 border-amber-400/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.55)]" />
                )}
                {/* Rule of thirds grid lines */}
                <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 opacity-25">
                  <div className="border-r border-b border-white" />
                  <div className="border-r border-b border-white" />
                  <div className="border-b border-white" />
                  <div className="border-r border-b border-white" />
                  <div className="border-r border-b border-white" />
                  <div className="border-b border-white" />
                  <div className="border-r border-white" />
                  <div className="border-r border-white" />
                  <div />
                </div>
              </div>
            )}
          </div>
          <span className="text-[10px] text-slate-400 mt-2 flex items-center gap-1">
            <Move className="w-3 h-3" />
            <span>Click and drag or swipe to reposition the photo</span>
          </span>
        </div>

        {/* Controls: Zoom, Rotate & Aspect Ratio */}
        {imageSrc && (
          <div className="mt-4 space-y-3 bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-2xl border border-slate-200/60 dark:border-slate-700/60">
            {/* Zoom Slider */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setZoom((z) => Math.max(0.5, z - 0.1))}
                className="p-1 text-slate-500 hover:text-slate-800 dark:hover:text-white"
                title="Zoom Out"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <input
                type="range"
                min="0.5"
                max="3"
                step="0.05"
                value={zoom}
                onChange={(e) => setZoom(parseFloat(e.target.value))}
                className="flex-1 accent-amber-500 cursor-pointer h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg"
              />
              <button
                type="button"
                onClick={() => setZoom((z) => Math.min(3, z + 0.1))}
                className="p-1 text-slate-500 hover:text-slate-800 dark:hover:text-white"
                title="Zoom In"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <span className="font-mono text-[11px] font-bold text-slate-700 dark:text-slate-300 w-12 text-right">
                {Math.round(zoom * 100)}%
              </span>
            </div>

            {/* Rotate & Aspect Ratio Presets */}
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex-wrap">
              <button
                type="button"
                onClick={handleRotate}
                className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 font-semibold text-[11px] text-slate-700 dark:text-slate-200 flex items-center gap-1.5 hover:border-amber-400 shadow-xs cursor-pointer"
              >
                <RotateCw className="w-3.5 h-3.5 text-amber-500" />
                <span>Rotate 90°</span>
              </button>

              <div className="flex items-center gap-1 bg-slate-200/70 dark:bg-slate-900 p-0.5 rounded-xl text-[10px] font-semibold">
                <button
                  type="button"
                  onClick={() => setAspectRatio('1:1')}
                  className={`px-2 py-1 rounded-lg transition ${
                    aspectRatio === '1:1'
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-bold'
                      : 'text-slate-500'
                  }`}
                >
                  Square (1:1)
                </button>
                <button
                  type="button"
                  onClick={() => setAspectRatio('free')}
                  className={`px-2 py-1 rounded-lg transition ${
                    aspectRatio === 'free'
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-bold'
                      : 'text-slate-500'
                  }`}
                >
                  Original
                </button>
                <button
                  type="button"
                  onClick={() => setAspectRatio('4:3')}
                  className={`px-2 py-1 rounded-lg transition ${
                    aspectRatio === '4:3'
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-bold'
                      : 'text-slate-500'
                  }`}
                >
                  4:3
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800 flex gap-2">
          <button
            type="button"
            disabled={!imageSrc}
            onClick={handleApplyCrop}
            className="flex-1 py-2.5 bg-[#D4AF37] hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs sm:text-sm flex items-center justify-center gap-1.5 transition cursor-pointer shadow-md disabled:opacity-40"
          >
            <Check className="w-4 h-4" />
            <span>Save & Apply Image</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs sm:text-sm font-semibold hover:bg-slate-200"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
