/**
 * Vote Button Component for Final Version Code Review
 * Displays a button for voting (Approve/Request Changes/Comment)
 * with count badge and active state styling
 */

import { type FinalVersionVoteType } from '~/types/final-versions';

interface FinalVersionVoteButtonProps {
  icon: string;
  label: string;
  count: number;
  isActive: boolean;
  onClick: () => void;
  color: 'green' | 'orange' | 'blue';
  disabled?: boolean;
}

export function FinalVersionVoteButton({
  icon,
  label,
  count,
  isActive,
  onClick,
  color,
  disabled = false,
}: FinalVersionVoteButtonProps) {
  // Define color schemes for each vote type
  const colorClasses = {
    green: {
      active: 'bg-green-500 text-white border-green-500 hover:bg-green-600',
      inactive: 'bg-white text-gray-700 border-gray-300 hover:border-green-400 hover:bg-green-50',
      badge: 'bg-green-100 text-green-800',
    },
    orange: {
      active: 'bg-orange-500 text-white border-orange-500 hover:bg-orange-600',
      inactive: 'bg-white text-gray-700 border-gray-300 hover:border-orange-400 hover:bg-orange-50',
      badge: 'bg-orange-100 text-orange-800',
    },
    blue: {
      active: 'bg-blue-500 text-white border-blue-500 hover:bg-blue-600',
      inactive: 'bg-white text-gray-700 border-gray-300 hover:border-blue-400 hover:bg-blue-50',
      badge: 'bg-blue-100 text-blue-800',
    },
  };

  const classes = isActive ? colorClasses[color].active : colorClasses[color].inactive;
  const badgeClasses = isActive ? 'bg-white/30 text-white' : colorClasses[color].badge;

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        flex-1 px-3 py-2 rounded-lg border text-sm font-medium
        transition-all duration-200
        disabled:opacity-50 disabled:cursor-not-allowed
        ${classes}
      `}
      title={`${label}${count > 0 ? ` (${count})` : ''}`}
    >
      <div className="flex items-center justify-center gap-1.5">
        <span className="text-base">{icon}</span>
        <span className="hidden sm:inline">{label}</span>
        {count > 0 && (
          <span className={`ml-1 px-1.5 py-0.5 rounded-full text-xs font-semibold ${badgeClasses}`}>
            {count}
          </span>
        )}
      </div>
    </button>
  );
}
