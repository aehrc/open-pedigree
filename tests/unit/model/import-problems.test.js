import { describe, it, expect } from 'vitest';
import PedigreeImport from 'pedigree/model/import';
import { ImportProblems } from 'pedigree/model/importProblems';

// What an import throws, caught (undefined if it doesn't).
const failure = (importIt) => {
  try {
    importIt();
  } catch (err) {
    return err;
  }
  return undefined;
};
// Its problems, however many.
const problemsOf = (err) => (err instanceof ImportProblems ? err.problems : [err]);

const ped = (text) => () => PedigreeImport.initFromPED(text, false, false, true);
const dada2 = (text) => () => PedigreeImport.initFromDADA2(text);
// A BOADICEA row: family, name, proband, ID, father, mother, sex, and zeros to 24 columns.
const boaRow = (id, father, mother, sex) => ['fam', 'n' + id, '0', id, father, mother, sex].concat(Array(17).fill('0')).join(' ');
const boadicea = (rows) => () => PedigreeImport.initFromBOADICEA(
  ['BOADICEA import pedigree file format 2.0', 'FamID Name Target IndivID FathID MothID Sex ...'].concat(rows).join('\n'), true);
const gedcom = (lines) => () => PedigreeImport.initFromGEDCOM(['0 HEAD', '1 CHAR UTF-8'].concat(lines, ['0 TRLR']).join('\n'), false, true);

const FAMILY = ['fam 1 0 0 1 1', 'fam 2 0 0 2 1', 'fam 3 1 2 1 1'];

describe.each([['PED', ped], ['DADA2', dada2]])('%s import problems', (format, importer) => {
  it('reports every short row and duplicate ID, in order', () => {
    const err = failure(importer([...FAMILY, 'fam 4 1', 'fam 3 1 2 2 1', 'fam 5 1'].join('\n')));
    expect(problemsOf(err)).toEqual([
      'Input line has not enough columns: [fam 4 1]',
      'Multiple persons with the same ID [3]',
      'Input line has not enough columns: [fam 5 1]',
    ]);
    expect(String(err)).toMatch(/^Unable to import pedigree: 3 problems found:\n1\. /);
  });

  it('reports every parent of the wrong sex, by the IDs in the file', () => {
    const err = failure(importer([...FAMILY, 'fam 4 2 1 1 1', 'fam 5 0 1 2 1'].join('\n')));
    expect(problemsOf(err)).toEqual([
      'Unable to import pedigree: a person declared as female [id: 2] is also declared as being a father for [id: 4]',
      'Unable to import pedigree: a person declared as male [id: 1] is also declared as being a mother for [id: 4]',
      'Unable to import pedigree: a person declared as male [id: 1] is also declared as being a mother for [id: 5]',
    ]);
  });

  it('reports an unknown parent ID, instead of failing on it', () => {
    const err = failure(importer([...FAMILY, 'fam 4 9 2 1 1', 'fam 5 1 8 1 1'].join('\n')));
    expect(problemsOf(err)).toEqual([
      'Unable to import pedigree: [9] is not a valid father reference for [id: 4] (no person has that ID)',
      'Unable to import pedigree: [8] is not a valid mother reference for [id: 5] (no person has that ID)',
    ]);
  });

  it('defines no one from a short row, so a full row with its ID is not a duplicate', () => {
    expect(failure(importer([...FAMILY, 'fam 4 1', 'fam 4 0 0 1 1'].join('\n')))).toBe('Input line has not enough columns: [fam 4 1]');
  });

  it('reports the rows only, not the links to a person set aside', () => {
    // 4's row is short; 5 names 4 as father
    const err = failure(importer([...FAMILY, 'fam 4 0', 'fam 5 4 2 1 1'].join('\n')));
    expect(err).toBe('Input line has not enough columns: [fam 4 0]');
  });

  it('stops at once, with that alone, at a second family', () => {
    expect(failure(importer([...FAMILY, 'fam 4 1', 'other 9 0 0 1 1'].join('\n'))))
      .toBe('Unsupported feature: multiple families detected within the same pedigree');
  });

  it('reports no data as such, even when every line is a comment', () => {
    expect(failure(importer(''))).toBe('Unable to import: no data');
    expect(failure(importer('# just a comment'))).toBe('Unable to import: no data');
  });

  it('checks the pedigree only once the rows are sound', () => {
    expect(problemsOf(failure(importer([...FAMILY, 'fam 4 0 0 1 1', 'fam 5 0 0 2 1', 'fam 6 4 5 1 1'].join('\n')))))
      .toEqual([expect.stringMatching(/^Unsupported pedigree: .*disconnected/)]);
  });

  it('imports a sound file as before', () => {
    expect(failure(importer(FAMILY.join('\n')))).toBeUndefined();
  });
});

