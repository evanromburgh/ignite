const NUMBER_RE = /-?\d*\.?\d+(?:e[+-]?\d+)?/gi

function pathPoints(pathD: string): { xs: number[]; ys: number[] } {
  const raw = pathD.match(NUMBER_RE)?.map(Number).filter((n) => !Number.isNaN(n)) ?? []
  const xs: number[] = []
  const ys: number[] = []
  for (let i = 0; i + 1 < raw.length; i += 2) {
    xs.push(raw[i]!)
    ys.push(raw[i + 1]!)
  }
  return { xs, ys }
}

export function approximatePathAnchor(pathD: string): { x: number; y: number } {
  const { xs, ys } = pathPoints(pathD)
  if (xs.length === 0) return { x: 0.5, y: 0.5 }
  return {
    x: (Math.min(...xs) + Math.max(...xs)) / 2,
    y: (Math.min(...ys) + Math.max(...ys)) / 2,
  }
}

export function approximatePathPinAbove(pathD: string, offsetNorm = 0.028): { x: number; y: number } {
  const { xs, ys } = pathPoints(pathD)
  if (xs.length === 0) return { x: 0.5, y: 0.38 }
  return {
    x: (Math.min(...xs) + Math.max(...xs)) / 2,
    y: Math.max(0, Math.min(...ys) - offsetNorm),
  }
}
