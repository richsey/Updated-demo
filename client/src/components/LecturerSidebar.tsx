import {
  LayoutDashboard, BookOpen, Upload, ClipboardList,
  Users, Megaphone, MessageSquare, BarChart3, Brain, Plus, User,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

const items = [
  { title: "Dashboard",        url: "/lecturer",                icon: LayoutDashboard },
  { title: "My Courses",       url: "/lecturer/courses",        icon: BookOpen        },
  { title: "Create Course",    url: "/lecturer/courses/new",    icon: Plus            },
  { title: "Upload Material",  url: "/lecturer/materials",      icon: Upload          },
  { title: "Quiz Builder",     url: "/lecturer/quizzes",        icon: ClipboardList   },
  { title: "My Students",      url: "/lecturer/students",       icon: Users           },
  { title: "Analytics",        url: "/lecturer/analytics",      icon: BarChart3       },
  { title: "Announcements",    url: "/lecturer/announcements",  icon: Megaphone       },
  { title: "Feedback Inbox",   url: "/lecturer/feedback",       icon: MessageSquare   },
];

const personalItems = [
  { title: "Profile",          url: "/lecturer/profile",        icon: User            },
];

export function LecturerSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          {/* Logo */}
          <div className={`flex items-center gap-3 px-3 py-4 mb-2 ${collapsed ? "justify-center" : ""}`}>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg gradient-primary glow-sm flex-shrink-0">
              <Brain className="h-4 w-4 text-white" />
            </div>
            {!collapsed && (
              <div className="flex flex-col">
                <span className="text-sm font-bold font-display gradient-text leading-tight">Lecturer Portal</span>
                <span className="text-[10px] text-muted-foreground leading-tight">Teaching Console</span>
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
                      end={item.url === "/lecturer"}
                      className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground transition-all duration-150 group"
                      activeClassName="bg-emerald-500/15 text-emerald-600 font-semibold border border-emerald-500/20 hover:bg-emerald-500/20 hover:text-emerald-700"
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

        {/* Personal section */}
        <SidebarGroup>
          {!collapsed && (
            <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-muted-foreground/50 px-3 mb-1">
              Personal
            </SidebarGroupLabel>
          )}
          <div className="mx-3 mb-2 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
          <SidebarGroupContent>
            <SidebarMenu>
              {personalItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground transition-all duration-150 group"
                      activeClassName="bg-emerald-500/15 text-emerald-600 font-semibold border border-emerald-500/20 hover:bg-emerald-500/20 hover:text-emerald-700"
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
    </Sidebar>
  );
}
