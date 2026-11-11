import { isPlaceholderProperties } from 'pedigree/model/baseGraph';
import { romanize } from 'pedigree/model/helpers';

/**
 * Generation numbers, as a pedigree is numbered on paper: generations I, II, III from the top,
 * and people numbered 1..n from the left within each (II-3). Taken from a laid-out graph (`DG`:
 * its GG, ranks and positions), so an edit can renumber: generations are the ranks that hold real
 * people (so no gaps), and the order is by x-position. A placeholder (the hidden child of a couple
 * with no children) is left out.
 *
 * @return {Object} person ID => {generation, number, label}
 */
export function generationNumbers(DG: any): any {
  const rows: any = {};
  for (let v = 0; v <= DG.GG.getMaxRealVertexId(); v++) {
    if (!DG.GG.isPerson(v) || isPlaceholderProperties(DG.GG.type[v], DG.GG.properties[v])) {
      continue;
    }
    (rows[DG.ranks[v]] = rows[DG.ranks[v]] || []).push(v);
  }
  const result: any = {};
  const ranks = Object.keys(rows).map(Number).sort((a, b) => a - b);
  ranks.forEach((rank, g) => {
    const people = rows[rank].sort((a: any, b: any) => DG.positions[a] - DG.positions[b]);
    people.forEach((v: any, n: number) => {
      result[v] = { 'generation': g + 1, 'number': n + 1, 'label': romanize(g + 1) + '-' + (n + 1) };
    });
  });
  return result;
}
