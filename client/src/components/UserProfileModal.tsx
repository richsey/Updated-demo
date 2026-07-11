import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { User, Mail, KeyRound, ShieldCheck, Loader2 } from "lucide-react";

interface UserProfileModalProps {
  trigger?: React.ReactNode;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function UserProfileModal({ trigger, isOpen, onOpenChange }: UserProfileModalProps) {
  const { profile } = useAuth();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [updating, setUpdating] = useState(false);
  const [localOpen, setLocalOpen] = useState(false);

  const openState = isOpen !== undefined ? isOpen : localOpen;
  const setOpenState = onOpenChange !== undefined ? onOpenChange : setLocalOpen;

  if (!profile) return null;

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword) {
      toast.error("Please enter a new password.");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters long.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    setUpdating(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setUpdating(false);

    if (error) {
      toast.error("Failed to reset password: " + error.message);
    } else {
      toast.success("Password updated successfully!");
      setNewPassword("");
      setConfirmPassword("");
      setOpenState(false);
    }
  };

  const getInitials = (name: string | null) => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  };

  return (
    <Dialog open={openState} onOpenChange={setOpenState}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="max-w-md rounded-2xl border border-border/80 bg-background/95 backdrop-blur-md shadow-2xl p-6">
        <DialogHeader className="flex flex-col items-center space-y-2 border-b border-border/50 pb-4">
          <Avatar className="h-20 w-20 border-2 border-primary/20 shadow-lg animate-in fade-in zoom-in duration-300">
            <AvatarFallback className="bg-primary/10 text-primary text-xl font-bold font-display">
              {getInitials(profile.full_name)}
            </AvatarFallback>
          </Avatar>
          <DialogTitle className="text-xl font-bold font-display text-foreground">
            {profile.full_name || "User Profile"}
          </DialogTitle>
          <div className="flex items-center gap-1.5 mt-0.5">
            <Badge
              variant="secondary"
              className={`capitalize font-bold text-[10px] px-2.5 py-0.5 rounded-full ${
                profile.role === "admin"
                  ? "bg-rose-500/10 text-rose-500 border border-rose-500/20"
                  : "bg-primary/10 text-primary border border-primary/20"
              }`}
            >
              <ShieldCheck className="h-3 w-3 mr-1 inline-block" />
              {profile.role}
            </Badge>
          </div>
        </DialogHeader>

        <div className="space-y-5 pt-4">
          {/* User Details */}
          <div className="space-y-3 bg-muted/30 p-4 rounded-xl border border-border/40">
            <div className="flex items-center gap-3">
              <User className="h-4 w-4 text-muted-foreground" />
              <div className="min-w-0">
                <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Full Name</p>
                <p className="text-sm font-bold truncate text-foreground">{profile.full_name || "N/A"}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <div className="min-w-0">
                <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Email Address</p>
                <p className="text-sm font-bold truncate text-foreground">{profile.email}</p>
              </div>
            </div>
          </div>

          {/* Reset Password Form */}
          <form onSubmit={handlePasswordReset} className="space-y-4 pt-1">
            <div className="flex items-center gap-2 text-foreground font-bold font-display text-sm">
              <KeyRound className="h-4 w-4 text-primary" />
              <span>Change Password</span>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                placeholder="••••••••"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                className="rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm-password">Confirm Password</Label>
              <Input
                id="confirm-password"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="rounded-xl"
              />
            </div>
            <Button type="submit" className="w-full rounded-xl" disabled={updating}>
              {updating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating Password...
                </>
              ) : (
                "Save Password"
              )}
            </Button>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
