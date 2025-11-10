import { LucideIcon } from "lucide-react";
import { Card } from "./ui/card";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  variant?: "default" | "primary" | "secondary" | "accent";
  className?: string;
}

export const StatCard = ({
  title,
  value,
  subtitle,
  icon: Icon,
  variant = "default",
  className,
}: StatCardProps) => {
  const variants = {
    default: "bg-gradient-card border-primary/20",
    primary: "bg-gradient-primary text-primary-foreground border-primary/30",
    secondary: "bg-gradient-secondary text-secondary-foreground border-secondary/30",
    accent: "bg-gradient-accent text-accent-foreground border-accent/30",
  };

  return (
    <Card
      className={cn(
        "p-3 sm:p-4 shadow-card hover:shadow-elevated transition-all duration-300 hover:scale-[1.02] border-2",
        variants[variant],
        className
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-0.5 sm:space-y-1 min-w-0 flex-1">
          <p className={cn(
            "text-[10px] sm:text-xs font-semibold truncate",
            variant === "default" ? "text-muted-foreground" : "opacity-90"
          )}>
            {title}
          </p>
          <p className="text-lg sm:text-xl lg:text-2xl font-black truncate">{value}</p>
          {subtitle && (
            <p className={cn(
              "text-[9px] sm:text-[10px] truncate font-medium leading-tight",
              variant === "default" ? "text-muted-foreground" : "opacity-80"
            )}>
              {subtitle}
            </p>
          )}
        </div>
        <div className={cn(
          "p-2 sm:p-2.5 lg:p-3 rounded-xl flex-shrink-0 shadow-card",
          variant === "default" 
            ? "bg-gradient-primary text-primary-foreground" 
            : "bg-white/20 backdrop-blur-sm text-white"
        )}>
          <Icon className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6" />
        </div>
      </div>
    </Card>
  );
};
