import React from "react";

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
    icon: "🌊",
    color: "rgba(0, 150, 180, 0.7)",
    glowColor: "rgba(0, 150, 180, 0.2)",
    borderColor: "rgba(0, 150, 180, 0.5)",
    bgColor: "rgba(0, 150, 180, 0.08)",
    textColor: "#4dd9ff",
  },
  "deep-sea": {
    label: "Deep Sea",
    icon: "🐠",
    color: "rgba(0, 229, 255, 0.9)",
    glowColor: "rgba(0, 229, 255, 0.3)",
    borderColor: "rgba(0, 229, 255, 0.7)",
    bgColor: "rgba(0, 229, 255, 0.1)",
    textColor: "#00e5ff",
  },
  trench: {
    label: "Trench",
    icon: "🦑",
    color: "rgba(192, 132, 252, 1)",
    glowColor: "rgba(192, 132, 252, 0.4)",
    borderColor: "rgba(192, 132, 252, 0.8)",
    bgColor: "rgba(192, 132, 252, 0.12)",
    textColor: "#e9d5ff",
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
      <span className={sizeConfig.icon}>{config.icon}</span>
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
