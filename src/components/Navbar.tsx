import { Link, useLocation, useNavigate } from "react-router-dom";
import { Home, Calendar, Dumbbell, Apple, UserCircle, Moon, Sun, LogOut, MessageSquare } from "lucide-react";
import { Button } from "./ui/button";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";

export const Navbar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const { signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  const isActive = (path: string) => location.pathname === path;

  const navItems = [
    { path: "/dashboard", icon: Home, label: "Inicio" },
    { path: "/macros", icon: Apple, label: "Macros" },
    { path: "/workouts", icon: Dumbbell, label: "Entrenar" },
    { path: "/coach-chat", icon: MessageSquare, label: "Coach" },
    { path: "/calendar", icon: Calendar, label: "Agenda" },
    { path: "/profile", icon: UserCircle, label: "Perfil" },
  ];

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/70 bg-card/90 backdrop-blur-xl">
        <div className="w-full px-3 py-2 sm:px-4">
          <div className="mx-auto flex max-w-7xl items-center justify-between">
            <Link to="/dashboard" className="group flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-primary shadow-sm transition-transform group-hover:scale-105">
                <Dumbbell className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="bg-gradient-primary bg-clip-text text-lg font-black text-transparent">
                SendaFit
              </span>
            </Link>

            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleTheme}
                className="h-9 w-9 rounded-full hover:bg-muted"
              >
                {theme === "light" ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleSignOut}
                className="h-9 w-9 rounded-full hover:bg-destructive/10"
              >
                <LogOut className="h-5 w-5 text-destructive" />
              </Button>
            </div>
          </div>
        </div>
      </nav>

      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/70 bg-card/95 backdrop-blur-xl safe-area-bottom">
        <div className="w-full px-1.5 py-1.5 sm:px-4">
          <div className="mx-auto grid max-w-4xl grid-cols-6 items-end gap-1">
            {navItems.map((item) => {
              const active = isActive(item.path);
              return (
                <Link key={item.path} to={item.path} className="flex justify-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`flex h-[54px] w-full max-w-[66px] flex-col gap-0.5 rounded-xl px-1.5 py-1.5 transition-all ${
                      active
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    <item.icon className="h-5 w-5" />
                    <span className="max-w-full truncate text-[10px] font-medium">{item.label}</span>
                  </Button>
                </Link>
              );
            })}
          </div>
        </div>
      </nav>
    </>
  );
};
