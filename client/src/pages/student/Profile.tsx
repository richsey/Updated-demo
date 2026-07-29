import { useState, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { updateProfile } from "@/lib/api/profiles";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  User, Mail, Phone, BookOpen, Target, Camera, Loader2,
  CheckCircle2, Tag, Lock, Eye, EyeOff, ShieldCheck,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";

const INTEREST_OPTIONS = [
  "JavaScript", "Python", "React", "Node.js", "TypeScript", "Machine Learning",
  "Database", "DevOps", "Mobile Dev", "UI/UX", "Cybersecurity", "Cloud Computing",
];

// ─── Password strength helper ─────────────────────────────────────────────────

function getPasswordStrength(pw: string): { score: number; label: string; color: string } {
  if (!pw) return { score: 0, label: "", color: "" };
  let score = 0;
  if (pw.length >= 8)  score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;

  if (score <= 1) return { score, label: "Weak",   color: "bg-red-500"   };
  if (score <= 3) return { score, label: "Fair",   color: "bg-amber-500" };
  if (score === 4) return { score, label: "Good",  color: "bg-blue-500"  };
  return              { score, label: "Strong", color: "bg-emerald-500" };
}

// ─── Password Input with toggle visibility ────────────────────────────────────

function PasswordInput({
  id, value, onChange, placeholder, disabled,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        id={id}
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="pl-10 pr-10 border-border/60"
        autoComplete="new-password"
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setShow((s) => !s)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function StudentProfile() {
  const { user, profile, updateProfileCache } = useAuth();

  const [form, setForm] = useState({
    full_name: profile?.full_name ?? "",
    phone: profile?.phone ?? "",
    bio: profile?.bio ?? "",
    learning_goals: profile?.learning_goals ?? "",
    interests: (profile?.interests as string[]) ?? [],
  });

  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string>(profile?.avatar_url ?? "");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // ── Password change state ──
  const [pwForm, setPwForm] = useState({ current: "", next: "", confirm: "" });
  const [pwError, setPwError] = useState<string>("");

  const passwordStrength = getPasswordStrength(pwForm.next);
  const passwordsMatch = pwForm.next === pwForm.confirm;

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const toggleInterest = (interest: string) =>
    setForm((f) => ({
      ...f,
      interests: f.interests.includes(interest)
        ? f.interests.filter((i) => i !== interest)
        : [...f.interests, interest],
    }));

  // ── Profile save ──
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      let avatarUrl = profile?.avatar_url;

      if (avatarFile) {
        setUploadingAvatar(true);
        const ext = avatarFile.name.split(".").pop();
        const path = `avatars/${user.id}/avatar.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from("avatars")
          .upload(path, avatarFile, { cacheControl: "3600", upsert: true });
        if (uploadErr) throw uploadErr;
        const { data } = supabase.storage.from("avatars").getPublicUrl(path);
        avatarUrl = data.publicUrl;
        setUploadingAvatar(false);
      }

      await updateProfile(user.id, {
        full_name: form.full_name,
        phone: form.phone,
        bio: form.bio,
        learning_goals: form.learning_goals,
        interests: form.interests,
        avatar_url: avatarUrl,
      });

      if (updateProfileCache) {
        updateProfileCache({
          full_name: form.full_name,
          phone: form.phone,
          bio: form.bio,
          learning_goals: form.learning_goals,
          interests: form.interests,
          avatar_url: avatarUrl,
        });
      }
    },
    onSuccess: () => toast({ title: "Profile updated!", description: "Your changes have been saved." }),
    onError: (err: Error) => toast({ title: "Update failed", description: err.message, variant: "destructive" }),
  });

  // ── Password change ──
  const pwMutation = useMutation({
    mutationFn: async () => {
      setPwError("");

      // 1. Validate inputs
      if (!pwForm.current) throw new Error("Please enter your current password.");
      if (pwForm.next.length < 8) throw new Error("New password must be at least 8 characters.");
      if (pwForm.next !== pwForm.confirm) throw new Error("New passwords do not match.");
      if (pwForm.current === pwForm.next) throw new Error("New password must differ from the current one.");

      // 2. Verify current password by re-signing in
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: pwForm.current,
      });
      if (signInErr) {
        throw new Error("Current password is incorrect. Please try again.");
      }

      // 3. Update to new password
      const { error: updateErr } = await supabase.auth.updateUser({
        password: pwForm.next,
      });
      if (updateErr) throw updateErr;

      // 4. Clear form
      setPwForm({ current: "", next: "", confirm: "" });
    },
    onSuccess: () =>
      toast({
        title: "Password changed!",
        description: "Your password has been updated successfully.",
      }),
    onError: (err: Error) => {
      setPwError(err.message);
    },
  });

  const initials = form.full_name
    ? form.full_name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : (user?.email?.[0] ?? "?").toUpperCase();

  const originalInterests = (profile?.interests as string[]) ?? [];
  const interestsChanged =
    form.interests.length !== originalInterests.length ||
    !form.interests.every((i) => originalInterests.includes(i));

  const hasChanges =
    avatarFile !== null ||
    form.full_name !== (profile?.full_name ?? "") ||
    form.phone !== (profile?.phone ?? "") ||
    form.bio !== (profile?.bio ?? "") ||
    form.learning_goals !== (profile?.learning_goals ?? "") ||
    interestsChanged;

  return (
    <div className="space-y-8 pb-6 max-w-2xl">
      <div className="space-y-1">
        <h1 className="text-4xl font-bold font-display">Profile</h1>
        <p className="text-muted-foreground">Manage your personal information and learning preferences</p>
      </div>

      {/* Avatar card */}
      <Card className="border-border/60">
        <CardContent className="p-6">
          <div className="flex items-center gap-6">
            <div className="relative flex-shrink-0">
              {avatarPreview ? (
                <img
                  src={avatarPreview}
                  alt="Avatar"
                  className="h-20 w-20 rounded-2xl object-cover border border-border/60"
                />
              ) : (
                <div className="h-20 w-20 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <span className="text-2xl font-bold text-primary">{initials}</span>
                </div>
              )}
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="absolute -bottom-2 -right-2 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-white shadow-sm hover:bg-primary/90 transition-colors"
              >
                {uploadingAvatar ? <Loader2 className="h-3 w-3 animate-spin" /> : <Camera className="h-3 w-3" />}
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
            </div>
            <div>
              <p className="font-semibold text-lg">{form.full_name || "Your Name"}</p>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
              <Badge className="mt-1 capitalize bg-primary/10 text-primary border-primary/20 text-xs">
                {profile?.role ?? "student"}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Personal info */}
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="font-display text-base flex items-center gap-2">
            <User className="h-4 w-4 text-primary" /> Personal Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="name"
                  value={form.full_name}
                  onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                  placeholder="Your full name"
                  className="pl-10 border-border/60"
                />
              </div>
            </div>

            {/* Email — read-only, not changeable */}
            <div className="space-y-2">
              <Label htmlFor="email" className="flex items-center gap-1.5">
                Email Address
                <span className="text-[10px] text-muted-foreground font-normal bg-muted px-1.5 py-0.5 rounded">
                  Cannot be changed
                </span>
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  value={user?.email ?? ""}
                  disabled
                  className="pl-10 border-border/60 bg-muted/30 cursor-not-allowed text-muted-foreground"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="phone"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="+1 234 567 8900"
                  className="pl-10 border-border/60"
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="bio">Bio</Label>
            <textarea
              id="bio"
              value={form.bio}
              onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
              placeholder="Tell us a bit about yourself..."
              rows={3}
              className="w-full rounded-md border border-border/60 bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
            />
          </div>
        </CardContent>
      </Card>

      {/* ── Change Password card ── */}
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="font-display text-base flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" /> Change Password
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="current-password">Current Password</Label>
            <PasswordInput
              id="current-password"
              value={pwForm.current}
              onChange={(v) => { setPwForm((f) => ({ ...f, current: v })); setPwError(""); }}
              placeholder="Enter your current password"
              disabled={pwMutation.isPending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-password">New Password</Label>
            <PasswordInput
              id="new-password"
              value={pwForm.next}
              onChange={(v) => { setPwForm((f) => ({ ...f, next: v })); setPwError(""); }}
              placeholder="At least 8 characters"
              disabled={pwMutation.isPending}
            />
            {/* Strength bar */}
            {pwForm.next && (
              <div className="space-y-1">
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div
                      key={i}
                      className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                        i <= passwordStrength.score ? passwordStrength.color : "bg-muted"
                      }`}
                    />
                  ))}
                </div>
                {passwordStrength.label && (
                  <p className="text-[11px] text-muted-foreground">
                    Strength: <span className="font-medium text-foreground">{passwordStrength.label}</span>
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirm New Password</Label>
            <PasswordInput
              id="confirm-password"
              value={pwForm.confirm}
              onChange={(v) => { setPwForm((f) => ({ ...f, confirm: v })); setPwError(""); }}
              placeholder="Re-enter new password"
              disabled={pwMutation.isPending}
            />
            {pwForm.confirm && !passwordsMatch && (
              <p className="text-[11px] text-destructive">Passwords do not match.</p>
            )}
            {pwForm.confirm && passwordsMatch && pwForm.confirm.length > 0 && (
              <p className="text-[11px] text-emerald-600 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" /> Passwords match
              </p>
            )}
          </div>

          {/* Error from mutation */}
          {pwError && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {pwError}
            </div>
          )}

          <Button
            id="change-password-btn"
            onClick={() => pwMutation.mutate()}
            disabled={
              pwMutation.isPending ||
              !pwForm.current ||
              !pwForm.next ||
              !pwForm.confirm ||
              !passwordsMatch ||
              pwForm.next.length < 8
            }
            variant="outline"
            className="w-full sm:w-auto border-primary/30 text-primary hover:bg-primary/5"
          >
            {pwMutation.isPending ? (
              <><Loader2 className="h-4 w-4 animate-spin mr-2" />Verifying &amp; updating…</>
            ) : (
              <><Lock className="h-4 w-4 mr-2" />Update Password</>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Learning preferences */}
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="font-display text-base flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-primary" /> Learning Preferences
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="goals" className="flex items-center gap-2">
              <Target className="h-3.5 w-3.5" /> Learning Goals
            </Label>
            <textarea
              id="goals"
              value={form.learning_goals}
              onChange={(e) => setForm((f) => ({ ...f, learning_goals: e.target.value }))}
              placeholder="What do you want to achieve? e.g. Get a job as a full-stack developer by December..."
              rows={3}
              className="w-full rounded-md border border-border/60 bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
            />
          </div>

          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <Tag className="h-3.5 w-3.5" /> Interests
            </Label>
            <div className="flex flex-wrap gap-2">
              {INTEREST_OPTIONS.map((interest) => {
                const selected = form.interests.includes(interest);
                return (
                  <button
                    key={interest}
                    type="button"
                    onClick={() => toggleInterest(interest)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                      selected
                        ? "bg-primary/10 text-primary border-primary/30 hover:bg-primary/20"
                        : "bg-secondary text-muted-foreground border-border/60 hover:border-border hover:text-foreground"
                    }`}
                  >
                    {selected && <CheckCircle2 className="h-3 w-3" />}
                    {interest}
                  </button>
                );
              })}
            </div>
            {form.interests.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {form.interests.length} interest{form.interests.length !== 1 ? "s" : ""} selected
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Button
        className={`w-full sm:w-auto transition-all duration-300 ${
          hasChanges 
            ? "gradient-primary text-white border-0 glow-sm" 
            : "bg-muted text-muted-foreground"
        }`}
        onClick={() => saveMutation.mutate()}
        disabled={saveMutation.isPending || !hasChanges}
      >
        {saveMutation.isPending ? (
          <><Loader2 className="h-4 w-4 animate-spin mr-2" />Saving…</>
        ) : (
          "Save Changes"
        )}
      </Button>
    </div>
  );
}
