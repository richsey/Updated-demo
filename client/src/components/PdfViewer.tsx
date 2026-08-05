import { useState, useEffect, useRef } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trackPdfOpen } from "@/lib/telemetry/studentTracker";
import { useAuth } from "@/contexts/AuthContext";
import { useParams } from "react-router-dom";

// Required to set up the worker for react-pdf
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PdfViewerProps {
  fileUrl: string;
  onReadComplete: () => void;
}

export default function PdfViewer({ fileUrl, onReadComplete }: PdfViewerProps) {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const { materialId } = useParams();
  
  const lastPageRef = useRef<HTMLDivElement>(null);
  const hasTriggeredComplete = useRef(false);

  useEffect(() => {
    if (user?.id && materialId) {
      trackPdfOpen(user.id, materialId);
    }
  }, [user?.id, materialId]);

  useEffect(() => {
    if (pageNumber === numPages && numPages !== null && !hasTriggeredComplete.current && lastPageRef.current) {
      const observer = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting) {
            onReadComplete();
            hasTriggeredComplete.current = true;
            observer.disconnect();
          }
        },
        { threshold: 0.5 }
      );
      
      observer.observe(lastPageRef.current);
      return () => observer.disconnect();
    }
  }, [pageNumber, numPages, onReadComplete]);

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
    setIsLoading(false);
  }

  function onDocumentLoadError(err: Error) {
    setError(err.message);
    setIsLoading(false);
  }

  function changePage(offset: number) {
    setPageNumber((prevPageNumber) => prevPageNumber + offset);
  }

  function previousPage() {
    changePage(-1);
  }

  function nextPage() {
    changePage(1);
  }

  return (
    <div className="flex flex-col items-center w-full max-w-4xl mx-auto bg-card rounded-2xl shadow-xl overflow-hidden border border-border/40">
      {isLoading && !error && (
        <div className="flex items-center justify-center p-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}
      
      {error && (
        <div className="flex flex-col items-center justify-center p-20 text-destructive text-center">
          <p className="font-semibold mb-2">Failed to load PDF document.</p>
          <p className="text-sm opacity-80">{error}</p>
        </div>
      )}

      {!error && (
        <>
          <div className="w-full overflow-auto bg-black/5 flex justify-center py-4 relative min-h-[600px]">
            <Document
              file={fileUrl}
              onLoadSuccess={onDocumentLoadSuccess}
              onLoadError={onDocumentLoadError}
              loading={<div className="absolute inset-0 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}
              className="max-w-full"
            >
              {numPages !== null && (
                <div ref={pageNumber === numPages ? lastPageRef : null} className="shadow-lg">
                  <Page 
                    pageNumber={pageNumber} 
                    renderTextLayer={false} 
                    renderAnnotationLayer={false} 
                    width={Math.min(window.innerWidth - 40, 800)} 
                    className="max-w-full"
                  />
                </div>
              )}
            </Document>
          </div>

          {numPages !== null && (
            <div className="flex items-center justify-between w-full p-4 border-t border-border/40 bg-card">
              <Button
                variant="outline"
                disabled={pageNumber <= 1}
                onClick={previousPage}
                className="w-24"
              >
                Previous
              </Button>
              <p className="text-sm font-medium">
                Page {pageNumber} of {numPages}
              </p>
              <Button
                variant="outline"
                disabled={pageNumber >= numPages}
                onClick={nextPage}
                className="w-24"
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
