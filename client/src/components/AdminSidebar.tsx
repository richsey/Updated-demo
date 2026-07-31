import { LayoutDashboard, Upload, FileText, ClipboardList, BarChart3, Brain, BookOpen, ListChecks, Users, CheckSquare, FileBarChart, Activity } from "lucide-react";
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

const contentItems = [
  { title: "Dashboard",         url: "/admin",                  icon: LayoutDashboard, end: true },
  { title: "Manage Courses",    url: "/admin/courses",          icon: BookOpen        },
  { title: "Upload Course",     url: "/admin/upload-course",    icon: Upload          },
  { title: "Upload Material",   url: "/admin/upload-material",  icon: FileText        },
  { title: "Manage Questions",  url: "/admin/manage-questions", icon: ListChecks      },
  { title: "Student Analytics", url: "/admin/analytics",        icon: BarChart3       },
];

const managementItems = [
  { title: "Manage Users",      url: "/admin/users",            icon: Users           },
  { title: "Course Approvals",  url: "/admin/approvals",        icon: CheckSquare     },
  { title: "Reports",           url: "/admin/reports",          icon: FileBarChart    },
];

export function AdminSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  const renderItems = (list: typeof contentItems) =>
    list.map((item) => (
      <SidebarMenuItem key={item.title}>
        <SidebarMenuButton asChild>
          <NavLink
            to={item.url}
            end={item.end}
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground transition-all duration-150 group"
            activeClassName="bg-accent/15 text-accent font-semibold border border-accent/20 hover:bg-accent/20 hover:text-accent"
          >
            <item.icon className="h-4 w-4 flex-shrink-0 group-hover:scale-110 transition-transform duration-150" />
            {!collapsed && <span className="text-sm">{item.title}</span>}
          </NavLink>
        </SidebarMenuButton>
      </SidebarMenuItem>
    ));

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
                <span className="text-sm font-bold font-display gradient-text leading-tight">Admin Panel</span>
                <span className="text-[10px] text-muted-foreground leading-tight">Management Console</span>
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="mx-3 mb-3 h-px bg-gradient-to-r from-transparent via-border to-transparent" />

          <SidebarGroupContent>
            <SidebarMenu>{renderItems(contentItems)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Management section */}
        <SidebarGroup>
          {!collapsed && (
            <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-muted-foreground/50 px-3 mb-1">
              Management
            </SidebarGroupLabel>
          )}
          <div className="mx-3 mb-2 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
          <SidebarGroupContent>
            <SidebarMenu>{renderItems(managementItems)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
