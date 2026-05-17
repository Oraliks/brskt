'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Award,
  ArrowRight,
  Bird,
  CheckCircle2,
  Lock,
  Loader2,
  RotateCcw,
  Sparkles,
  Trophy,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { useHaptic } from '@/components/mini/telegram-webapp';
import { submitCandleHopAction } from '@/lib/actions/games';
import { cn } from '@/lib/utils';

interface Skin {
  id: string;
  label: string;
  unlockXp: number;
  fill: string;
  border: string;
  glow: string;
  description: string;
}

interface PowerUpDef {
  id: string;
  label: string;
  durationMs: number;
  color: string;
  description: string;
}

type Mode = 'endless' | 'time_attack' | 'survival';

interface ModeDef {
  id: Mode;
  label: string;
  description: string;
}

interface Props {
  bestScore: number;
  bestByMode: Record<Mode, number>;
  runsLeftToday: number;
  xpRoomToday: number;
  xpTotal: number;
  skins: Skin[];
  powerUps: PowerUpDef[];
  modes: ModeDef[];
}

// Game world dimensions (logical)
const W = 360;
const H = 600;

const GRAVITY = 1500;
const JUMP_V = -460;
const PLAYER_X = 90;
const PLAYER_SIZE = 26;
const SCROLL_SPEED_START = 180;
const SPEED_INCREMENT_PER_10_SCORE = 0.05;
const OBSTACLE_SPACING = 220;
const GAP_MIN = 140;
const GAP_MAX = 200;
const OBSTACLE_W = 56;
const BONUS_SIZE = 22;
const POWERUP_SIZE = 28;
const POWERUP_SPAWN_CHANCE = 0.12; // ~12% par obstacle pair → ~1 toutes les 8 paires
const MAGNET_RADIUS = 100;

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

interface PowerUpInstance {
  x: number;
  y: number;
  defId: string;
  color: string;
  collected: boolean;
}

interface ActivePowerUp {
  id: string;
  expiresAt: number;
  color: string;
  label: string;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  size: number;
}

interface GameState {
  phase: 'idle' | 'playing' | 'dead';
  player: { y: number; vy: number };
  obstacles: Obstacle[];
  bonuses: Bonus[];
  powerUpsOnField: PowerUpInstance[];
  activePowerUps: ActivePowerUp[];
  scrollX: number;
  speed: number;
  score: number;
  startedAtMs: number;
  taps: number;
  particles: Particle[];
  bonusesCollected: number;
  powerUpsUsed: number;
  // V3
  mode: Mode;
  bossEndsAt: number; // performance.now() ; > now si boss en cours
  bossesTriggered: number; // tracking pour ne pas re-trigger
  /** Pour Time Attack : timestamp prévu de fin */
  timeAttackEndsAt: number;
}

function makeInitialState(mode: Mode = 'endless'): GameState {
  return {
    phase: 'idle',
    player: { y: H / 2, vy: 0 },
    obstacles: [],
    bonuses: [],
    powerUpsOnField: [],
    activePowerUps: [],
    scrollX: 0,
    speed: SCROLL_SPEED_START,
    score: 0,
    startedAtMs: 0,
    taps: 0,
    particles: [],
    bonusesCollected: 0,
    powerUpsUsed: 0,
    mode,
    bossEndsAt: 0,
    bossesTriggered: 0,
    timeAttackEndsAt: 0,
  };
}

const SKIN_STORAGE_KEY = 'candle_hop_skin';
const MODE_STORAGE_KEY = 'candle_hop_mode';
const TIME_ATTACK_DURATION_MS = 60_000;
const BOSS_DURATION_MS = 3000;
const BOSS_SPEED_MULT = 1.4;
const SURVIVAL_GAP_SHRINK_PER_SCORE = 1.5; // px par point