describe('PED phenotype codes', () => {
  it('reports codes other than 0 or 1 once, with the other problems', () => {
    const text = ['fam 1 0 0 1 2', 'fam 2 0 0 2 2', 'fam 3 1 2 1 1', 'fam 4 1'].join('\n');
    const err = failure(() => PedigreeImport.initFromPED(text, false, false, true, true));
    expect(problemsOf(err)).toEqual(['Input line has not enough columns: [fam 4 1]', 'Phenotypes with codes other than 0 or 1 were found']);
  });
});

describe('BOADICEA import problems', () => {
  const family = [boaRow('1', '0', '0', 'M'), boaRow('2', '0', '0', 'F'), boaRow('3', '1', '2', 'M')];

  it('reports every short row and duplicate ID', () => {
    const err = failure(boadicea([...family, 'fam n4 0 4', boaRow('3', '1', '2', 'F')]));
    expect(problemsOf(err)).toEqual(['Input line has not enough columns: [fam n4 0 4]', 'Multiple persons with the same ID [3]']);
  });

  it('reports every parent of the wrong sex or unknown, by the IDs in the file', () => {
    const err = failure(boadicea([...family, boaRow('4', '2', '1', 'M'), boaRow('5', '9', '2', 'F')]));
    expect(problemsOf(err)).toEqual([
      'Unable to import pedigree: a person declared as female [id: 2] is also declared as being a father for [id: 4]',
      'Unable to import pedigree: a person declared as male [id: 1] is also declared as being a mother for [id: 4]',
      'Unable to import pedigree: [9] is not a valid father reference for [id: 5] (no person has that ID)',
    ]);
  });

  it('imports a sound file as before', () => {
    expect(failure(boadicea(family))).toBeUndefined();
  });
});

describe('GEDCOM import problems', () => {
  const people = [
    '0 @I1@ INDI', '1 SEX M',
    '0 @I2@ INDI', '1 SEX F',
    '0 @I3@ INDI', '1 SEX F'];

  it('reports every individual sharing an ID', () => {
    const err = failure(gedcom([...people, '0 @I1@ INDI', '1 SEX F', '0 @I2@ INDI', '1 SEX M']));
    expect(problemsOf(err)).toEqual(['Multiple persons with the same ID [@I1@]', 'Multiple persons with the same ID [@I2@]']);
  });

  it('reports every bad husband, wife and child link in every family', () => {
    const err = failure(gedcom([...people,
      '0 @F1@ FAM', '1 HUSB @I2@', '1 WIFE @I1@', '1 CHIL @I3@',
      '0 @F2@ FAM', '1 HUSB @I9@', '1 WIFE @I2@', '1 CHIL @I8@']));
    expect(problemsOf(err)).toEqual([
      'Unable to import pedigree: a person declared as female is also declared as being a father (@I2@)',
      'Unable to import pedigree: a person declared as male is also declared as being a mother (@I1@)',
      'Unable to import pedigree: [@I9@] is not a valid father reference (no individual has that ID)',
      'Unable to import pedigree: child link does not point to an existing individual: [@I8@]',
    ]);
  });

  it('notes an unsupported version, without failing', () => {
    const graph = gedcom(['1 GEDC', '2 VERS 7.0', ...people, '0 @F1@ FAM', '1 HUSB @I1@', '1 WIFE @I2@', '1 CHIL @I3@'])();
    expect(graph.importNotes).toEqual([expect.stringMatching(/^Unsupported GEDCOM version detected: \[7\.0\]/)]);
  });

  it('imports a sound file as before, without notes', () => {
    const graph = gedcom([...people, '0 @F1@ FAM', '1 HUSB @I1@', '1 WIFE @I2@', '1 CHIL @I3@'])();
    expect(graph.importNotes).toBeUndefined();
  });
});
