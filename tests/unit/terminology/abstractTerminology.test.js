import { describe, it, expect } from 'vitest';
import AbstractTerminology from 'pedigree/terminology/abstractTerminology';

describe('AbstractTerminology IDs', () => {
  const terminology = new AbstractTerminology();
  const roundTrip = (id) => terminology.desanitizeID(terminology.sanitizeID(id));

  it('give back a name with brackets as it was', () => {
    // (a lone ')' used to come back as a space: the pattern only matched ')]')
    expect(roundTrip('Seizure (finding)')).toBe('Seizure (finding)');
    expect(roundTrip('HP:0001250')).toBe('HP:0001250');
    expect(roundTrip('Foo [bar]')).toBe('Foo (bar)');
  });
});
