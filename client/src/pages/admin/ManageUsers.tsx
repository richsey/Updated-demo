import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchAllUsers,
  adminChangeUserRole,
  adminSuspendUser,
  adminActivateUser,
  adminCreateUser,
  adminDeleteUser,
} from "@/lib/api/lecturer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Users, Search, Shield, GraduationCap, User, Loader2,
  Ban, CheckCircle2, ChevronDown, Plus, Trash2,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";

const ROLE_CONFIG: Record<string, { label: string; icon: typeof User; badge: string }> = {
  student:  { label: "Student",  icon: User,           badge: "bg-blue-100 text-blue-700 border-blue-200"   },
  lecturer: { label: "Lecturer", icon: GraduationCap,  badge: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  admin:    { label: "Admin",    icon: Shield,          badge: "bg-violet-100 text-violet-700 border-violet-200" },
};

export default function AdminManageUsers() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [actionUserId, setActionUserId] = useState<string | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({ full_name: "", email: "", password: "", role: "student" });

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["admin-users", roleFilter],
    queryFn: () =>
      fetchAllUsers(roleFilter === "all" ? undefined : roleFilter as "student" | "lecturer" | "admin"),
  });

  const filtered = users.filter(
    (u) =>
      u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase())
  );

  const changRoleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: "student" | "lecturer" | "admin" }) =>
      adminChangeUserRole(userId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      setActionUserId(null);
      toast({ title: "Role updated successfully" });
    },
    onError: () => toast({ title: "Role change failed", variant: "destructive" }),
  });

  const suspendMutation = useMutation({
    mutationFn: (userId: string) => adminSuspendUser(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast({ title: "User suspended" });
    },
    onError: () => toast({ title: "Failed to suspend user", variant: "destructive" }),
  });

  const activateMutation = useMutation({
    mutationFn: (userId: string) => adminActivateUser(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast({ title: "User reactivated" });
    },
    onError: () => toast({ title: "Failed to activate user", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (userId: string) => adminDeleteUser(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast({ title: "User deleted successfully" });
    },
    onError: (err: Error) => toast({ title: "Failed to delete user", description: err.message, variant: "destructive" }),
  });

  const createMutation = useMutation({
    mutationFn: (data: Parameters<typeof adminCreateUser>[0]) => adminCreateUser(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      setIsAddOpen(false);
      setAddForm({ full_name: "", email: "", password: "", role: "student" });
      toast({ title: "User created successfully" });
    },
    onError: (err: Error) => toast({ title: "Failed to create user", description: err.message, variant: "destructive" }),
  });

  const roleCounts = {
    all: users.length,
    student: users.filter((u) => u.role === "student").length,
    lecturer: users.filter((u) => u.role === "lecturer").length,
    admin: users.filter((u) => u.role === "admin").length,
  };

  return (
    <div className="space-y-8 pb-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-4xl font-bold font-display">Manage Users</h1>
          <p className="text-muted-foreground">
            View, promote, and manage all platform users
          </p>
        </div>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button className="gradient-primary text-white border-0 glow-sm">
              <Plus className="mr-2 h-4 w-4" /> Add User
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Add New User</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Full Name</label>
                <Input
                  value={addForm.full_name}
                  onChange={(e) => setAddForm({ ...addForm, full_name: e.target.value })}
                  placeholder="e.g. John Doe"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Email</label>
                <Input
                  type="email"
                  value={addForm.email}
                  onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                  placeholder="e.g. john@example.com"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Password</label>
                <Input
                  type="password"
                  value={addForm.password}
                  onChange={(e) => setAddForm({ ...addForm, password: e.target.value })}
                  placeholder="Minimum 6 characters"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Role</label>
                <select
                  className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  value={addForm.role}
                  onChange={(e) => setAddForm({ ...addForm, role: e.target.value })}
                >
                  <option value="student">Student</option>
                  <option value="lecturer">Lecturer</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
              <Button
                className="gradient-primary text-white border-0"
                disabled={!addForm.email || !addForm.password || createMutation.isPending}
                onClick={() => createMutation.mutate({ fullName: addForm.full_name, email: addForm.email, password: addForm.password, role: addForm.role })}
              >
                {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create User"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-4">
        {[
          { label: "All Users", count: roleCounts.all, icon: Users, color: "text-slate-600", bg: "bg-slate-500/10", border: "border-slate-500/20" },
          { label: "Students", count: roleCounts.student, icon: User, color: "text-blue-600", bg: "bg-blue-500/10", border: "border-blue-500/20" },
          { label: "Lecturers", count: roleCounts.lecturer, icon: GraduationCap, color: "text-emerald-600", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
          { label: "Admins", count: roleCounts.admin, icon: Shield, color: "text-violet-600", bg: "bg-violet-500/10", border: "border-violet-500/20" },
        ].map((s) => (
          <Card key={s.label} className={`border ${s.border} cursor-pointer transition-all hover:shadow-sm`}
            onClick={() => setRoleFilter(s.label === "All Users" ? "all" : s.label.toLowerCase())}>
            <CardContent className="flex items-center gap-3 p-4">
              <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${s.bg} border ${s.border} ${s.color}`}>
                <s.icon className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xl font-bold font-display">{isLoading ? "—" : s.count}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="glass rounded-2xl border border-border/60 p-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 border-border/60"
          />
        </div>
        <div className="flex gap-2">
          {["all", "student", "lecturer", "admin"].map((r) => (
            <Button
              key={r}
              size="sm"
              variant={roleFilter === r ? "default" : "outline"}
              onClick={() => setRoleFilter(r)}
              className={roleFilter === r
                ? "gradient-primary border-0 text-white glow-sm h-9 text-xs capitalize"
                : "border-border/60 text-muted-foreground h-9 text-xs capitalize"}
            >
              {r === "all" ? "All" : r}
            </Button>
          ))}
        </div>
      </div>

      {/* User list */}
      {isLoading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 space-y-2">
          <div className="text-4xl">👥</div>
          <p className="font-semibold">No users found</p>
          <p className="text-sm text-muted-foreground">Try adjusting your search or filter.</p>
        </div>
      ) : (
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="font-display text-base">
              {filtered.length} user{filtered.length !== 1 ? "s" : ""}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {filtered.map((user) => {
                const roleInfo = ROLE_CONFIG[user.role] ?? ROLE_CONFIG.student;
                const RoleIcon = roleInfo.icon;
                const isSuspended = user.is_suspended;
                return (
                  <div
                    key={user.id}
                    className={`flex items-center gap-4 p-3 rounded-xl border transition-colors ${
                      isSuspended ? "border-rose-200 bg-rose-50/30 opacity-70" : "border-border/50 bg-card/60 hover:bg-card"
                    }`}
                  >
                    {/* Avatar */}
                    {user.avatar_url ? (
                      <img src={user.avatar_url} alt="" className="h-9 w-9 rounded-full object-cover flex-shrink-0" />
                    ) : (
                      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 border border-primary/20 text-primary font-bold text-sm">
                        {(user.full_name || user.email || "?")[0].toUpperCase()}
                      </div>
                    )}

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold truncate">{user.full_name ?? "—"}</p>
                        {isSuspended && <Badge className="bg-rose-100 text-rose-700 border-rose-200 text-[10px]">Suspended</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                    </div>

                    {/* Role badge */}
                    <Badge className={`${roleInfo.badge} gap-1 text-xs flex-shrink-0 hidden sm:flex`}>
                      <RoleIcon className="h-3 w-3" />
                      {roleInfo.label}
                    </Badge>

                    {/* Actions */}
                    <div className="flex gap-2 flex-shrink-0">
                      {/* Role change dropdown */}
                      <div className="relative">
                        <select
                          value={user.role}
                          onChange={(e) =>
                            changRoleMutation.mutate({ userId: user.id, role: e.target.value as "student" | "lecturer" | "admin" })
                          }
                          className="h-8 rounded-lg border border-border/60 bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
                        >
                          <option value="student">Student</option>
                          <option value="lecturer">Lecturer</option>
                          <option value="admin">Admin</option>
                        </select>
                      </div>

                      {isSuspended ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs gap-1 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                          onClick={() => activateMutation.mutate(user.id)}
                          disabled={activateMutation.isPending}
                        >
                          <CheckCircle2 className="h-3 w-3" />
                          <span className="hidden sm:inline">Activate</span>
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs gap-1 border-rose-300 text-rose-700 hover:bg-rose-50"
                          onClick={() => suspendMutation.mutate(user.id)}
                          disabled={suspendMutation.isPending}
                        >
                          <Ban className="h-3 w-3" />
                          <span className="hidden sm:inline">Suspend</span>
                        </Button>
                      )}

                      {/* Delete Button wrapped in AlertDialog */}
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 w-8 p-0 border-rose-300 text-rose-700 hover:bg-rose-50 hover:text-rose-800 disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={user.role === "admin" || deleteMutation.isPending}
                            title={user.role === "admin" ? "Admins cannot be deleted" : "Delete User"}
                          >
                            {deleteMutation.isPending && deleteMutation.variables === user.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This action cannot be undone. This will permanently delete 
                              <span className="font-semibold text-foreground"> {user.full_name || user.email} </span> 
                              and remove all their data from our servers.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteMutation.mutate(user.id)}
                              className="bg-rose-600 hover:bg-rose-700 text-white"
                            >
                              Yes, Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
