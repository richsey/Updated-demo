import { LayoutDashboard, Upload, FileText, ClipboardList, BarChart3, LogOut, Brain, BookOpen, ListChecks } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useNavigate } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";

const items = [
  { title: "Dashboard", url: "/admin", icon: LayoutDashboard },
  { title: "Manage Courses", url: "/admin/courses", icon: BookOpen },
  { title: "Upload Course", url: "/admin/upload-course", icon: Upload },
  { title: "Upload Material", url: "/admin/upload-material", icon: FileText },
  { title: "Create Quiz", url: "/admin/create-quiz", icon: ClipboardList },
  { title: "Manage Questions", url: "/admin/manage-questions", icon: ListChecks },
  { title: "Student Analytics", url: "/admin/analytics", icon: BarChart3 },
];

export function AdminSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const navigate = useNavigate();

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          {/* Logo */}
          <div className={`flex items-center gap-3 px-3 py-4 mb-2 ${collapsed ? "justify-center" : ""}`}>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg glow-accent flex-shrink-0"
              style={{ background: "linear-gradient(135deg, hsl(252 87% 67%), hsl(262 83% 50%))" }}>
              <Brain className="h-4 w-4 text-white" />
            </div>
            {!collapsed && (
              <div className="flex flex-col">
                <span className="text-sm font-bold font-display gradient-text-warm leading-tight" style={{ background: "linear-gradient(135deg, hsl(252 87% 72%), hsl(210 100% 70%))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Admin Panel</span>
                <span className="text-[10px] text-muted-foreground leading-tight">Management Console</span>
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="mx-3 mb-3 h-px bg-gradient-to-r from-transparent via-border to-transparent" />

          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === "/admin"}
                      className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground transition-all duration-150 group"
                      activeClassName="bg-accent/15 text-accent font-semibold border border-accent/20 hover:bg-accent/20 hover:text-accent"
                    >
                      <item.icon className="h-4 w-4 flex-shrink-0 group-hover:scale-110 transition-transform duration-150" />
                      {!collapsed && <span className="text-sm">{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <div className="px-2 py-3">
          <div className="mx-1 mb-3 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
          <Button
            variant="ghost"
            className="w-full justify-start text-sidebar-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-all duration-150 rounded-xl"
            onClick={() => navigate("/")}
          >
            <LogOut className="h-4 w-4 flex-shrink-0" />
            {!collapsed && <span className="ml-3 text-sm">Sign Out</span>}
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
