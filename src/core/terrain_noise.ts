function mulberry32(seed: number) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash2(x: number, y: number, salt: number): number {
  let h = x * 374761393 + y * 668265263 + salt * 1274126177;
  h = (h ^ (h >>> 13)) * 1103515245;
  h = h ^ (h >>> 16);
  return (h >>> 0) / 4294967295;
}

function smoothNoise(x: number, y: number, salt: number): number {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const n00 = hash2(ix, iy, salt), n10 = hash2(ix + 1, iy, salt);
  const n01 = hash2(ix, iy + 1, salt), n11 = hash2(ix + 1, iy + 1, salt);
  const nx0 = n00 + (n10 - n00) * sx;
  const nx1 = n01 + (n11 - n01) * sx;
  return nx0 + (nx1 - nx0) * sy;
}

function fractalNoise(x: number, y: number, seed: number): number {
  let val = 0, amp = 0.5, freq = 1, tot = 0;
  for (let o = 0; o < 4; o++) {
    val += smoothNoise(x * freq, y * freq, seed + o * 1000) * amp;
    tot += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return val / tot;
}

const BIOME_PALETTE: Record<string, string> = {
  sea: "#1a3a5c", lake: "#2a5a8a",
  plain: "#6b8f4a", grassland: "#7ba85a",
  forest: "#3d6b2a", jungle: "#2a5b1a",
  hill: "#8a8a6a", mountain: "#7a7a6a",
  desert: "#c4a868", swamp: "#4a5b3a",
  tundra: "#a0b8c0",
};

function pickBiomeColors(region: any): string[] {
  const w = region?.terrain?.weights || { plain: 1 };
  const sorted = Object.entries(w).sort((a, b) => (b[1] as number) - (a[1] as number));
  return sorted.slice(0, 3).map(([k]) => BIOME_PALETTE[k] || BIOME_PALETTE.plain);
}

export interface TerrainLayer {
  canvas: HTMLCanvasElement;
  worldX: number;
  worldY: number;
  worldW: number;
  worldH: number;
}

export function generateTerrainCanvas(region: any, seed: number, cellPx = 8): TerrainLayer {
  const colors = pickBiomeColors(region);
  const minX = 0, minY = 0, maxX = 100, maxY = 100;
  const W = Math.ceil((maxX - minX) / 1 * cellPx);
  const H = Math.ceil((maxY - minY) / 1 * cellPx);
  const cvs = document.createElement("canvas");
  cvs.width = W; cvs.height = H;
  const ctx = cvs.getContext("2d")!;
  const rand = mulberry32(seed);

  const cols = W / cellPx, rows = H / cellPx;
  for (let py = 0; py < rows; py++) {
    for (let px = 0; px < cols; px++) {
      const wx = minX + px * (W / cols);
      const wy = minY + py * (H / rows);
      const n1 = fractalNoise(wx * 0.04, wy * 0.04, seed);
      const n2 = fractalNoise(wx * 0.08 + 50, wy * 0.08 + 50, seed + 7);
      const elev = n1 * 0.7 + n2 * 0.3;
      const moist = fractalNoise(wx * 0.05 + 200, wy * 0.05 + 200, seed + 13);
      let biome = "plain";
      if (elev < 0.25) biome = "sea";
      else if (elev < 0.32) biome = "lake";
      else if (elev > 0.72) biome = "mountain";
      else if (elev > 0.62) biome = "hill";
      else if (moist > 0.65) biome = elev > 0.5 ? "forest" : "grassland";
      else if (moist < 0.25) biome = "desert";
      else if (elev < 0.35) biome = "swamp";
      else biome = "plain";
      const w = region?.terrain?.weights || {};
      if (w[biome] === undefined && Object.keys(w).length > 0) {
        const top = Object.entries(w).sort((a, b) => (b[1] as number) - (a[1] as number))[0][0];
        biome = top;
      }
      const col = BIOME_PALETTE[biome] || colors[0] || "#6b8f4a";
      const jitter = Math.floor(rand() * 20 - 10);
      const r = parseInt(col.slice(1, 3), 16) + jitter;
      const g = parseInt(col.slice(3, 5), 16) + jitter;
      const b = parseInt(col.slice(5, 7), 16) + jitter;
      ctx.fillStyle = `rgb(${Math.max(0, Math.min(255, r))},${Math.max(0, Math.min(255, g))},${Math.max(0, Math.min(255, b))})`;
      ctx.fillRect(px * cellPx, py * cellPx, cellPx, cellPx);
    }
  }

  if (region?.terrain?.rivers?.length) {
    for (const r of region.terrain.rivers) {
      const mx = (r.x1 + r.x2) / 2 + (r.y2 - r.y1) * 0.1;
      const my = (r.y1 + r.y2) / 2 - (r.x2 - r.x1) * 0.1;
      ctx.strokeStyle = "#3a6ba8";
      ctx.lineWidth = 3;
      ctx.globalAlpha = 0.7;
      ctx.beginPath();
      ctx.moveTo(r.x1 * cellPx, r.y1 * cellPx);
      ctx.quadraticCurveTo(mx * cellPx, my * cellPx, r.x2 * cellPx, r.y2 * cellPx);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.font = "9px sans-serif";
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.fillText(r.name || "", (r.x1 + r.x2) / 2 * cellPx, (r.y1 + r.y2) / 2 * cellPx - 4);
    }
  }

  return { canvas: cvs, worldX: minX, worldY: minY, worldW: maxX - minX, worldH: maxY - minY };
}
