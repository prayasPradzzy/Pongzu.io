import { useEffect, useRef } from 'react';
import { audioManager } from '../../../game/systems/AudioManager';

// A top-down table tennis court where the player's face rallies between two
// paddles. It plays one short rally on load, then waits for a tap to serve.

const HITS_PER_RALLY = 5;
const SPEED = 0.62; // court widths per second
const SETTLE_FRICTION = 1.6; // per second, once the rally is over

type Props = {
  faceUrl: string | null;
  /** Play the opening rally without a tap. Off when the player asked for less motion. */
  autoServe: boolean;
};

export function CourtRally({ faceUrl, autoServe }: Props) {
  const courtRef = useRef<HTMLButtonElement>(null);
  const ballRef = useRef<HTMLDivElement>(null);
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const serveRef = useRef<() => void>(() => {});

  useEffect(() => {
    const court = courtRef.current;
    const ball = ballRef.current;
    const left = leftRef.current;
    const right = rightRef.current;
    if (!court || !ball || !left || !right) return;

    // Positions are in court units: x and y run 0..1 across the court.
    const state = {
      x: 0.5,
      y: 0.5,
      vx: 0,
      vy: 0,
      spin: 0,
      leftY: 0.5,
      rightY: 0.5,
      hits: 0,
      live: false,
    };
    let width = court.clientWidth;
    let height = court.clientHeight;
    let frame = 0;
    let last = 0;

    const ballRadius = () => ball.offsetWidth / 2;
    // Where the ball turns around: the face of each paddle.
    const reach = () => {
      const r = ballRadius();
      return {
        min: (left.offsetLeft + left.offsetWidth + r) / width,
        max: (right.offsetLeft - r) / width,
      };
    };

    const draw = () => {
      const r = ballRadius();
      ball.style.transform = `translate(${state.x * width - r}px, ${state.y * height - r}px) rotate(${state.spin}deg)`;
      const ph = left.offsetHeight / 2;
      left.style.transform = `translateY(${state.leftY * height - ph}px)`;
      right.style.transform = `translateY(${state.rightY * height - ph}px)`;
    };

    const resize = new ResizeObserver(() => {
      width = court.clientWidth;
      height = court.clientHeight;
      draw();
    });
    resize.observe(court);

    function step(now: number) {
      const dt = Math.min(0.05, (now - last) / 1000 || 0);
      last = now;
      const r = ballRadius();
      const yMin = r / height;
      const yMax = 1 - r / height;
      const { min, max } = reach();

      state.x += state.vx * dt;
      state.y += (state.vy * dt * width) / height;
      state.spin += state.vx * dt * 540;

      if (state.y < yMin || state.y > yMax) {
        state.y = Math.min(yMax, Math.max(yMin, state.y));
        state.vy = -state.vy;
      }

      const hitLeft = state.x < min && state.vx < 0;
      const hitRight = state.x > max && state.vx > 0;
      if (hitLeft || hitRight) {
        state.x = hitLeft ? min : max;
        state.vx = -state.vx;
        if (state.live) {
          state.hits += 1;
          // Angle off the paddle like a real return.
          state.vy = (Math.random() - 0.5) * SPEED * 0.9;
          if (state.hits >= HITS_PER_RALLY) state.live = false;
          audioManager.playPaddleHit(0.18, state.hits);
        }
      }

      if (!state.live) {
        const keep = Math.exp(-SETTLE_FRICTION * dt);
        state.vx *= keep;
        state.vy *= keep;
      }

      // Paddles chase the ball while it is in play and drift home after.
      const ease = 1 - Math.exp(-(state.live ? 7 : 2.5) * dt);
      const target = state.live ? state.y : 0.5;
      if (state.vx < 0 || !state.live) state.leftY += (target - state.leftY) * ease;
      if (state.vx > 0 || !state.live) state.rightY += (target - state.rightY) * ease;

      draw();

      const resting = !state.live && Math.hypot(state.vx, state.vy) < 0.01;
      frame = resting ? 0 : requestAnimationFrame(step);
    }

    serveRef.current = () => {
      state.hits = 0;
      state.live = true;
      const dir = state.x > 0.5 ? -1 : 1;
      state.vx = SPEED * dir;
      state.vy = (Math.random() - 0.5) * SPEED * 0.8;
      if (!frame) {
        last = performance.now();
        frame = requestAnimationFrame(step);
      }
    };

    draw();
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const opener = reduceMotion || !autoServe ? 0 : window.setTimeout(() => serveRef.current(), 350);

    return () => {
      window.clearTimeout(opener);
      cancelAnimationFrame(frame);
      resize.disconnect();
    };
  }, [autoServe]);

  return (
    <button
      ref={courtRef}
      type="button"
      className="court"
      onClick={() => serveRef.current()}
      aria-label="Serve the ball"
    >
      <span className="court__centre-line" aria-hidden="true" />
      <span className="court__net" aria-hidden="true" />
      <div ref={leftRef} className="court__paddle court__paddle--red" aria-hidden="true" />
      <div ref={rightRef} className="court__paddle court__paddle--black" aria-hidden="true" />
      <div ref={ballRef} className={`court__ball${faceUrl ? '' : ' court__ball--empty'}`} aria-hidden="true">
        {faceUrl && <img src={faceUrl} alt="" draggable={false} />}
      </div>
    </button>
  );
}
