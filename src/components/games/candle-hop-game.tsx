'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Bird, Loader2, RotateCcw, Sparkles, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { useHaptic } from '@/components/mini/telegram-webapp';
import { submitCandleHopAction } from '@/lib/actions/games';

interface Props {
  bestScore: number;
  runsLeftToday: number;
  xpRoomToday: number;
}

// Game world dimensions (logical). Canvas est rendu en pixel ratio device.
const W = 360;
const H = 600;

const GRAVITY = 1500; // px/s^2
const JUMP_V = -460; // px/s
const PLAYER_X = 90;
const PLAYER_SIZE = 26;
const SCROLL_SPEED_START = 180; // px/s
const SPEED_INCREMENT_PER_10_SCORE = 0.05;
const OBSTACLE_SPACING = 220; // px entre 2 paires
const GAP_MIN = 140;
const GAP_MAX = 200;
const OBSTACLE_W = 56;
const BONUS_SIZE = 22;

interface Obstacle {
  x: number;
  gapY: number;
  gapH: number;
  passed: boolean;
}

interface Bonus {
  x: number;
  y: number;
  collected: boolean;
}

interface GameState {
  phase: 'idle' | 'playing' | 'dead';
  player: { y: number; vy: number; rot: number };
  obstacles: Obstacle[];
  bonuses: Bonus[];
  scrollX: number;
  speed: number;
  score: number;
  startedAtMs: number;
  taps: number;
  particles: Array<{
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    color: string;
    size: number;
  }>;
}

function makeInitialState(): GameState {
  return {
    phase: 'idle',
    player: { y: H / 2, vy: 0, rot: 0 },
    obstacles: [],
    bonuses: [],
    scrollX: 0,
    speed: SCROLL_SPEED_START,
    score: 0,
    startedAtMs: 0,
    taps: 0,
    particles: [],
  };
}

