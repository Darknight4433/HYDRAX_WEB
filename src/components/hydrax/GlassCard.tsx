import type { HTMLAttributes, ReactNode } from "react";
import { motion, type HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";

type GlassCardProps = Omit<HTMLMotionProps<"div">, "children"> & {
  className?: string;
  children?: ReactNode;
  glow?: boolean;
};

export function GlassCard({ className, children, glow, ...rest }: GlassCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className={cn(
        "glass relative overflow-hidden rounded-2xl p-5",
        glow && "glow-primary",
        className,
      )}
      {...rest}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{ background: "var(--gradient-glow)" }}
      />
      <div className="relative">{children}</div>
    </motion.div>
  );
}

export function StaticGlass({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("glass rounded-2xl p-5", className)} {...rest}>
      {children}
    </div>
  );
}
