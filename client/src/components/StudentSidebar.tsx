import { LayoutDashboard, BookOpen, GraduationCap, ClipboardList, Sparkles, Brain, FileStack, Zap, User, Bell, Bookmark, Award, Megaphone } from "lucide-react";
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

const coreItems = [
  { title: "Dashboard",       url: "/dashboard",       icon: LayoutDashboard },
  { title: "Courses",         url: "/courses",         icon: BookOpen         },
  { title: "Quizzes",         url: "/quizzes",         icon: ClipboardList    },
  { title: "Practice Quiz",   url: "/practice",        icon: Zap              },
  { title: "Past Questions",  url: "/past-questions",  icon: FileStack        },
  { title: "Recommendations", url: "/recommendations", icon: Sparkles         },
  { title: "My Progress",     url: "/progress",        icon: GraduationCap    },
];

const personalItems = [
  { title: "Profile",         url: "/profile",         icon: User             },
  { title: "Notifications",   url: "/notifications",   icon: Bell             },
  { title: "Bookmarks",       url: "/bookmarks",       icon: Bookmark         },
  { title: "Certificates",    url: "/certificates",    icon: Award            },
  { title: "Announcements",   url: "/announcements",   icon: Megaphone        },
];

export function StudentSidebar() {
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
                <span className="text-sm font-bold font-display gradient-text leading-tight">StudySync</span>
                <span className="text-[10px] text-muted-foreground leading-tight">Student Portal</span>
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="mx-3 mb-3 h-px bg-gradient-to-r from-transparent via-border to-transparent" />

          <SidebarGroupContent>
            <SidebarMenu>
              {coreItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground transition-all duration-150 group"
                      activeClassName="bg-primary/15 text-primary font-semibold border border-primary/20 hover:bg-primary/20 hover:text-primary"
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
                      activeClassName="bg-primary/15 text-primary font-semibold border border-primary/20 hover:bg-primary/20 hover:text-primary"
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
