import { Link, useNavigate } from "@tanstack/react-router";
import { Logo } from "./Logo";
import { Button } from "@/components/ui/button";
import { useAuth, signOut } from "@/lib/auth";
import { LogOut, History, LayoutDashboard, Upload } from "lucide-react";

export function Navbar() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-40 w-full">
      <div className="glass border-b border-white/[0.06]">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Logo />
          {!loading && user && (
            <nav className="hidden items-center gap-1 md:flex">
              <Link to="/dashboard" className="rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground" activeProps={{ className: "text-foreground bg-white/5" }}>
                <LayoutDashboard className="mr-1.5 inline h-4 w-4" />Dashboard
              </Link>
              <Link to="/upload" className="rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground" activeProps={{ className: "text-foreground bg-white/5" }}>
                <Upload className="mr-1.5 inline h-4 w-4" />Upload
              </Link>
              <Link to="/history" className="rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground" activeProps={{ className: "text-foreground bg-white/5" }}>
                <History className="mr-1.5 inline h-4 w-4" />History
              </Link>
            </nav>
          )}
          <div className="flex items-center gap-2">
            {!loading && !user && (
              <>
                <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/login" })}>Sign in</Button>
                <Button variant="hero" size="sm" onClick={() => navigate({ to: "/register" })}>Get started</Button>
              </>
            )}
            {!loading && user && (
              <Button variant="ghost" size="sm" onClick={signOut}>
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Sign out</span>
              </Button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
