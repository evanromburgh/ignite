export type PricingSettings = {
  bondRate: number
  ratesBase: number
  ratesMultiplier: number
  levyPerSqm: number
  shortTermMultiplier: number
  longTermMultiplier: number
}

export type MonthlyCosts = {
  bond: number
  rates: number
  levies: number
  total: number
  shortTerm: number
  longTerm: number
}

export function monthlyCosts(
  unit: { price: number; sizeSqm: number },
  settings: PricingSettings,
): MonthlyCosts {
  const bond = unit.price * settings.bondRate
  const rates = settings.ratesBase + unit.price * settings.ratesMultiplier
  const levies = unit.sizeSqm * settings.levyPerSqm
  const roundedBond = Math.round(bond)
  return {
    bond: roundedBond,
    rates: Math.round(rates),
    levies: Math.round(levies),
    total: Math.round(bond + rates + levies),
    shortTerm: Math.round(bond * settings.shortTermMultiplier),
    longTerm: Math.round(bond * settings.longTermMultiplier),
  }
}

/** Checkout always charges the deposit stored for this development. */
export function reservationChargeCents(depositCents: number): number {
  if (!Number.isInteger(depositCents) || depositCents <= 0) {
    throw new Error('Reservation deposit is not configured')
  }
  return depositCents
}