export function CandleHopGame({
  bestScore,
  bestByMode,
  runsLeftToday,
  xpRoomToday,
  xpTotal,
  skins,
  powerUps,
  modes,
}: Props) {
  const router = useRouter();
  const haptic = useHaptic();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<GameState>(makeInitialState('endless'));
  const lastTimeRef = useRef<number>(0);
  const animRef = useRef<number>(0);
  const submittedRef = useRef(false);
  const skinRef = useRef<Skin>(skins[0]!);
  const modeRef = useRef<Mode>('endless');
  const [, setTick] = useState(0);
  const [phase, setPhase] = useState<'idle' | 'playing' | 'dead'>('idle');
  const [score, setScore] = useState(0);
  const [activeSkinId, setActiveSkinId] = useState<string>(skins[0]?.id ?? 'classic');
  const [selectedMode, setSelectedMode] = useState<Mode>('endless');
  const [submitResult, setSubmitResult] = useState<
    | null
    | {
        xpAwarded: number;
        bonusXp: number;
        newTotal: number;
        isPersonalBest: boolean;
        runsLeftToday: number;
        challengeCompleted: { label: string; bonusXp: number } | null;
        newAchievements: Array<{ label: string; bonusXp: number }>;
      }
  >(null);
  const [pending, start] = useTransition();

  const unlockedSkins = skins.filter((s) => xpTotal >= s.unlockXp);

  // Load skin from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(SKIN_STORAGE_KEY);
    if (stored) {
      const found = skins.find((s) => s.id === stored);
      if (found && xpTotal >= found.unlockXp) {
        setActiveSkinId(found.id);
        skinRef.current = found;
      }
    }
    const storedMode = localStorage.getItem(MODE_STORAGE_KEY) as Mode | null;
    if (storedMode && (modes.some((m) => m.id === storedMode))) {
      setSelectedMode(storedMode);
      modeRef.current = storedMode;
      gameRef.current.mode = storedMode;
    }
  }, [skins, xpTotal, modes]);

  function selectSkin(skin: Skin) {
    if (xpTotal < skin.unlockXp) return;
    setActiveSkinId(skin.id);
    skinRef.current = skin;
    localStorage.setItem(SKIN_STORAGE_KEY, skin.id);
    haptic.selection();
  }

  function selectMode(mode: Mode) {
    setSelectedMode(mode);
    modeRef.current = mode;
    gameRef.current = makeInitialState(mode);
    localStorage.setItem(MODE_STORAGE_KEY, mode);
    haptic.selection();
  }

  // ============ Game logic ============
  const spawnObstacles = useCallback(
    (g: GameState) => {
      while (
        g.obstacles.length === 0 ||
        g.obstacles[g.obstacles.length - 1]!.x < W + OBSTACLE_SPACING
      ) {
        const lastX = g.obstacles[g.obstacles.length - 1]?.x ?? W;
        const newX = lastX + OBSTACLE_SPACING;
        // Mode Survival : le gap rétrécit avec le score
        let effectiveGapMax = GAP_MAX;
        let effectiveGapMin = GAP_MIN;
        if (g.mode === 'survival') {
          const shrink = Math.min(80, g.score * SURVIVAL_GAP_SHRINK_PER_SCORE);
          effectiveGapMax = Math.max(GAP_MIN + 10, GAP_MAX - shrink);
          effectiveGapMin = Math.max(GAP_MIN - 30, GAP_MIN - shrink * 0.3);
        }
        const gapH =
          effectiveGapMin + Math.random() * (effectiveGapMax - effectiveGapMin);
        const margin = 80;
        const gapY = margin + Math.random() * (H - 2 * margin - gapH);
        g.obstacles.push({ x: newX, gapY, gapH, passed: false });
        if (Math.random() < 0.4) {
          g.bonuses.push({
            x: newX + OBSTACLE_W / 2,
            y: gapY + gapH / 2,
            collected: false,
          });
        }
        if (Math.random() < POWERUP_SPAWN_CHANCE && powerUps.length > 0) {
          const def = powerUps[Math.floor(Math.random() * powerUps.length)]!;
          g.powerUpsOnField.push({
            x: newX + OBSTACLE_W / 2,
            y: gapY + gapH / 2 + (Math.random() - 0.5) * 30,
            defId: def.id,
            color: def.color,
            collected: false,
          });
        }
      }
    },
    [powerUps]
  );

  const reset = useCallback(() => {
    gameRef.current = makeInitialState(modeRef.current);
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
    if (g.mode === 'time_attack') {
      g.timeAttackEndsAt = performance.now() + TIME_ATTACK_DURATION_MS;
    }
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
      const bonusesCollected = g.bonusesCollected;
      const powerUpsUsed = g.powerUpsUsed;
      start(async () => {
        const res = await submitCandleHopAction({
          score,
          durationMs,
          taps,
          bonusesCollected,
          powerUpsUsed,
          mode: g.mode,
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
          challengeCompleted: res.data.challengeCompleted,
          newAchievements: res.data.newAchievements,
        });
        if (res.data.isPersonalBest && score > 0) {
          haptic.success();
        }
        if (res.data.challengeCompleted) {
          toast({
            title: '🎯 Défi du jour validé !',
            description: `+${res.data.challengeCompleted.bonusXp} XP`,
          });
        }
        for (const ach of res.data.newAchievements) {
          toast({
            title: `🏆 ${ach.label}`,
            description: `+${ach.bonusXp} XP`,
          });
        }
      });
    },
    [haptic]
  );

  // Keyboard
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.code !== 'Space' && e.code !== 'ArrowUp') return;
      e.preventDefault();
      const g = gameRef.current;
      if (g.phase === 'idle') startGame();
      else if (g.phase === 'playing') jump();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [startGame, jump]);

  // Main loop
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
      const g = gameRef.current;

      // Background
      const grad = ctx.createLinearGradient(0, 0, 0, ch);
      grad.addColorStop(0, 'rgba(15, 23, 42, 1)');
      grad.addColorStop(1, 'rgba(30, 41, 59, 1)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, cw, ch);

      // V3 : boss red flash overlay
      const nowDraw = performance.now();
      if (nowDraw < g.bossEndsAt) {
        const pulseAlpha = 0.18 + Math.sin(nowDraw * 0.015) * 0.1;
        ctx.fillStyle = `rgba(239, 68, 68, ${pulseAlpha})`;
        ctx.fillRect(0, 0, cw, ch);
      }

      // Chart grid
      ctx.strokeStyle = 'rgba(99, 102, 241, 0.08)';
      ctx.lineWidth = 1;
      const gridSize = 40 * scaleX;
      const offsetX = -((g.scrollX * scaleX) % gridSize);
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

      // Obstacles
      for (const o of g.obstacles) {
        const x = o.x * scaleX;
        const wPx = OBSTACLE_W * scaleX;
        drawCandle(ctx, x, 0, wPx, o.gapY * scaleY, '#ef4444', '#dc2626');
        const bottomY = (o.gapY + o.gapH) * scaleY;
        drawCandle(ctx, x, bottomY, wPx, ch - bottomY, '#ef4444', '#dc2626');
      }

      // Bonuses
      for (const b of g.bonuses) {
        if (b.collected) continue;
        const x = b.x * scaleX;
        const y = b.y * scaleY;
        const s = BONUS_SIZE * scaleX;
        ctx.fillStyle = 'rgba(16, 185, 129, 0.25)';
        ctx.beginPath();
        ctx.arc(x, y, s * 0.9, 0, Math.PI * 2);
        ctx.fill();
        drawCandle(ctx, x - s / 2, y - s / 2, s, s, '#10b981', '#059669');
      }

      // Power-ups on field
      for (const p of g.powerUpsOnField) {
        if (p.collected) continue;
        const x = p.x * scaleX;
        const y = p.y * scaleY;
        const s = POWERUP_SIZE * scaleX;
        // Pulsing glow
        const pulse = 0.5 + Math.sin(performance.now() * 0.005) * 0.3;
        ctx.fillStyle = hexToRgba(p.color, 0.4 * pulse);
        ctx.beginPath();
        ctx.arc(x, y, s * 0.9, 0, Math.PI * 2);
        ctx.fill();
        // Star shape
        drawStar(ctx, x, y, s / 2, p.color);
      }

      // Player
      const px = PLAYER_X * scaleX;
      const py = g.player.y * scaleY;
      const ps = PLAYER_SIZE * scaleX;
      const skin = skinRef.current;
      const invincible = g.activePowerUps.some((p) => p.id === 'bull_run');
      ctx.save();
      ctx.translate(px, py);
      const rot = clamp(g.player.vy / 800, -0.4, 0.7);
      ctx.rotate(rot);
      // Glow
      if (invincible) {
        ctx.shadowColor = '#fbbf24';
        ctx.shadowBlur = 18 * scaleX;
      } else {
        ctx.shadowColor = skin.glow;
        ctx.shadowBlur = 8 * scaleX;
      }
      ctx.fillStyle = skin.fill;
      ctx.fillRect(-1, -ps / 2 - 4, 2, ps + 8); // wick
      ctx.fillRect(-ps / 2, -ps / 2, ps, ps);
      ctx.shadowBlur = 0;
      ctx.strokeStyle = skin.border;
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

      // Clean expired power-ups
      const now = performance.now();
      g.activePowerUps = g.activePowerUps.filter((p) => p.expiresAt > now);

      if (g.phase !== 'playing') {
        for (const p of g.particles) {
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.vy += GRAVITY * 0.6 * dt;
          p.life -= dt * 1.2;
        }
        g.particles = g.particles.filter((p) => p.life > 0);
        return;
      }

      // V3 : Time Attack timer
      if (g.mode === 'time_attack' && now >= g.timeAttackEndsAt) {
        // Fin du temps imparti — soumet le run
        g.phase = 'dead';
        haptic.success();
        setPhase('dead');
        submitRun(g);
        return;
      }

      // V3 : Boss fights (toutes les 50pts, sauf en Time Attack court)
      if (g.mode === 'endless' || g.mode === 'survival') {
        const expectedBosses = Math.floor(g.score / 50);
        if (
          expectedBosses > g.bossesTriggered &&
          now >= g.bossEndsAt
        ) {
          g.bossesTriggered = expectedBosses;
          g.bossEndsAt = now + BOSS_DURATION_MS;
          haptic.impact('heavy');
        }
      }
      const bossActive = now < g.bossEndsAt;

      // Speed multiplier from power-ups + boss
      const slowMo = g.activePowerUps.some((p) => p.id === 'slow_mo');
      let speedMult = 1;
      if (slowMo) speedMult *= 0.5;
      if (bossActive) speedMult *= BOSS_SPEED_MULT;
      const effectiveSpeed = g.speed * speedMult;
      const magnetActive = g.activePowerUps.some((p) => p.id === 'magnet');
      const invincible = g.activePowerUps.some((p) => p.id === 'bull_run');

      g.player.vy += GRAVITY * dt;
      g.player.y += g.player.vy * dt;
      g.scrollX += effectiveSpeed * dt;

      spawnObstacles(g);

      for (const o of g.obstacles) o.x -= effectiveSpeed * dt;
      for (const b of g.bonuses) {
        b.x -= effectiveSpeed * dt;
        if (magnetActive && !b.collected) {
          const dx = PLAYER_X - b.x;
          const dy = g.player.y - b.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < MAGNET_RADIUS) {
            const pull = 200 * dt;
            b.x += (dx / dist) * pull;
            b.y += (dy / dist) * pull;
          }
        }
      }
      for (const p of g.powerUpsOnField) p.x -= effectiveSpeed * dt;
      g.obstacles = g.obstacles.filter((o) => o.x + OBSTACLE_W > 0);
      g.bonuses = g.bonuses.filter((b) => b.x + BONUS_SIZE > -50);
      g.powerUpsOnField = g.powerUpsOnField.filter(
        (p) => p.x + POWERUP_SIZE > 0 && !p.collected
      );

      // Collisions
      const playerLeft = PLAYER_X - PLAYER_SIZE / 2;
      const playerRight = PLAYER_X + PLAYER_SIZE / 2;
      const playerTop = g.player.y - PLAYER_SIZE / 2;
      const playerBottom = g.player.y + PLAYER_SIZE / 2;

      // Bounds (sol/plafond) — invincibilité ne sauve PAS d'une sortie
      if (g.player.y < PLAYER_SIZE / 2 || g.player.y > H - PLAYER_SIZE / 2) {
        killPlayer(g);
        return;
      }

      for (const o of g.obstacles) {
        const oL = o.x;
        const oR = o.x + OBSTACLE_W;
        if (playerRight < oL || playerLeft > oR) continue;
        const inGap = playerTop > o.gapY && playerBottom < o.gapY + o.gapH;
        if (!inGap && !invincible) {
          killPlayer(g);
          return;
        }
        if (!o.passed && PLAYER_X > oR) {
          o.passed = true;
          g.score++;
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
          g.bonusesCollected++;
          haptic.impact('light');
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
      for (const p of g.powerUpsOnField) {
        if (p.collected) continue;
        const dx = (p.x + POWERUP_SIZE / 2) - PLAYER_X;
        const dy = p.y - g.player.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < PLAYER_SIZE / 2 + POWERUP_SIZE / 2) {
          p.collected = true;
          const def = powerUps.find((d) => d.id === p.defId);
          if (def) {
            g.activePowerUps.push({
              id: def.id,
              expiresAt: performance.now() + def.durationMs,
              color: def.color,
              label: def.label,
            });
            g.powerUpsUsed++;
            haptic.impact('medium');
            // Particles starburst
            for (let i = 0; i < 14; i++) {
              const a = Math.random() * Math.PI * 2;
              const spd = 100 + Math.random() * 160;
              g.particles.push({
                x: p.x + POWERUP_SIZE / 2,
                y: p.y,
                vx: Math.cos(a) * spd,
                vy: Math.sin(a) * spd,
                life: 0.9,
                color: p.color,
                size: 3,
              });
            }
          }
        }
      }

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
  }, [haptic, spawnObstacles, submitRun, powerUps]);

  // Re-render ticker
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
  const activePowerUpsSnapshot = gameRef.current.activePowerUps;

  return (
    <div className="space-y-3 max-w-md mx-auto">
      <div
        ref={containerRef}
        onPointerDown={handleTap}
        className="relative overflow-hidden rounded-[var(--radius-lg)] border-2 border-[var(--color-border-strong)] bg-slate-900 cursor-pointer select-none touch-none"
        style={{ aspectRatio: `${W} / ${H}`, maxHeight: '70vh' }}
      >
        <canvas ref={canvasRef} className="absolute inset-0" />

        {/* HUD : score top + active power-ups + mode timer */}
        <div className="absolute top-3 left-0 right-0 pointer-events-none">
          <div className="text-center">
            <div className="inline-block px-4 py-1 rounded-full bg-black/40 backdrop-blur-sm border border-white/10">
              <span className="font-serif text-2xl text-amber-300 drop-shadow">
                {score}
              </span>
            </div>
            {phase === 'playing' && gameRef.current.mode === 'time_attack' && (
              <TimeAttackCountdown endsAt={gameRef.current.timeAttackEndsAt} />
            )}
          </div>
          {bestScore > 0 && (
            <div className="absolute top-1 right-3 text-[10px] uppercase tracking-wider text-white/50 font-mono">
              Best {bestScore}
            </div>
          )}
          {activePowerUpsSnapshot.length > 0 && (
            <div className="absolute top-1 left-3 flex flex-col gap-1">
              {activePowerUpsSnapshot.map((p, i) => (
                <div
                  key={i}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider font-semibold backdrop-blur-sm border"
                  style={{
                    backgroundColor: `${p.color}30`,
                    borderColor: `${p.color}80`,
                    color: p.color,
                  }}
                >
                  <Sparkles className="h-2.5 w-2.5" />
                  {p.label}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Idle overlay : mode + skin + start */}
        {phase === 'idle' && (
          <div className="absolute inset-0 flex flex-col items-center justify-between text-center bg-black/40 backdrop-blur-[2px] py-5 px-4 gap-3">
            <div className="space-y-2">
              <Bird className="h-10 w-10 text-amber-300 mx-auto drop-shadow animate-pulse" />
              <h3 className="font-serif text-xl text-white">
                Tap pour décoller
              </h3>
              <div className="inline-flex items-center gap-1.5 text-[10px] text-white/60">
                <Sparkles className="h-3 w-3" />
                {runsLeftToday} runs ·{' '}
                {xpRoomToday > 0 ? `${xpRoomToday} XP dispo` : 'cap atteint'}
              </div>
            </div>

            {/* Mode selector V3 */}
            <div className="w-full space-y-1.5">
              <div className="text-[9px] uppercase tracking-wider text-white/50 font-mono">
                Mode · best{' '}
                <span className="text-amber-300">
                  {bestByMode[selectedMode] ?? 0}
                </span>
              </div>
              <div className="flex gap-1.5 justify-center">
                {modes.map((m) => {
                  const active = selectedMode === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        selectMode(m.id);
                      }}
                      title={m.description}
                      className={cn(
                        'flex-1 px-2 py-1.5 rounded-md text-[11px] font-medium border transition-all',
                        active
                          ? 'bg-gradient-to-r from-indigo-500/80 to-purple-500/80 border-amber-300 text-white shadow-md'
                          : 'bg-black/30 border-white/15 text-white/70 hover:border-white/40'
                      )}
                    >
                      {m.label}
                    </button>
                  );
                })}
              </div>
              <p className="text-[10px] text-white/50 italic">
                {modes.find((m) => m.id === selectedMode)?.description}
              </p>
            </div>

            {/* Skin selector */}
            <div className="w-full space-y-1.5">
              <div className="text-[9px] uppercase tracking-wider text-white/50 font-mono">
                Skin · {unlockedSkins.length}/{skins.length}
              </div>
              <div className="flex justify-center gap-1.5 flex-wrap">
                {skins.map((s) => {
                  const unlocked = xpTotal >= s.unlockXp;
                  const active = activeSkinId === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (unlocked) selectSkin(s);
                      }}
                      disabled={!unlocked}
                      title={
                        unlocked
                          ? s.description
                          : `Débloque à ${s.unlockXp} XP`
                      }
                      className={cn(
                        'h-8 w-8 rounded-md border-2 flex items-center justify-center transition-all relative',
                        active
                          ? 'scale-110 border-amber-300 shadow-lg'
                          : 'border-white/20 hover:border-white/50',
                        !unlocked && 'opacity-50 cursor-not-allowed'
                      )}
                      style={{
                        backgroundColor: unlocked ? s.fill : '#3f3f46',
                      }}
                    >
                      {!unlocked && <Lock className="h-3 w-3 text-white/70" />}
                    </button>
                  );
                })}
              </div>
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
                          (dont +{submitResult.bonusXp} record)
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-white/60">Cap XP du jour atteint</span>
                  )}
                </div>
                {submitResult.challengeCompleted && (
                  <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/20 border border-emerald-500/40 px-3 py-1 text-xs text-emerald-200">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Défi validé · +{submitResult.challengeCompleted.bonusXp} XP
                  </div>
                )}
                {submitResult.newAchievements.length > 0 && (
                  <div className="space-y-1">
                    {submitResult.newAchievements.map((a, i) => (
                      <div
                        key={i}
                        className="inline-flex items-center gap-2 rounded-full bg-amber-500/15 border border-amber-500/30 px-3 py-1 text-xs text-amber-200"
                      >
                        <Award className="h-3.5 w-3.5" />
                        {a.label} · +{a.bonusXp} XP
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex flex-col gap-2 mt-2 w-full max-w-xs">
                  <div className="flex gap-2">
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
                  {score > 0 && (
                    <ShareScoreButton
                      score={score}
                      mode={gameRef.current.mode}
                    />
                  )}
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
          Tap dans la zone pour sauter · choppe les étoiles pour des bonus
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
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
  const grad = ctx.createLinearGradient(x, y, x + w, y);
  grad.addColorStop(0, 'rgba(0,0,0,0.15)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0.1)');
  grad.addColorStop(1, 'rgba(0,0,0,0.15)');
  ctx.fillStyle = grad;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = border;
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
}

function drawStar(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  color: string
) {
  const spikes = 5;
  const inner = r * 0.45;
  ctx.beginPath();
  let rot = -Math.PI / 2;
  const step = Math.PI / spikes;
  ctx.moveTo(cx + Math.cos(rot) * r, cy + Math.sin(rot) * r);
  for (let i = 0; i < spikes; i++) {
    rot += step;
    ctx.lineTo(cx + Math.cos(rot) * inner, cy + Math.sin(rot) * inner);
    rot += step;
    ctx.lineTo(cx + Math.cos(rot) * r, cy + Math.sin(rot) * r);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 8;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function hexToRgba(hex: string, alpha: number): string {
  const m = hex.replace('#', '');
  const r = parseInt(m.slice(0, 2), 16);
  const g = parseInt(m.slice(2, 4), 16);
  const b = parseInt(m.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function TimeAttackCountdown({ endsAt }: { endsAt: number }) {
  const [remaining, setRemaining] = useState(
    Math.max(0, Math.ceil((endsAt - performance.now()) / 1000))
  );
  useEffect(() => {
    const tick = () => {
      const r = Math.max(0, Math.ceil((endsAt - performance.now()) / 1000));
      setRemaining(r);
    };
    const id = setInterval(tick, 200);
    return () => clearInterval(id);
  }, [endsAt]);
  const critical = remaining <= 10;
  return (
    <div
      className={cn(
        'mt-1 inline-block px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider backdrop-blur-sm border',
        critical
          ? 'bg-rose-500/30 border-rose-500/60 text-rose-100 animate-pulse'
          : 'bg-black/30 border-white/15 text-white/80'
      )}
    >
      ⏱ {remaining}s
    </div>
  );
}

function ShareScoreButton({
  score,
  mode,
}: {
  score: number;
  mode: 'endless' | 'time_attack' | 'survival';
}) {
  const haptic = useHaptic();
  function share() {
    haptic.impact('light');
    const modeLabel =
      mode === 'time_attack'
        ? 'Time Attack'
        : mode === 'survival'
          ? 'Survival'
          : 'Endless';
    const text = `🐦 J'ai fait ${score} pts en mode ${modeLabel} sur Candle Hop. Tente de me battre :`;
    // Construit l'URL de partage native Telegram
    const url = 'https://t.me/boursikotonsbot?startapp=hop';
    const tgUrl = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
    try {
      const w = window as unknown as {
        Telegram?: { WebApp?: { openTelegramLink?: (url: string) => void } };
      };
      if (w.Telegram?.WebApp?.openTelegramLink) {
        w.Telegram.WebApp.openTelegramLink(tgUrl);
        return;
      }
    } catch {
      /* fallback below */
    }
    window.open(tgUrl, '_blank');
  }
  return (
    <Button
      type="button"
      variant="ghost"
      onClick={(e) => {
        e.stopPropagation();
        share();
      }}
      className="w-full bg-white/10 hover:bg-white/15 text-white"
    >
      <Sparkles className="h-4 w-4 mr-2 text-amber-300" />
      Partager mon score
    </Button>
  );
}
