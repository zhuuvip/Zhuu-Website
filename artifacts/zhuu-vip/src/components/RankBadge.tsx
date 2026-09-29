import React from "react";
import { Shield, ShieldCheck, Crown } from "lucide-react";

export type RankType = "surface" | "deep-sea" | "trench";
export type BadgeSize = "small" | "medium" | "large";

interface RankBadgeProps {
  rank: RankType;
  size?: BadgeSize;
  showLabel?: boolean;
}

const RANK_CONFIG = {
  surface: {
    label: "Surface",
    icon: Shield,
    color: "rgba(255, 255, 255, 0.65)",
    glowColor: "rgba(255, 255, 255, 0.12)",
    borderColor: "rgba(255, 255, 255, 0.16)",
    bgColor: "rgba(255, 255, 255, 0.04)",
    textColor: "#d4d4d8",
  },
  "deep-sea": {
    label: "Advanced",
    icon: ShieldCheck,
    color: "rgba(255, 255, 255, 0.8)",
    glowColor: "rgba(255, 255, 255, 0.16)",
    borderColor: "rgba(255, 255, 255, 0.22)",
    bgColor: "rgba(255, 255, 255, 0.06)",
    textColor: "#f4f4f5",
  },
  trench: {
    label: "Trench",
    icon: Crown,
    color: "rgba(255, 255, 255, 0.95)",
    glowColor: "rgba(255, 255, 255, 0.2)",
    borderColor: "rgba(255, 255, 255, 0.3)",
    bgColor: "rgba(255, 255, 255, 0.08)",
    textColor: "#ffffff",
  },
};

const SIZE_CONFIG = {
  small: { badge: "w-5 h-5 text-xs", icon: "text-xs", text: "text-xs" },
  medium: { badge: "w-7 h-7 text-sm", icon: "text-sm", text: "text-sm" },
  large: { badge: "w-10 h-10 text-base", icon: "text-base", text: "text-base" },
};

export default function RankBadge({
  rank,
  size = "medium",
  showLabel = false,
}: RankBadgeProps) {
  const config = RANK_CONFIG[rank];
  const sizeConfig = SIZE_CONFIG[size];

  const badge = (
    <div
      className={`${sizeConfig.badge} rounded-full flex items-center justify-center flex-shrink-0 relative transition-all duration-300`}
      style={{
        background: config.bgColor,
        border: `1.5px solid ${config.borderColor}`,
        boxShadow:
          rank === "trench"
            ? `0 0 12px ${config.glowColor}, 0 0 24px ${config.glowColor}`
            : rank === "deep-sea"
              ? `0 0 8px ${config.glowColor}`
              : "none",
        animation: rank === "trench" ? "rank-shimmer 3s ease-in-out infinite" : "none",
      }}
    >
      <config.icon className={sizeConfig.icon} size={size === "small" ? 12 : size === "medium" ? 15 : 19} />
      {rank === "trench" && (
        <div
          className="absolute inset-0 rounded-full"
          style={{
            border: `1px solid ${config.borderColor}`,
            opacity: 0.5,
            transform: "scale(1.3)",
          }}
        />
      )}
    </div>
  );

  if (!showLabel) return badge;

  return (
    <div className="flex items-center gap-2">
      {badge}
      <span className={`${sizeConfig.text} font-semibold`} style={{ color: config.textColor }}>
        {config.label}
      </span>
    </div>
  );
}
