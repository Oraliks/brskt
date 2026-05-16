'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { spinWheelAction } from '@/lib/actions/games';
import { useHaptic } from '@/components/mini/telegram-webapp';
import { cn } from '@/lib/utils';

interface Segment {
  weight: number;
  rewardType: 'xp' | 'promo';
  value: number;
  label: string;
}

interface Props {
  segments: Segment[];
  canSpin: boolean;
  nextSpinAt: string | null;
}

/**
 * Roue interactive — animation CSS pure (rotation via transition).
 *
 * Logique :
 *  1. Click → call server action → reçoit segmentIndex
 *  2. Calcule l'angle final pour aligner le segment gagnant sous le pointeur
 *  3. Animation 4s avec easing → toast au final
 *
 * On évite Motion/Framer pour rester léger — `transition: transform` est
 * plus que suffisant pour ce visuel.
 */
export function WheelSpinner({ segments, canSpin, nextSpinAt }: Props) {
  const router = useRouter();
  const haptic = useHaptic();
  const [pending, start] = useTransition();
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<{
    label: string;
    promoCode?: string;
  } | null>(null);

  const segmentCount = segments.length;
  const segmentAngle = 360 / segmentCount;

  function handleSpin() {
    if (!canSpin || pending || spinning) return;
    haptic.impact('heavy');
    setSpinning(true);
    setResult(null);

    start(async () => {
      const res = await spinWheelAction();
      if (!res.success) {
        haptic.error();
        setSpinning(false);
        toast({
          title: 'Spin refusé',
          description: res.error,
          variant: 'destructive',
        });
        return;
      }

      // Calcule angle final : 5 tours pleins + position du segment gagnant
      // centré sous le pointeur (qui pointe vers le haut à 0°).
      const target =
        5 * 360 + (360 - res.data.segmentIndex * segmentAngle - segmentAngle / 2);
      setRotation(target);

      // L'animation dure 4s — on résout après
      setTimeout(() => {
        setSpinning(false);
        haptic.success();
        setResult({
          label: res.data.label,
          promoCode: res.data.promoCode,
        });
        toast({
          title: `🎉 ${res.data.label}`,
          description: res.data.promoCode
            ? `Code à utiliser au checkout : ${res.data.promoCode}`
            : `Nouveau total : ${res.data.newXpTotal} XP`,
        });
        router.refresh();
      }, 4000);
    });
  }

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="relative w-72 h-72 sm:w-96 sm:h-96">
        {/* Pointeur */}
        <div
          aria-hidden
          className="absolute left-1/2 -top-2 -translate-x-1/2 z-10 w-0 h-0 border-l-[10px] border-r-[10px] border-t-[20px] border-l-transparent border-r-transparent border-t-amber-400 drop-shadow-lg"
        />

        {/* Roue */}
        <div
          className="absolute inset-0 rounded-full border-4 border-[var(--color-border-strong)] shadow-[0_0_60px_-10px_rgba(245,158,11,0.5)]"
          style={{
            transform: `rotate(${rotation}deg)`,
            transition: spinning
              ? 'transform 4s cubic-bezier(0.17, 0.67, 0.3, 1.01)'
              : 'none',
          }}
        >
          <svg
            viewBox="-100 -100 200 200"
            className="w-full h-full"
            style={{ overflow: 'visible' }}
          >
            {segments.map((seg, i) => {
              const startAngle = (i * 360) / segmentCount - 90;
              const endAngle = ((i + 1) * 360) / segmentCount - 90;
              const path = describeArc(0, 0, 95, startAngle, endAngle);
              const fill = SEGMENT_COLORS[i % SEGMENT_COLORS.length];
              const midAngle = (startAngle + endAngle) / 2;
              const midRad = (midAngle * Math.PI) / 180;
              const labelR = 60;
              const lx = Math.cos(midRad) * labelR;
              const ly = Math.sin(midRad) * labelR;
              return (
                <g key={i}>
                  <path d={path} fill={fill} stroke="#1a1a25" strokeWidth="1" />
                  <text
                    x={lx}
                    y={ly}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="#fff"
                    fontSize="9"
                    fontWeight="600"
                    transform={`rotate(${midAngle + 90}, ${lx}, ${ly})`}
                  >
                    {seg.label.replace('🎉 ', '').slice(0, 14)}
                  </text>
                </g>
              );
            })}
            <circle r="14" fill="var(--color-bg-elevated)" stroke="var(--color-border-strong)" strokeWidth="2" />
          </svg>
        </div>
      </div>

      <div className="flex flex-col items-center gap-2 max-w-md text-center">
        {canSpin ? (
          <Button
            size="lg"
            onClick={handleSpin}
            disabled={pending || spinning || !canSpin}
            className="gap-2"
          >
            {pending || spinning ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Lancement…
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Tourner la roue
              </>
            )}
          </Button>
        ) : (
          <div className="text-center">
            <Button size="lg" disabled className="gap-2">
              Cooldown actif
            </Button>
            {nextSpinAt && (
              <p className="text-xs text-[var(--color-text-faint)] mt-2">
                Prochaine roue :{' '}
                {new Date(nextSpinAt).toLocaleString('fr-FR', {
                  dateStyle: 'short',
                  timeStyle: 'short',
                })}
              </p>
            )}
          </div>
        )}

        {result && (
          <div className="mt-4 glass-strong rounded-[var(--radius-md)] px-4 py-3 border border-amber-500/30">
            <div className="font-serif text-lg">{result.label}</div>
            {result.promoCode && (
              <code
                className={cn(
                  'mt-2 inline-block px-3 py-1 bg-[var(--color-surface-tint)] rounded font-mono text-amber-300'
                )}
              >
                {result.promoCode}
              </code>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const SEGMENT_COLORS = [
  '#312e81', // indigo-900
  '#7c2d12', // amber-900
  '#1e3a8a', // blue-900
  '#581c87', // purple-900
  '#7f1d1d', // red-900
  '#064e3b', // emerald-900
  '#a16207', // amber-700 (jackpot)
];

/** Renvoie un path SVG pour un arc de cercle entre 2 angles (degrés). */
function describeArc(
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number
): string {
  const start = polar(cx, cy, r, endAngle);
  const end = polar(cx, cy, r, startAngle);
  const largeArc = endAngle - startAngle <= 180 ? 0 : 1;
  return `M ${cx} ${cy} L ${end.x} ${end.y} A ${r} ${r} 0 ${largeArc} 0 ${start.x} ${start.y} Z`;
}

function polar(cx: number, cy: number, r: number, angle: number) {
  const rad = (angle * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}
