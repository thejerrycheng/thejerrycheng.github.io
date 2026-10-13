// Display forces are always newtons at the handle, never kinematic solver reactions.
export const MAX_FORCE_N = 150;
export const METRES_PER_NEWTON = .01;
export const boundedForce = n => Number.isFinite(n) ? Math.min(MAX_FORCE_N, Math.max(0, Math.abs(n))) : 0;
export const forceText = n => `${Math.abs(n) >= MAX_FORCE_N ? '≥' : ''}${Number(boundedForce(n).toPrecision(2))} N`;
export const lowPass = (previous, value, dt) => (previous ?? 0) + (boundedForce(value) - (previous ?? 0)) * (1 - Math.exp(-Math.max(0, dt) / .15));
export function staticForce(j, position, latched = true) {
  const displacement = Math.abs(position - (j.springref || 0));
  const lever = j.type === 'prismatic' ? 1 : Math.max(j.lever, .001);
  const profile = j.force_profile;
  if (profile && (!profile.near_rest || displacement < profile.near_rest) && (!profile.latched_only || latched)) {
    return {value: boundedForce(profile.force_N), label: profile.label, source: profile.source};
  }
  const latch = latched && displacement < (j.latch_range || .02) ? (j.latch_force_N || 0) : 0;
  return {value: boundedForce((Math.abs(j.stiffness || 0) * displacement + Math.abs(j.friction || 0)) / lever + latch), label: 'Static model', source: 'Joint stiffness × displacement + frictionloss + latch force, at handle'};
}
