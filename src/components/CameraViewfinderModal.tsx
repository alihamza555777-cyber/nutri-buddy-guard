import { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Camera,
  RotateCw,
  X,
  AlertCircle,
  Sparkles,
  Check,
} from "lucide-react";

interface CameraViewfinderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (base64Image: string) => void;
}

export function CameraViewfinderModal({
  isOpen,
  onClose,
  onCapture,
}: CameraViewfinderModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [isOpen, facingMode]);

  async function startCamera() {
    setIsInitializing(true);
    setCameraError(null);
    stopCamera();

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Webcam access is not supported by your browser.");
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facingMode,
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch (err: any) {
      console.error("Camera access error:", err);
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        setCameraError("Camera access denied. Please enable camera permissions or upload an image file.");
      } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
        setCameraError("No camera device found on your device.");
      } else {
        setCameraError(err.message || "Camera access denied. Please enable camera permissions or upload an image file.");
      }
    } finally {
      setIsInitializing(false);
    }
  }

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }

  function handleSnap() {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) {
      setCameraError("Camera stream is not ready yet. Please try again.");
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");

    if (!ctx) return;

    // Flip horizontally if front camera
    if (facingMode === "user") {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const base64 = canvas.toDataURL("image/jpeg", 0.92);

    stopCamera();
    onCapture(base64);
    onClose();
  }

  function toggleCamera() {
    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92vh] w-full max-w-xl overflow-hidden rounded-[2rem] border border-slate-200 bg-white p-5 text-slate-900 shadow-2xl sm:p-6 dark:border-slate-800 dark:bg-slate-900 dark:text-white">
        <DialogHeader className="text-left pr-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[#008000]/20 bg-[#008000]/10 text-[#008000]">
              <Camera className="h-5 w-5 text-[#008000]" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                Live Camera Viewfinder
              </DialogTitle>
              <DialogDescription className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Align dish within frame and tap shutter to scan instantly
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Viewfinder Video Stream Container */}
        <div className="relative mt-4 flex min-h-[320px] w-full flex-col items-center justify-center overflow-hidden rounded-2xl bg-slate-950 border border-slate-200 dark:border-slate-800">
          {cameraError ? (
            <div className="p-6 text-center">
              <AlertCircle className="mx-auto h-10 w-10 text-rose-500" />
              <p className="mt-3 text-sm font-semibold text-rose-200">{cameraError}</p>
              <button
                type="button"
                onClick={startCamera}
                className="mt-4 rounded-full bg-[#008000] px-5 py-2 text-xs font-bold text-white hover:bg-[#006600]"
              >
                Try Reconnecting Camera
              </button>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`h-full w-full object-cover min-h-[320px] max-h-[420px] ${
                  facingMode === "user" ? "scale-x-[-1]" : ""
                }`}
              />

              {/* Viewfinder Target Frame Overlay */}
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-8">
                <div className="relative h-56 w-56 rounded-3xl border-2 border-dashed border-[#008000] shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]">
                  <div className="absolute -top-3 -left-3 h-6 w-6 border-t-4 border-l-4 border-[#008000] rounded-tl-xl" />
                  <div className="absolute -top-3 -right-3 h-6 w-6 border-t-4 border-r-4 border-[#008000] rounded-tr-xl" />
                  <div className="absolute -bottom-3 -left-3 h-6 w-6 border-b-4 border-l-4 border-[#008000] rounded-bl-xl" />
                  <div className="absolute -bottom-3 -right-3 h-6 w-6 border-b-4 border-r-4 border-[#008000] rounded-br-xl" />
                </div>
              </div>

              {isInitializing && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/70 backdrop-blur-xs">
                  <div className="flex items-center gap-2 text-sm font-semibold text-white">
                    <Sparkles className="h-5 w-5 animate-spin text-[#008000]" />
                    <span>Connecting live camera…</span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Bottom Shutter & Controls Bar */}
        {!cameraError && (
          <div className="mt-5 flex items-center justify-around px-4">
            {/* Flip Camera Button - Light Theme */}
            <button
              type="button"
              onClick={toggleCamera}
              className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 border border-slate-200/80 text-slate-700 transition hover:bg-slate-200 hover:text-slate-900 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-700"
              title="Flip camera (front/rear)"
            >
              <RotateCw className="h-5 w-5" />
            </button>

            {/* Prominent Primary Green Circular Shutter Button */}
            <button
              type="button"
              onClick={handleSnap}
              disabled={isInitializing}
              className="flex h-16 w-16 items-center justify-center rounded-full bg-[#008000] text-white shadow-xl transition-all hover:scale-105 hover:bg-[#006600] active:scale-95 border-4 border-white disabled:opacity-50 cursor-pointer"
              title="Snap Photo & Scan Instant"
            >
              <div className="h-7 w-7 rounded-full bg-white/20 flex items-center justify-center">
                <Check className="h-4 w-4 text-white" />
              </div>
            </button>

            {/* Close Button - Light Theme */}
            <button
              type="button"
              onClick={onClose}
              className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 border border-slate-200/80 text-slate-700 transition hover:bg-slate-200 hover:text-slate-900 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-700"
              title="Close camera"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
