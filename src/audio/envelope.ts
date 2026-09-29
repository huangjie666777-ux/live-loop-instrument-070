// ADSR envelope expressed as pure time math (seconds, linear dB-free levels).

export interface EnvelopeParams {
  attack: number;
  decay: number;
  sustain: number; // 0..1
  release: number;
}

export function envelopeLevelAt(
  timeSincePress: number,
  releasedAt: number | null,
  params: EnvelopeParams,
): number {
  const { attack, decay, sustain } = params;
  let levelAtRelease: number;
  if (releasedAt === null) {
    if (timeSincePress < attack) return attack === 0 ? 1 : timeSincePress / attack;
    if (timeSincePress < attack + decay) {
      const t = (timeSincePress - attack) / decay;
      return 1 + (sustain - 1) * t;
    }
    return sustain;
  }
  if (releasedAt < attack) {
    levelAtRelease = attack === 0 ? 1 : releasedAt / attack;
  } else if (releasedAt < attack + decay) {
    const t = (releasedAt - attack) / decay;
    levelAtRelease = 1 + (sustain - 1) * t;
  } else {
    levelAtRelease = sustain;
  }
  if (params.release === 0) return 0;
  const elapsed = timeSincePress - releasedAt;
  if (elapsed <= 0) return levelAtRelease;
  return Math.max(0, levelAtRelease * (1 - elapsed / params.release));
}
