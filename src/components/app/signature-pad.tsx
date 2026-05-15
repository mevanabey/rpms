"use client";

import { useEffect, useRef, useState } from "react";

import { Eraser, PenLine } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Minimal canvas-backed signature pad. No extra deps — tracks pointer
 * events, draws a smooth stroke, and exposes `onChange(dataUrl)` for
 * persistence. Trim-to-bounding-box happens at save time so the saved
 * PNG is as compact as the user's actual scribble.
 */
export function SignaturePad({
  width = 480,
  height = 140,
  initialDataUrl,
  onChange,
  className,
  disabled = false,
}: {
  width?: number;
  height?: number;
  initialDataUrl?: string;
  onChange?: (dataUrl: string | null) => void;
  className?: string;
  disabled?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const lastRef = useRef<{ x: number; y: number } | null>(null);
  const [hasInk, setHasInk] = useState(false);

  // Initial paint — either the saved signature, or a blank surface.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    // Backing store at device pixel ratio for crisp lines.
    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#111827";
    ctx.fillStyle = "transparent";
    ctx.clearRect(0, 0, width, height);
    if (initialDataUrl) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, width, height);
        setHasInk(true);
      };
      img.src = initialDataUrl;
    } else {
      // Reset ink flag when remounted without an initial signature.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHasInk(false);
    }
  }, [width, height, initialDataUrl]);

  const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    const rect = canvas.getBoundingClientRect();
    lastRef.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current || disabled) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const last = lastRef.current ?? { x, y };
    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(x, y);
    ctx.stroke();
    lastRef.current = { x, y };
    if (!hasInk) setHasInk(true);
  };

  const end = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    const canvas = canvasRef.current;
    if (canvas) {
      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch {
        /* no-op */
      }
    }
    drawingRef.current = false;
    lastRef.current = null;
    emit();
  };

  const emit = () => {
    if (!onChange) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!hasInk) {
      onChange(null);
      return;
    }
    onChange(canvas.toDataURL("image/png"));
  };

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);
    setHasInk(false);
    onChange?.(null);
  };

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="relative rounded-md border bg-card">
        <canvas
          ref={canvasRef}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerLeave={end}
          className={cn(
            "block touch-none rounded-md",
            disabled ? "cursor-not-allowed opacity-60" : "cursor-crosshair",
          )}
        />
        {!hasInk && !disabled && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-muted-foreground text-xs">
            <PenLine className="mr-2 size-3.5" /> Sign here
          </div>
        )}
      </div>
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-[11px]">
          Hand-drawn signature · stored locally.
        </p>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={clear}
          disabled={!hasInk || disabled}
        >
          <Eraser className="size-3.5" /> Clear
        </Button>
      </div>
    </div>
  );
}
