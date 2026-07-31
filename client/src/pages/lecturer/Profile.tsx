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
  User, Mail, Phone, BookOpen, Camera, Loader2, KeyRound,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { isPasswordValid } from "@/components/ui/PasswordStrength";

export default function LecturerProfile() {
  const { user, profile, updateProfileCache } = useAuth();

  const [form, setForm] = useState({
    full_name: profile?.full_name ?? "",
    phone: profile?.phone ?? "",
    bio: profile?.bio ?? "",
  });

  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string>(profile?.avatar_url ?? "");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Password change state
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [updatingPassword, setUpdatingPassword] = useState(false);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

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
        avatar_url: avatarUrl,
      });

      if (updateProfileCache) {
        updateProfileCache({
          full_name: form.full_name,
          phone: form.phone,
          bio: form.bio,
          avatar_url: avatarUrl,
        });
      }
    },
    onSuccess: () => toast({ title: "Profile updated!", description: "Your changes have been saved." }),
    onError: (err: Error) => toast({ title: "Update failed", description: err.message, variant: "destructive" }),
  });

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword) {
      toast({ title: "Enter a new password.", variant: "destructive" });
      return;
    }
    if (!isPasswordValid(newPassword)) {
      toast({ title: "Password does not meet the security requirements.", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Passwords do not match.", variant: "destructive" });
      return;
    }
    setUpdatingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setUpdatingPassword(false);
    if (error) {
      toast({ title: "Failed to update password", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Password updated successfully!" });
      setNewPassword("");
      setConfirmPassword("");
    }
  };

  const initials = form.full_name
    ? form.full_name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : (user?.email?.[0] ?? "?").toUpperCase();

  return (
    <div className="space-y-8 pb-6 max-w-2xl">
      <div className="space-y-1">
        <h1 className="text-4xl font-bold font-display">Profile</h1>
        <p className="text-muted-foreground">Manage your personal information and account settings</p>
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
                <div className="h-20 w-20 rounded-2xl bg-success/10 border border-success/20 flex items-center justify-center">
                  <span className="text-2xl font-bold text-success">{initials}</span>
                </div>
              )}
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="absolute -bottom-2 -right-2 flex h-7 w-7 items-center justify-center rounded-full bg-success text-white shadow-sm hover:brightness-110 transition-all"
              >
                {uploadingAvatar ? <Loader2 className="h-3 w-3 animate-spin" /> : <Camera className="h-3 w-3" />}
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
            </div>
            <div>
              <p className="font-semibold text-lg">{form.full_name || "Your Name"}</p>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
              <Badge className="mt-1 capitalize bg-success/10 text-success border-success/20 text-xs">
                {profile?.role ?? "lecturer"}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Personal info */}
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="font-display text-base flex items-center gap-2">
            <User className="h-4 w-4 text-success" /> Personal Information
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

            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  value={user?.email ?? ""}
                  disabled
                  className="pl-10 border-border/60 bg-muted/30 cursor-not-allowed"
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
              placeholder="Tell students a bit about yourself and your teaching approach..."
              rows={3}
              className="w-full rounded-md border border-border/60 bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
            />
          </div>
        </CardContent>
      </Card>

      {/* Change Password */}
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="font-display text-base flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-success" /> Change Password
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <PasswordInput
                id="new-password"
                placeholder="••••••••"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="border-border/60"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm Password</Label>
              <PasswordInput
                id="confirm-password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="border-border/60"
              />
            </div>
            <Button type="submit" variant="outline" className="border-success/30 text-success hover:bg-success/10" disabled={updatingPassword}>
              {updatingPassword ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Updating…</> : "Update Password"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Button
        className="gradient-primary text-white border-0 w-full sm:w-auto glow-sm"
        onClick={() => saveMutation.mutate()}
        disabled={saveMutation.isPending}
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
