/**
 * Paper that reads as paper.
 *
 * Flat colour with ruled lines never fools the eye. Real paper shows three things
 * at reading distance, and each is drawn here:
 *   - fibres: thousands of faint, short, slightly curved strands;
 *   - mottling: wood pulp is never one colour, it clouds a little;
 *   - tooth: a fine relief that catches light from one side (svgTooth below, a
 *     real lighting filter over a noise height map, not flat speckle).
 * The fibre and mottle tile is drawn once per skin into a canvas and cached as an
 * image. It is drawn by this code, from a skin's numbers only: skins stay data.
 *
 * The tile wraps at its edges (every stroke near an edge is drawn again on the
 * opposite side), so repeating it across a page shows no seams.
 */

const TILE = 384;

/** Deterministic random numbers, so a skin's paper looks the same on every visit. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const cache = new Map<string, string>();

/**
 * A seamless tile of fibres and mottling for paper of this colour, as a PNG data URL.
 * `grain` 0-1 scales how visible the fibres are. Returns '' where canvas is
 * unavailable (tests, very old browsers); the page then falls back to the SVG tooth.
 */
export function paperTile(color: string, grain: number, dark: boolean): string {
  const id = `${color}|${grain}|${dark}`;
  const hit = cache.get(id);
  if (hit !== undefined) return hit;
  if (typeof document === 'undefined') return '';
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = TILE;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  const rand = rng(20261030);

  // Fibres darken light paper and lighten dark paper; either way they are the paper's own colour, shifted.
  const shade = dark ? '255,250,235' : '70,52,28';
  const wrap = (draw: (dx: number, dy: number) => void) => {
    for (const dx of [-TILE, 0, TILE]) for (const dy of [-TILE, 0, TILE]) draw(dx, dy);
  };

  // Mottling: broad, very faint clouds. Kept faint and many: a few strong ones repeat
  // visibly from tile to tile and read as grey smudges.
  for (let i = 0; i < 40; i++) {
    const x = rand() * TILE;
    const y = rand() * TILE;
    const r = 60 + rand() * 120;
    const a = (0.01 + rand() * 0.016) * (0.5 + grain);
    wrap((dx, dy) => {
      const g = ctx.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, r);
      g.addColorStop(0, `rgba(${shade},${a.toFixed(3)})`);
      g.addColorStop(1, `rgba(${shade},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(x + dx - r, y + dy - r, r * 2, r * 2);
    });
  }

  // Fibres: short curved strands, mostly faint, a few darker.
  const n = Math.round(900 + 2600 * grain);
  ctx.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const x = rand() * TILE;
    const y = rand() * TILE;
    const len = 3 + rand() ** 2 * 22;
    const ang = rand() * Math.PI * 2;
    const bend = (rand() - 0.5) * len * 0.8;
    const a = (rand() < 0.08 ? 0.16 : 0.05) * (0.35 + grain);
    const w = 0.35 + rand() * 0.7;
    const ex = Math.cos(ang) * len;
    const ey = Math.sin(ang) * len;
    wrap((dx, dy) => {
      if (x + dx < -30 || x + dx > TILE + 30 || y + dy < -30 || y + dy > TILE + 30) return;
      ctx.strokeStyle = `rgba(${shade},${a.toFixed(3)})`;
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.moveTo(x + dx, y + dy);
      ctx.quadraticCurveTo(x + dx + ex / 2 - ey * bend * 0.02, y + dy + ey / 2 + ex * bend * 0.02, x + dx + ex, y + dy + ey);
      ctx.stroke();
    });
  }

  // Fine speckle: the pulp's own grain, single pixels.
  const img = ctx.getImageData(0, 0, TILE, TILE);
  const [sr, sg, sb] = shade.split(',').map(Number);
  for (let p = 0; p < img.data.length; p += 4) {
    if (rand() < 0.18) {
      const a = rand() * 0.07 * (0.3 + grain) * 255;
      const o = img.data[p + 3];
      const t = a / 255;
      img.data[p] = img.data[p] * (1 - t) + sr * t;
      img.data[p + 1] = img.data[p + 1] * (1 - t) + sg * t;
      img.data[p + 2] = img.data[p + 2] * (1 - t) + sb * t;
      img.data[p + 3] = Math.min(255, o + a);
    }
  }
  ctx.putImageData(img, 0, 0);

  const url = canvas.toDataURL('image/png');
  cache.set(id, url);
  return url;
}

/**
 * The paper's tooth: noise used as a height map and lit from the upper left, so the
 * surface has relief rather than flat dots. Multiplied over the paper, it shades
 * only where the "bumps" turn away from the light.
 */
export function svgTooth(strength: number): string {
  if (strength <= 0) return 'none';
  const surface = (0.5 + strength * 0.9).toFixed(2);
  // The lit surface becomes shadow only: warm brown whose opacity grows as a bump turns
  // away from the light, and fully transparent on flat paper (lit at 58°, ≈0.85) and
  // highlights. Drawn this way it needs no blend mode. An earlier multiply version was
  // painted as an opaque grey sheet whenever a skin's wear added layers and shifted the
  // blend-mode list out of step with the images.
  // Writing paper's tooth is barely there until light rakes across it; stronger reads as stucco.
  const s = 0.05 + 0.12 * strength;
  const alpha = `${(-2 * s).toFixed(3)} 0 0 0 ${(1.8 * s).toFixed(3)}`;
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='t' x='0' y='0' width='100%' height='100%' color-interpolation-filters='sRGB'><feTurbulence type='fractalNoise' baseFrequency='1.1' numOctaves='3' seed='11' stitchTiles='stitch'/><feDiffuseLighting surfaceScale='${surface}' diffuseConstant='1' lighting-color='#ffffff'><feDistantLight azimuth='225' elevation='58'/></feDiffuseLighting><feColorMatrix values='0 0 0 0 0.30  0 0 0 0 0.22  0 0 0 0 0.12  ${alpha}'/></filter><rect width='100%' height='100%' filter='url(#t)'/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}
