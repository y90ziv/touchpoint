import React from 'react';

interface ProgressRingAvatarProps {
  name: string;
  progressPercent?: number;
  progress?: number;
  status?: 'overdue' | 'due_today' | 'due_soon' | 'on_track' | 'paused' | 'snoozed' | 'untracked';
  size?: 'sm' | 'md' | 'lg' | number;
}

export function getInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function ProgressRingAvatar({
  name,
  progressPercent,
  progress,
  status = 'on_track',
  size = 'md',
}: ProgressRingAvatarProps) {
  const effectiveProgress = progressPercent ?? progress ?? 0;
  const dimensions =
    typeof size === 'number'
      ? size
      : size === 'sm'
      ? 36
      : size === 'lg'
      ? 52
      : 42;
  const strokeWidth = dimensions < 30 ? 2 : dimensions < 40 ? 2.5 : 3;
  const radius = (dimensions - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(100, Math.max(0, effectiveProgress));
  const offset = circumference - (clamped / 100) * circumference;

  let strokeColor = 'var(--tp-success)';
  if (status === 'overdue' || status === 'due_today') {
    strokeColor = 'var(--tp-overdue)';
  } else if (status === 'due_soon') {
    strokeColor = 'var(--tp-warning)';
  } else if (status === 'untracked' || status === 'paused') {
    strokeColor = 'var(--tp-border)';
  }

  return (
    <div
      className="relative inline-flex items-center justify-center shrink-0 select-none"
      style={{ width: dimensions, height: dimensions }}
    >
      <svg
        width={dimensions}
        height={dimensions}
        viewBox={`0 0 ${dimensions} ${dimensions}`}
        className="-rotate-90"
      >
        <circle
          cx={dimensions / 2}
          cy={dimensions / 2}
          r={radius}
          fill="var(--tp-card)"
          stroke="var(--tp-border)"
          strokeWidth={strokeWidth}
        />
        {status !== 'untracked' && (
          <circle
            cx={dimensions / 2}
            cy={dimensions / 2}
            r={radius}
            fill="none"
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
          />
        )}
      </svg>
      <span className="absolute text-xs font-semibold tracking-tight text-foreground">
        {getInitials(name)}
      </span>
    </div>
  );
}
