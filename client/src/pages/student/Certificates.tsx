import { useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { fetchUserCertificates } from "@/lib/api/certificates";
import type { Certificate } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Award, Download, Share2, Loader2, QrCode } from "lucide-react";
import { toast } from "@/hooks/use-toast";

function CertificateCard({ cert }: { cert: Certificate }) {
  const cardRef = useRef<HTMLDivElement>(null);

  const handleDownload = () => {
    if (!cardRef.current) return;
    // Print the specific certificate card
    const printContent = cardRef.current.outerHTML;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Certificate — ${cert.courses?.title}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: Georgia, serif; background: white; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
            .cert-outer { width: 800px; border: 8px solid #1e3a5f; padding: 40px; background: white; }
            .cert-logo { font-size: 28px; font-weight: 900; color: #1e3a5f; text-align: center; margin-bottom: 8px; }
            .cert-subtitle { text-align: center; color: #6b7280; margin-bottom: 32px; font-size: 14px; letter-spacing: 2px; text-transform: uppercase; }
            .cert-title { font-size: 42px; font-weight: 700; color: #1e3a5f; text-align: center; margin-bottom: 24px; }
            .cert-student { font-size: 36px; font-weight: 400; color: #111827; text-align: center; border-bottom: 2px solid #1e3a5f; display: inline-block; padding-bottom: 4px; margin: 0 auto 24px; display: block; }
            .cert-body { font-size: 16px; color: #374151; text-align: center; margin-bottom: 8px; }
            .cert-course { font-size: 24px; font-weight: 700; color: #1e3a5f; text-align: center; margin: 8px 0 24px; }
            .cert-details { display: flex; justify-content: space-around; margin: 24px 0; }
            .cert-detail { text-align: center; }
            .cert-detail-label { font-size: 11px; color: #9ca3af; text-transform: uppercase; letter-spacing: 1px; }
            .cert-detail-value { font-size: 14px; font-weight: 600; color: #1f2937; margin-top: 4px; }
            .cert-id { text-align: center; font-size: 11px; color: #9ca3af; margin-top: 24px; }
          </style>
        </head>
        <body>
          <div class="cert-outer">
            <div class="cert-logo">DataFlow AI</div>
            <div class="cert-subtitle">Certificate of Completion</div>
            <div class="cert-title">This is to certify that</div>
            <div class="cert-student">${cert.profiles?.full_name ?? "Student"}</div>
            <div class="cert-body">has successfully completed the course</div>
            <div class="cert-course">${cert.courses?.title ?? "Course"}</div>
            <div class="cert-details">
              <div class="cert-detail">
                <div class="cert-detail-label">Instructor</div>
                <div class="cert-detail-value">${cert.courses?.instructor ?? "—"}</div>
              </div>
              <div class="cert-detail">
                <div class="cert-detail-label">Date</div>
                <div class="cert-detail-value">${new Date(cert.issued_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</div>
              </div>
              <div class="cert-detail">
                <div class="cert-detail-label">Category</div>
                <div class="cert-detail-value">${cert.courses?.category ?? "—"}</div>
              </div>
            </div>
            <div class="cert-id">Certificate ID: ${cert.certificate_uid}</div>
          </div>
        </body>
      </html>
    `);
    win.document.close();
    setTimeout(() => { win.print(); win.close(); }, 500);
  };

  const handleShare = async () => {
    const text = `I just completed "${cert.courses?.title}" on DataFlow AI! Certificate ID: ${cert.certificate_uid}`;
    if (navigator.share) {
      await navigator.share({ title: "My Certificate", text });
    } else {
      await navigator.clipboard.writeText(text);
      toast({ title: "Copied to clipboard!" });
    }
  };

  return (
    <div ref={cardRef} className="relative rounded-2xl border-4 border-primary/30 bg-gradient-to-br from-background via-info/5 to-background p-8 overflow-hidden">
      {/* Decorative background */}
      <div className="absolute top-0 right-0 h-32 w-32 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 h-24 w-24 bg-warning/10 rounded-full translate-y-1/2 -translate-x-1/2" />

      {/* Header */}
      <div className="text-center relative">
        <div className="flex justify-center mb-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl gradient-primary shadow-lg">
            <Award className="h-7 w-7 text-white" />
          </div>
        </div>
        <h2 className="text-xs font-bold text-muted-foreground tracking-widest uppercase mb-1">
          DataFlow AI
        </h2>
        <p className="text-sm text-muted-foreground tracking-wider uppercase mb-6">
          Certificate of Completion
        </p>

        <p className="text-sm text-muted-foreground mb-1">This is to certify that</p>
        <p className="text-2xl font-bold font-display text-foreground mb-2 border-b-2 border-primary/30 pb-2 inline-block">
          {cert.profiles?.full_name ?? "Student"}
        </p>
        <p className="text-sm text-muted-foreground mb-1 mt-3">has successfully completed</p>
        <h3 className="text-xl font-bold font-display text-primary mb-5">
          {cert.courses?.title ?? "Course"}
        </h3>
      </div>

      {/* Details row */}
      <div className="grid grid-cols-3 gap-4 py-4 border-y border-border/40 mb-4">
        {[
          { label: "Instructor", value: cert.courses?.instructor ?? "—" },
          {
            label: "Issued On",
            value: new Date(cert.issued_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
          },
          { label: "Category", value: cert.courses?.category ?? "—" },
        ].map((d) => (
          <div key={d.label} className="text-center">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">{d.label}</p>
            <p className="text-sm font-semibold">{d.value}</p>
          </div>
        ))}
      </div>

      {/* Certificate ID */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Certificate ID</p>
          <p className="text-xs font-mono font-medium text-muted-foreground">{cert.certificate_uid}</p>
        </div>
        <Badge className="bg-success/10 text-success border-success/20 gap-1 text-xs">
          <Award className="h-3 w-3" /> Verified
        </Badge>
      </div>

      {/* Actions */}
      <div className="flex gap-2 mt-4">
        <Button
          variant="outline"
          size="sm"
          className="flex-1 gap-2 border-border/60 text-xs"
          onClick={handleDownload}
        >
          <Download className="h-3.5 w-3.5" /> Download / Print
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="flex-1 gap-2 border-border/60 text-xs"
          onClick={handleShare}
        >
          <Share2 className="h-3.5 w-3.5" /> Share
        </Button>
      </div>
    </div>
  );
}

export default function StudentCertificates() {
  const { user, profile } = useAuth();

  const { data: certificates = [], isLoading } = useQuery({
    queryKey: ["certificates", user?.id],
    queryFn: () => fetchUserCertificates(user!.id),
    enabled: !!user,
    // Inject the student's name into each cert for the print template
    select: (data) =>
      data.map((c) => ({
        ...c,
        profiles: { full_name: profile?.full_name ?? "Student", email: user?.email ?? "" },
      })),
  });

  return (
    <div className="space-y-8 pb-6">
      <div className="space-y-1">
        <h1 className="text-4xl font-bold font-display">My Certificates</h1>
        <p className="text-muted-foreground">
          {certificates.length > 0
            ? <>You've earned <span className="text-foreground font-medium">{certificates.length}</span> certificate{certificates.length !== 1 ? "s" : ""}. Congratulations!</>
            : "Complete courses to earn certificates."
          }
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : certificates.length === 0 ? (
        <div className="text-center py-20 space-y-3">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-warning/10 border border-warning/20 mx-auto">
            <Award className="h-8 w-8 text-warning" />
          </div>
          <h3 className="text-xl font-bold font-display">No certificates yet</h3>
          <p className="text-muted-foreground text-sm max-w-sm mx-auto">
            Complete all materials and quizzes in a course to earn your certificate.
          </p>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {certificates.map((cert) => (
            <CertificateCard key={cert.id} cert={cert} />
          ))}
        </div>
      )}
    </div>
  );
}
