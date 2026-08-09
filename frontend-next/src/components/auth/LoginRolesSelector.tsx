"use client";

import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface LoginRoleOption {
  value: string;
  label: string;
  description: string;
  tone: "secondary" | "danger" | "accent" | "success";
  icon: LucideIcon;
}

export interface LoginRolesSelectorProps {
  roles: readonly LoginRoleOption[];
  selectedRole: string;
  onChange: (value: string) => void;
  showError: boolean;
  performanceMode: boolean;
}

const roleToneClasses = {
  owner: { icon: "text-secondary", bg: "bg-secondary/12", border: "border-secondary/25" },
  admin: { icon: "text-danger", bg: "bg-danger/12", border: "border-danger/25" },
  moderador: { icon: "text-accent", bg: "bg-accent/12", border: "border-accent/25" },
  usuario: { icon: "text-success", bg: "bg-success/12", border: "border-success/25" },
} as const;

export function LoginRolesSelector({
  roles,
  selectedRole,
  onChange,
  showError,
  performanceMode,
}: LoginRolesSelectorProps) {
  return (
    <div>
      <label className="block text-xs font-semibold text-muted mb-2">
        Rol de Acceso <span className="text-danger">*</span>
      </label>
      {(!selectedRole || showError) && (
        <p
          className={cn(
            "text-xs mb-3 flex items-center gap-1",
            showError ? "text-danger" : "text-warning",
          )}
        >
          <span aria-hidden="true">⚠</span> Selecciona el rol con el que deseas acceder
        </p>
      )}
      <div className="grid grid-cols-2 gap-2.5">
        {roles.map((role) => {
          const IconComponent = role.icon;
          const isSelected = selectedRole === role.value;
          const tone = roleToneClasses[role.value as keyof typeof roleToneClasses];

          return (
            <motion.button
              key={role.value}
              type="button"
              onClick={() => onChange(role.value)}
              whileHover={performanceMode ? undefined : { scale: 1.02 }}
              whileTap={{ scale: 0.985 }}
              className={cn(
                "p-2.5 rounded-2xl border transition-all duration-200 text-left hover-outline-gradient press-scale",
                isSelected
                  ? `${tone.bg} ${tone.border} shadow-[0_18px_60px_rgb(var(--shadow-rgb)_/_0.28)]`
                  : "bg-card/15 border-border/20 hover:bg-card/25 hover:border-border/35",
                !selectedRole && showError && "shake-on-error",
              )}
            >
              <div className="flex items-center gap-2 mb-1">
                <IconComponent
                  className={cn(
                    "w-4 h-4",
                    isSelected ? tone.icon : "text-muted",
                  )}
                />
                <span
                  className={cn(
                    "font-semibold text-sm",
                    isSelected ? "text-foreground" : "text-foreground/85",
                  )}
                >
                  {role.label}
                </span>
              </div>
              <p
                className={cn(
                  "text-xs leading-snug hidden sm:block",
                  isSelected ? "text-muted" : "text-muted/80",
                )}
              >
                {role.description}
              </p>
            </motion.button>
          );
        })}
      </div>
      {selectedRole && (
        <motion.p
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-xs text-success mt-2 flex items-center gap-1"
        >
          <span aria-hidden="true">✓</span> Accederás como {roles.find((r) => r.value === selectedRole)?.label}
        </motion.p>
      )}
    </div>
  );
}
