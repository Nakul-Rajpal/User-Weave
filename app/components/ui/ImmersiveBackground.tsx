/**
 * Immersive background: gradient mesh + subtle grid (CSS-only, no Three.js).
 * Use on lobby, auth, or landing views for depth and polish.
 */

import { classNames } from '~/utils/classNames';

interface ImmersiveBackgroundProps {
  /** Optional: show subtle perspective grid */
  grid?: boolean;
  /** Optional: show floating gradient orbs */
  orbs?: boolean;
  /** Optional: variant - default (purple/blue) or warm */
  variant?: 'default' | 'warm' | 'minimal';
  className?: string;
  children?: React.ReactNode;
}

export function ImmersiveBackground({
  grid = true,
  orbs = true,
  variant = 'default',
  className,
  children,
}: ImmersiveBackgroundProps) {
  const gradientClass =
    variant === 'warm'
      ? 'from-amber-500/20 via-orange-500/10 to-rose-500/15'
      : variant === 'minimal'
        ? 'from-accent-500/10 via-transparent to-accent-600/5'
        : 'from-accent-600/25 via-violet-500/15 to-blue-600/20';

  return (
    <div
      className={classNames(
        'relative min-h-screen w-full overflow-hidden',
        className,
      )}
    >
      {/* Base gradient mesh */}
      <div
        className={classNames(
          'absolute inset-0 bg-gradient-to-br animate-gradient-shine',
          gradientClass,
        )}
      />
      {/* Secondary layer for depth */}
      <div
        className="absolute inset-0 bg-gradient-to-t from-bolt-elements-bg-depth-1/80 via-transparent to-bolt-elements-bg-depth-1/60"
        aria-hidden
      />
      {/* Optional: perspective grid */}
      {grid && (
        <div
          className="absolute inset-0 animate-grid-pulse opacity-40"
          aria-hidden
        >
          <div
            className="h-full w-full"
            style={{
              backgroundImage: `
                linear-gradient(rgba(156,125,255,0.08) 1px, transparent 1px),
                linear-gradient(90deg, rgba(156,125,255,0.08) 1px, transparent 1px)
              `,
              backgroundSize: '48px 48px',
              transform: 'perspective(500px) rotateX(60deg) scale(1.5)',
              transformOrigin: 'center 100px',
            }}
          />
        </div>
      )}
      {/* Optional: floating gradient orbs (CSS-only) */}
      {orbs && (
        <>
          <div
            className="absolute rounded-full bg-accent-500/20 blur-3xl w-96 h-96 -top-32 -left-32 animate-orb-float"
            aria-hidden
          />
          <div
            className="absolute rounded-full bg-blue-500/15 blur-3xl w-80 h-80 top-1/2 -right-24 animate-orb-float animate-fade-in-up-delay-2"
            style={{ animationDelay: '2s' }}
            aria-hidden
          />
          <div
            className="absolute rounded-full bg-violet-500/15 blur-3xl w-72 h-72 bottom-20 left-1/4 animate-orb-float"
            style={{ animationDelay: '4s' }}
            aria-hidden
          />
        </>
      )}
      {/* Content sits above */}
      {children && (
        <div className="relative z-10 min-h-screen flex flex-col">
          {children}
        </div>
      )}
    </div>
  );
}
