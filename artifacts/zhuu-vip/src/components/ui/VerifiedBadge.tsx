import { BadgeCheck } from "lucide-react";

type VerifiedBadgeProps = {
  size?: number;
  className?: string;
  title?: string;
};

export default function VerifiedBadge({
  size = 16,
  className = "",
  title = "Verified",
}: VerifiedBadgeProps) {
  return (
    <span
      className={`verified-badge inline-flex items-center justify-center ${className}`}
      title={title}
      aria-label={title}
    >
      <BadgeCheck
        size={size}
        strokeWidth={2.4}
        className="verified-badge-icon"
      />
    </span>
  );
}
