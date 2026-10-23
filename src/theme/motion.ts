/** Shared, restrained motion tokens following MyDearPartner premium aesthetics.
 * Animations never gate network, storage, or navigation actions. */
export const motion = {
  duration: {
    micro: 160,
    standard: 240,
    reveal: 320,
    complex: 380,
    press: 120,
  },
  stagger: 35,
  maxStagger: 140,
  distance: 12,
  distanceLarge: 24,
  spring: {
    damping: 22,
    stiffness: 240,
    mass: 0.8,
    gentle: { damping: 22, stiffness: 240, mass: 0.8 },
    bouncy: { damping: 14, stiffness: 220, mass: 0.9 },
    snappy: { damping: 28, stiffness: 350, mass: 0.7 },
    interactive: { damping: 18, stiffness: 280, mass: 0.8 },
  },
  scale: {
    pressed: 0.96,
    subtlePressed: 0.985,
    activeTab: 1.12,
    celebration: 1.05,
    stamp: 1.08,
  },
} as const;