export function CandleHopGame({ bestScore, runsLeftToday, xpRoomToday }: Props) {
  const router = useRouter();
  const haptic = useHaptic();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<GameState>(makeInitialState());
  const lastTimeRef = useRef<number>(0);
  const animRef = useRef<number>(0);
  const submittedRef = useRef(false);
  const [, setTick] = useState(0); // pour forcer re-render des overlays UI
  const [phase, setPhase] = useState<'idle' | 'playing' | 'dead'>('idle');
  const [score, setScore] = useState(0);
  const [submitResult, setSubmitResult] = useState<
    | null
    | {
        xpAwarded: number;
        bonusXp: number;
        newTotal: number;
        isPersonalBest: boolean;
        runsLeftToday: number;
      }
  >(null);
  const [pending, start] = useTransition();

  // ============ Game logic ============
  const spawnObstacles = useCallback((g: GameState) => {
    while (
      g.obstacles.length === 0 ||
      g.obstacles[g.obstacles.length - 1]!.x < W + OBSTACLE_SPACING
    ) {
      const lastX = g.obstacles[g.obstacles.length - 1]?.x ?? W;
      const newX = lastX + OBSTACLE_SPACING;
      const gapH = GAP_MIN + Math.random() * (GAP_MAX - GAP_MIN);
      const margin = 80;
      const gapY = margin + Math.random() * (H - 2 * margin - gapH);
      g.obstacles.push({ x: newX, gapY, gapH, passed: false });
      // 40% chance de bonus dans le gap
      if (Math.random() < 0.4) {
        g.bonuses.push({
          x: newX + OBSTACLE_W / 2,
          y: gapY + gapH / 2,
          collected: false,
        });
      }
    }
  }, []);

  const reset = useCallback(() => {
    gameRef.current = makeInitialState();
    submittedRef.current = false;
    setPhase('idle');
    setScore(0);
    setSubmitResult(null);
  }, []);

  const startGame = useCallback(() => {
    const g = gameRef.current;
    g.phase = 'playing';
    g.startedAtMs = performance.now();
    g.player.vy = JUMP_V;
    g.taps = 1;
    submittedRef.current = false;
    setPhase('playing');
    haptic.impact('light');
  }, [haptic]);

  const jump = useCallback(() => {
    const g = gameRef.current;
    g.player.vy = JUMP_V;
    g.taps++;
    haptic.selection();
  }, [haptic]);

  const submitRun = useCallback(
    (g: GameState) => {
      if (submittedRef.current) return;
      submittedRef.current = true;
      const durationMs = performance.now() - g.startedAtMs;
      const score = g.score;
      const taps = g.taps;
      start(async () => {
        const res = await submitCandleHopAction({
          score,
          durationMs,
          taps,
        });
        if (!res.success) {
          haptic.error();
          toast({
            title: 'Run non enregistré',
            description: res.error,
            variant: 'destructive',
          });
          return;
        }
        setSubmitResult({
          xpAwarded: res.data.xpAwarded,
          bonusXp: res.data.bonusXp,
          newTotal: res.data.newTotal,
          isPersonalBest: res.data.isPersonalBest,
          runsLeftToday: res.data.runsLeftToday,
        });
        if (res.data.isPersonalBest && score > 0) {
          haptic.success();
          toast({
            title: '🏆 Nouveau record !',
            description: `Score ${score} · +${res.data.xpAwarded} XP`,
          });
        } else if (res.data.xpAwarded > 0) {
          haptic.success();
        }
      });
    },
    [haptic]
  );

  // Inputs
  useEffect(() => {
    const handler = (e: KeyboardEvent | TouchEvent | MouseEvent) => {
      if (e instanceof KeyboardEvent && e.code !== 'Space' && e.code !== 'ArrowUp') {
        return;
      }
      // Avoid duplicate from touch + click on mobile
      if (e instanceof KeyboardEvent) e.preventDefault();

      const g = gameRef.current;
      if (g.phase === 'idle') startGame();
      else if (g.phase === 'playing') jump();
      // dead → handled by button click
    };
    window.addEventListener('keydown', handler);
    return () => {
      window.removeEventListener('keydown', handler);
    };
  }, [startGame, jump]);

  // Main game loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      const container = containerRef.current;
      if (!container) return;
      const cw = container.clientWidth;
      const ch = container.clientHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = cw * dpr;
      canvas.height = ch * dpr;
      canvas.style.width = `${cw}px`;
      canvas.style.height = `${ch}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const drawScene = () => {
      const container = containerRef.current!;
      const cw = container.clientWidth;
      const ch = container.clientHeight;
      const scaleX = cw / W;
      const scaleY = ch / H;

      // Background gradient
      const grad = ctx.createLinearGradient(0, 0, 0, ch);
      grad.addColorStop(0, 'rgba(15, 23, 42, 1)');
      grad.addColorStop(1, 'rgba(30, 41, 59, 1)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, cw, ch);

      // Grille de chart
      ctx.strokeStyle = 'rgba(99, 102, 241, 0.08)';
      ctx.lineWidth = 1;
      const gridSize = 40 * scaleX;
      const offsetX = -((gameRef.current.scrollX * scaleX) % gridSize);
      for (let x = offsetX; x < cw; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, ch);
        ctx.stroke();
      }
      for (let y = 0; y < ch; y += 40 * scaleY) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(cw, y);
        ctx.stroke();
      }

      const g = gameRef.current;

      // Obstacles (bougies rouges)
      for (const o of g.obstacles) {
        const x = o.x * scaleX;
        const wPx = OBSTACLE_W * scaleX;
        // Bougie du haut (de 0 à gapY)
        drawCandle(ctx, x, 0, wPx, o.gapY * scaleY, '#ef4444', '#dc2626');
        // Bougie du bas (de gapY+gapH à H)
        const bottomY = (o.gapY + o.gapH) * scaleY;
        drawCandle(ctx, x, bottomY, wPx, ch - bottomY, '#ef4444', '#dc2626');
      }

      // Bonus (bougies vertes)
      for (const b of g.bonuses) {
        if (b.collected) continue;
        const x = b.x * scaleX;
        const y = b.y * scaleY;
        const s = BONUS_SIZE * scaleX;
        // Glow
        ctx.fillStyle = 'rgba(16, 185, 129, 0.25)';
        ctx.beginPath();
        ctx.arc(x, y, s * 0.9, 0, Math.PI * 2);
        ctx.fill();
        // Body
        drawCandle(ctx, x - s / 2, y - s / 2, s, s, '#10b981', '#059669');
      }

      // Player (candlestick)
      const px = PLAYER_X * scaleX;
      const py = g.player.y * scaleY;
      const ps = PLAYER_SIZE * scaleX;
      ctx.save();
      ctx.translate(px, py);
      const rot = clamp(g.player.vy / 800, -0.4, 0.7);
      ctx.rotate(rot);
      // wick
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(-1, -ps / 2 - 4, 2, ps + 8);
      // body
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(-ps / 2, -ps / 2, ps, ps);
      // border
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2;
      ctx.strokeRect(-ps / 2, -ps / 2, ps, ps);
      ctx.restore();

      // Particles
      for (const p of g.particles) {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.beginPath();
        ctx.arc(p.x * scaleX, p.y * scaleY, p.size * scaleX, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    };

    const update = (dtMs: number) => {
      const g = gameRef.current;
      const dt = dtMs / 1000;
      if (g.phase !== 'playing') {
        // Particles still update even on death
        for (const p of g.particles) {
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.vy += GRAVITY * 0.6 * dt;
          p.life -= dt * 1.2;
        }
        g.particles = g.particles.filter((p) => p.life > 0);
        return;
      }

      // Physics
      g.player.vy += GRAVITY * dt;
      g.player.y += g.player.vy * dt;
      g.scrollX += g.speed * dt;

      // Spawn obstacles
      spawnObstacles(g);

      // Scroll obstacles toward player
      for (const o of g.obstacles) o.x -= g.speed * dt;
      for (const b of g.bonuses) b.x -= g.speed * dt;
      g.obstacles = g.obstacles.filter((o) => o.x + OBSTACLE_W > 0);
      g.bonuses = g.bonuses.filter((b) => b.x + BONUS_SIZE > 0 && !b.collected);

      // Collisions
      const playerLeft = PLAYER_X - PLAYER_SIZE / 2;
      const playerRight = PLAYER_X + PLAYER_SIZE / 2;
      const playerTop = g.player.y - PLAYER_SIZE / 2;
      const playerBottom = g.player.y + PLAYER_SIZE / 2;

      // Sol / plafond
      if (g.player.y < PLAYER_SIZE / 2 || g.player.y > H - PLAYER_SIZE / 2) {
        killPlayer(g);
        return;
      }

      for (const o of g.obstacles) {
        const oL = o.x;
        const oR = o.x + OBSTACLE_W;
        if (playerRight < oL || playerLeft > oR) continue;
        // En collision X. Check Y : si player dans gap → safe
        const inGap =
          playerTop > o.gapY && playerBottom < o.gapY + o.gapH;
        if (!inGap) {
          killPlayer(g);
          return;
        }
        // Score (passe = quand center du player passe à droite de l'obstacle)
        if (!o.passed && PLAYER_X > oR) {
          o.passed = true;
          g.score++;
          // Speed up
          g.speed =
            SCROLL_SPEED_START *
            (1 + Math.floor(g.score / 10) * SPEED_INCREMENT_PER_10_SCORE);
          setScore(g.score);
          haptic.selection();
        }
      }
      for (const b of g.bonuses) {
        if (b.collected) continue;
        const dx = (b.x + BONUS_SIZE / 2) - PLAYER_X;
        const dy = b.y - g.player.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < PLAYER_SIZE / 2 + BONUS_SIZE / 2) {
          b.collected = true;
          g.score += 3;
          haptic.impact('light');
          // Particules vertes
          for (let i = 0; i < 8; i++) {
            const a = Math.random() * Math.PI * 2;
            const spd = 80 + Math.random() * 120;
            g.particles.push({
              x: b.x + BONUS_SIZE / 2,
              y: b.y,
              vx: Math.cos(a) * spd,
              vy: Math.sin(a) * spd,
              life: 0.7,
              color: '#34d399',
              size: 3,
            });
          }
          setScore(g.score);
        }
      }

      // Particles update
      for (const p of g.particles) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += GRAVITY * 0.6 * dt;
        p.life -= dt * 1.2;
      }
      g.particles = g.particles.filter((p) => p.life > 0);
    };

    const killPlayer = (g: GameState) => {
      g.phase = 'dead';
      haptic.error();
      // Explosion
      for (let i = 0; i < 18; i++) {
        const a = Math.random() * Math.PI * 2;
        const spd = 120 + Math.random() * 180;
        g.particles.push({
          x: PLAYER_X,
          y: g.player.y,
          vx: Math.cos(a) * spd,
          vy: Math.sin(a) * spd,
          life: 0.9,
          color: i % 2 === 0 ? '#ef4444' : '#fbbf24',
          size: 3 + Math.random() * 2,
        });
      }
      setPhase('dead');
      submitRun(g);
    };

    const loop = (t: number) => {
      const dt = lastTimeRef.current ? Math.min(50, t - lastTimeRef.current) : 16;
      lastTimeRef.current = t;
      update(dt);
      drawScene();
      animRef.current = requestAnimationFrame(loop);
    };
    animRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [haptic, spawnObstacles, submitRun]);

  // Re-render ticker for UI (debug, futur HUD avancé)
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 250);
    return () => clearInterval(t);
  }, []);

  const handleTap = useCallback(() => {
    const g = gameRef.current;
    if (g.phase === 'idle') startGame();
    else if (g.phase === 'playing') jump();
  }, [startGame, jump]);

  const canRetry = !pending && runsLeftToday > 1;

  return (
    <div className="space-y-3 max-w-md mx-auto">
      <div
        ref={containerRef}
        onPointerDown={handleTap}
        className="relative overflow-hidden rounded-[var(--radius-lg)] border-2 border-[var(--color-border-strong)] bg-slate-900 cursor-pointer select-none touch-none"
        style={{ aspectRatio: `${W} / ${H}`, maxHeight: '70vh' }}
      >
        <canvas ref={canvasRef} className="absolute inset-0" />

        {/* HUD : score top */}
        <div className="absolute top-3 left-0 right-0 pointer-events-none">
          <div className="text-center">
            <div className="inline-block px-4 py-1 rounded-full bg-black/40 backdrop-blur-sm border border-white/10">
              <span className="font-serif text-2xl text-amber-300 drop-shadow">
                {score}
              </span>
            </div>
          </div>
          {bestScore > 0 && (
            <div className="absolute top-1 right-3 text-[10px] uppercase tracking-wider text-white/50 font-mono">
              Best {bestScore}
            </div>
          )}
        </div>

        {/* Idle overlay */}
        {phase === 'idle' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center bg-black/30 backdrop-blur-[2px] gap-4 px-6">
            <div className="animate-pulse">
              <Bird className="h-14 w-14 text-amber-300 drop-shadow" />
            </div>
            <h3 className="font-serif text-2xl text-white">
              Tap pour décoller
            </h3>
            <p className="text-sm text-white/70 max-w-xs">
              Évite les bougies rouges, choppe les vertes. Continue jusqu&apos;à
              la fin du graph.
            </p>
            <div className="inline-flex items-center gap-1.5 text-xs text-white/60 mt-2">
              <Sparkles className="h-3 w-3" />
              {runsLeftToday} runs restants ·{' '}
              {xpRoomToday > 0 ? `${xpRoomToday} XP dispo` : 'cap XP atteint'}
            </div>
          </div>
        )}

        {/* Death overlay */}
        {phase === 'dead' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center bg-black/55 backdrop-blur-sm gap-3 px-6">
            {pending ? (
              <>
                <Loader2 className="h-8 w-8 animate-spin text-amber-300" />
                <p className="text-sm text-white/80">Enregistrement…</p>
              </>
            ) : submitResult ? (
              <>
                {submitResult.isPersonalBest && score > 0 && (
                  <div className="inline-flex items-center gap-2 rounded-full bg-amber-500/20 border border-amber-500/40 px-3 py-1 text-xs text-amber-200">
                    <Trophy className="h-3.5 w-3.5" />
                    Nouveau record
                  </div>
                )}
                <div className="font-serif text-6xl text-white drop-shadow leading-none">
                  {score}
                </div>
                <div className="text-sm text-white/80">
                  {submitResult.xpAwarded > 0 ? (
                    <>
                      +{submitResult.xpAwarded} XP
                      {submitResult.bonusXp > 0 && (
                        <span className="text-amber-300">
                          {' '}
                          (dont +{submitResult.bonusXp} bonus)
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-white/60">Cap XP du jour atteint</span>
                  )}
                </div>
                <div className="flex flex-col sm:flex-row gap-2 mt-2 w-full max-w-xs">
                  {canRetry ? (
                    <Button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        reset();
                      }}
                      className="flex-1"
                    >
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Rejouer ({submitResult.runsLeftToday})
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push('/jeux');
                    }}
                    className="flex-1"
                  >
                    Retour
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </>
            ) : (
              <>
                <Loader2 className="h-8 w-8 animate-spin text-amber-300" />
                <p className="text-sm text-white/70">…</p>
              </>
            )}
          </div>
        )}
      </div>

      {phase === 'playing' && (
        <div className="text-center text-xs text-[var(--color-text-faint)]">
          Tap dans la zone pour sauter · vitesse augmente avec le score
        </div>
      )}
    </div>
  );
}

function drawCandle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
  border: string
) {
  // Body
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
  // Subtle inner shadow
  const grad = ctx.createLinearGradient(x, y, x + w, y);
  grad.addColorStop(0, 'rgba(0,0,0,0.15)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0.1)');
  grad.addColorStop(1, 'rgba(0,0,0,0.15)');
  ctx.fillStyle = grad;
  ctx.fillRect(x, y, w, h);
  // Border
  ctx.strokeStyle = border;
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
