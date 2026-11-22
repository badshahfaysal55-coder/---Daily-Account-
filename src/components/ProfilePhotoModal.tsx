import React, { useState, useRef, useEffect } from 'react';
import { 
  X, 
  Upload, 
  Trash2, 
  Camera, 
  Check, 
  AlertCircle, 
  ZoomIn, 
  ZoomOut, 
  RotateCw, 
  Move, 
  RefreshCw,
  Loader2,
  Image as ImageIcon 
} from 'lucide-react';
import { UserAccount } from '../types/accounting';
import { ApiService } from '../services/api';
import { Language } from '../utils/translations';

interface ProfilePhotoModalProps {
  targetUser: UserAccount;
  currentUser: UserAccount;
  currentLang?: Language;
  isOpen: boolean;
  onClose: () => void;
  onPhotoUpdated: (userId: string, newPhotoUrl?: string) => void;
}

export const ProfilePhotoModal: React.FC<ProfilePhotoModalProps> = ({
  targetUser,
  currentUser,
  currentLang = 'en',
  isOpen,
  onClose,
  onPhotoUpdated,
}) => {
  const isBn = currentLang === 'bn';
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  const initialPhoto = targetUser.photoUrl || targetUser.photoData || ApiService.getPhotoBackup(targetUser.id) || null;
  const [previewUrl, setPreviewUrl] = useState<string | null>(initialPhoto);
  const [hasNewImage, setHasNewImage] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setPreviewUrl(targetUser.photoUrl || targetUser.photoData || ApiService.getPhotoBackup(targetUser.id) || null);
      setHasNewImage(false);
      setZoom(1);
      setRotation(0);
      setPan({ x: 0, y: 0 });
      setError(null);
      setSuccessMsg(null);
    }
  }, [isOpen, targetUser.photoUrl, targetUser.photoData, targetUser.id]);

  if (!isOpen) return null;

  const isOwner = currentUser.role === 'owner';
  const isSelf = currentUser.id === targetUser.id;
  const canManage = isOwner || (isSelf && currentUser.canChangeProfilePhoto !== false);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    setSuccessMsg(null);
    const file = e.target.files?.[0];
    if (!file) return;

    // Support any normal image format (JPG, JPEG, PNG, WEBP, GIF, HEIC/HEIF, BMP, SVG)
    if (!file.type.startsWith('image/') && !file.name.match(/\.(jpe?g|png|webp|gif|heic|heif|bmp|svg)$/i)) {
      setError(isBn ? 'অনুগ্রহ করে একটি ছবি ফাইল নির্বাচন করুন (JPG, PNG, WebP, GIF, HEIC)।' : 'Please select a valid image file (JPG, PNG, WebP, GIF, or HEIC).');
      return;
    }

    if (file.size > 25 * 1024 * 1024) {
      setError(isBn ? 'ছবির সাইজ ২৫MB এর নিচে হতে হবে।' : 'File size exceeds maximum allowed size of 25MB.');
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => {
      setError(isBn ? 'ছবিটি পড়তে ব্যর্থ হয়েছে।' : 'Failed to read image file.');
    };
    reader.onload = () => {
      setPreviewUrl(reader.result as string);
      setHasNewImage(true);
      setZoom(1);
      setRotation(0);
      setPan({ x: 0, y: 0 });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Mouse drag handlers for repositioning
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

  const handleMouseUp = () => setIsDragging(false);

  // Touch handlers for mobile repositioning
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      setDragStart({ x: e.touches[0].clientX - pan.x, y: e.touches[0].clientY - pan.y });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || e.touches.length !== 1) return;
    setPan({
      x: e.touches[0].clientX - dragStart.x,
      y: e.touches[0].clientY - dragStart.y,
    });
  };

  const handleTouchEnd = () => setIsDragging(false);

  const handleRotate = () => {
    setRotation((r) => (r + 90) % 360);
  };

  const handleResetTransforms = () => {
    setZoom(1);
    setRotation(0);
    setPan({ x: 0, y: 0 });
  };

  // Crop & Compress on Canvas before uploading
  const handleSavePhoto = async () => {
    if (!previewUrl || !canManage) return;

    if (!hasNewImage && previewUrl === targetUser.photoUrl && zoom === 1 && rotation === 0 && pan.x === 0 && pan.y === 0) {
      onClose();
      return;
    }

    setIsUploading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      let finalDataUrl = previewUrl;

      // Draw onto canvas with zoom, pan, and rotation
      if (imageRef.current) {
        const img = imageRef.current;
        const canvas = document.createElement('canvas');
        const size = 500; // standard crisp avatar output
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, size, size);

          ctx.translate(size / 2, size / 2);
          ctx.rotate((rotation * Math.PI) / 180);
          ctx.scale(zoom, zoom);

          const drawWidth = size;
          const drawHeight = (img.naturalHeight / img.naturalWidth) * size;
          const panFactor = size / 220; // scale factor of preview circle

          ctx.drawImage(
            img,
            -drawWidth / 2 + (pan.x * panFactor) / zoom,
            -drawHeight / 2 + (pan.y * panFactor) / zoom,
            drawWidth,
            drawHeight
          );

          try {
            finalDataUrl = canvas.toDataURL('image/jpeg', 0.88);
          } catch {
            finalDataUrl = previewUrl;
          }
        }
      }

      const res = await ApiService.uploadUserPhoto(targetUser.id, finalDataUrl);
      if (res.success && res.photoUrl) {
        setSuccessMsg(isBn ? 'প্রোফাইল ছবি সফলভাবে ক্লাউড ডাটাবেজে সংরক্ষিত হয়েছে।' : 'Profile photo successfully uploaded and saved.');
        onPhotoUpdated(targetUser.id, res.photoUrl);
        setTimeout(() => {
          onClose();
        }, 600);
      }
    } catch (err: any) {
      console.error('Failed to save photo:', err);
      setError(err.message || (isBn ? 'ছবি সেভ করতে ব্যর্থ হয়েছে' : 'Failed to save photo. Please try again.'));
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemovePhoto = async () => {
    if (!canManage) return;
    setIsUploading(true);
    setError(null);
    try {
      await ApiService.deleteUserPhoto(targetUser.id);
      setPreviewUrl(null);
      setHasNewImage(false);
      onPhotoUpdated(targetUser.id, undefined);
      setSuccessMsg(isBn ? 'প্রোফাইল ছবি মুছে ফেলা হয়েছে।' : 'Profile photo removed.');
      setTimeout(() => {
        onClose();
      }, 600);
    } catch (err: any) {
      setError(err.message || (isBn ? 'ছবি অপসারণ করতে ব্যর্থ হয়েছে' : 'Failed to delete photo'));
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-3 sm:p-4 safe-area-top safe-area-bottom animate-in fade-in duration-200 overflow-y-auto">
      <div className="bg-white dark:bg-[#101A2C] rounded-3xl max-w-md w-full p-4 sm:p-6 shadow-2xl border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white relative my-auto max-h-[calc(100dvh-1.5rem)] sm:max-h-[90dvh] overflow-y-auto text-xs">
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500 shrink-0">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base font-heading">
                {isBn ? 'প্রোফাইল ছবি ব্যবস্থাপনা' : 'Profile Photo Manager'}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {targetUser.name} (@{targetUser.username})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Alerts */}
        {!canManage && (
          <div className="mt-3 p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="flex-1">
              {isBn
                ? 'প্রোফাইল ছবি পরিবর্তন বা মুছে ফেলার অনুমতি ওনার কর্তৃক বন্ধ করা হয়েছে।'
                : 'Profile photo changes are locked by Owner permission.'}
            </span>
          </div>
        )}

        {error && (
          <div className="mt-3 p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="flex-1">{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="mt-3 p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2.5">
            <Check className="w-4 h-4 shrink-0" />
            <span className="flex-1">{successMsg}</span>
          </div>
        )}

        {/* Interactive Viewport Circle */}
        <div className="mt-4 flex flex-col items-center">
          <div
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            className="relative w-56 h-56 sm:w-64 sm:h-64 rounded-full overflow-hidden bg-slate-950 border-4 border-[#D4AF37] shadow-xl flex items-center justify-center cursor-grab active:cursor-grabbing select-none touch-none"
          >
            {previewUrl ? (
              <img
                ref={imageRef}
                src={previewUrl}
                crossOrigin={!previewUrl.startsWith('data:') ? 'anonymous' : undefined}
                alt="Profile Preview"
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
              <div className="text-center text-slate-400 p-4">
                <ImageIcon className="w-12 h-12 mx-auto mb-2 opacity-40 text-[#D4AF37]" />
                <span className="text-xs font-semibold block">No Photo Selected</span>
                <span className="text-[10px] text-slate-500 mt-1 block">Choose from Gallery, Files, or Camera</span>
              </div>
            )}

            {/* Reposition guide hint overlay */}
            {previewUrl && (
              <div className="absolute inset-0 rounded-full border border-white/20 pointer-events-none" />
            )}
          </div>

          <span className="text-[10px] text-slate-400 mt-2 flex items-center gap-1">
            <Move className="w-3 h-3 text-amber-400" />
            <span>Drag or swipe to center • Supported: JPG, PNG, WebP, GIF, HEIC</span>
          </span>
        </div>

        {/* Interactive Controls: Zoom Slider & Rotate */}
        {previewUrl && (
          <div className="mt-4 space-y-2.5 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-2xl border border-slate-200/60 dark:border-slate-700/60">
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setZoom((z) => Math.max(0.5, z - 0.1))}
                className="p-1 text-slate-400 hover:text-slate-800 dark:hover:text-white"
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
                className="flex-1 accent-[#D4AF37] cursor-pointer h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg"
              />
              <button
                type="button"
                onClick={() => setZoom((z) => Math.min(3, z + 0.1))}
                className="p-1 text-slate-400 hover:text-slate-800 dark:hover:text-white"
                title="Zoom In"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <span className="font-mono text-[11px] font-bold text-slate-700 dark:text-slate-300 w-10 text-right">
                {Math.round(zoom * 100)}%
              </span>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
              <button
                type="button"
                onClick={handleRotate}
                className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 font-semibold text-[11px] text-slate-700 dark:text-slate-200 flex items-center gap-1.5 hover:border-amber-400 shadow-xs cursor-pointer"
              >
                <RotateCw className="w-3.5 h-3.5 text-amber-500" />
                <span>Rotate 90°</span>
              </button>

              <button
                type="button"
                onClick={handleResetTransforms}
                className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 font-medium text-[11px] text-slate-600 dark:text-slate-300 flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Reset View</span>
              </button>
            </div>
          </div>
        )}

        {/* Hidden inputs */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.heic,.heif"
          onChange={handleFileSelect}
          className="hidden"
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileSelect}
          className="hidden"
        />

        {/* Selection buttons */}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={!canManage || isUploading}
            onClick={() => fileInputRef.current?.click()}
            className="py-2.5 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs border border-slate-200 dark:border-slate-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Upload className="w-3.5 h-3.5 text-amber-500" />
            <span>Choose from Files</span>
          </button>
          <button
            type="button"
            disabled={!canManage || isUploading}
            onClick={() => cameraInputRef.current?.click()}
            className="py-2.5 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs border border-slate-200 dark:border-slate-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Camera className="w-3.5 h-3.5 text-blue-500" />
            <span>Take Photo</span>
          </button>
        </div>

        {/* Action Buttons */}
        <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
          {previewUrl && (
            <button
              type="button"
              onClick={handleRemovePhoto}
              disabled={isUploading || !canManage}
              className="px-3 py-2.5 rounded-xl border border-rose-300 dark:border-rose-900/60 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Remove Photo</span>
            </button>
          )}

          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={onClose}
              disabled={isUploading}
              className="px-3.5 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleSavePhoto}
              disabled={isUploading || !previewUrl || !canManage}
              className="px-4 py-2.5 bg-[#D4AF37] hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-md transition cursor-pointer disabled:opacity-40"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Save Photo</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
