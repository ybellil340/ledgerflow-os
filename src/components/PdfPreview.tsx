import { useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

interface PdfPreviewProps {
  url: string;
  className?: string;
}

export default function PdfPreview({ url, className = "" }: PdfPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const render = async () => {
      setLoading(true);
      setError(null);
      if (!containerRef.current) return;
      containerRef.current.innerHTML = "";

      try {
        const pdf = await pdfjsLib.getDocument(url).promise;
        if (cancelled) return;

        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const containerWidth = containerRef.current?.clientWidth || 400;
          const unscaledViewport = page.getViewport({ scale: 1 });
          const scale = containerWidth / unscaledViewport.width;
          const viewport = page.getViewport({ scale });

          const canvas = document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.style.width = "100%";
          canvas.style.marginBottom = "8px";
          canvas.style.borderRadius = "6px";

          const ctx = canvas.getContext("2d");
          if (!ctx) continue;
          await page.render({ canvasContext: ctx, viewport }).promise;
          if (cancelled) return;
          containerRef.current?.appendChild(canvas);
        }
      } catch (e: any) {
        if (!cancelled) setError(e.message || "Failed to load PDF");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    render();
    return () => { cancelled = true; };
  }, [url]);

  return (
    <div className={className}>
      {loading && <p className="text-sm text-muted-foreground text-center py-8">Loading PDF…</p>}
      {error && <p className="text-sm text-destructive text-center py-8">{error}</p>}
      <div ref={containerRef} className="w-full overflow-y-auto" />
    </div>
  );
}
