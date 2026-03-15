import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { MessageSquare, Package, FlaskConical, Bot } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Conversations", icon: MessageSquare },
  { href: "/products", label: "Products", icon: Package },
  { href: "/simulate", label: "Simulate", icon: FlaskConical },
];

export default function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();

  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="w-60 flex-shrink-0 flex flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
        <div className="flex items-center gap-2.5 px-5 py-5 border-b border-sidebar-border">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-sidebar-primary">
            <Bot size={16} className="text-white" />
          </div>
          <div>
            <div className="text-sm font-semibold text-white">FB Sales AI</div>
            <div className="text-xs text-sidebar-foreground/60">Assistant</div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? location === "/" : location.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  active
                    ? "bg-sidebar-primary text-white"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <Icon size={16} />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="px-4 py-4 border-t border-sidebar-border">
          <div className="text-xs text-sidebar-foreground/40">
            AI-powered sales assistant for Facebook pages
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
