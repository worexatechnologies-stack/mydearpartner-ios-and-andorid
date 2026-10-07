import { computeCompatibilityScore } from '../src/utils/compatibility';
import { Profile } from '../src/types/models';
test('unknown compatibility stays unknown and valid low scores are not inflated', () => {
  expect(computeCompatibilityScore()).toBeNull();
  expect(computeCompatibilityScore({ id: 'p', isVerified: true } as Profile)).toBeNull();
  expect(computeCompatibilityScore({ compatibilityScore: 20 } as Profile)).toBe(20);
  expect(computeCompatibilityScore({ compatibilityScore: 0 } as Profile)).toBe(0);
  expect(computeCompatibilityScore({ compatibilityScore: NaN } as Profile)).toBeNull();
});
