import { parseQuestionnaire, retiredExtensionsIn, QuestionnaireProblem } from 'pedigree/questionnaire/questionnaireParser';
import { WHOLE_ITEM_PREDICATES, PER_OPTION_PREDICATES } from 'pedigree/questionnaire/graphPredicateEvaluator';
import { PREDICATE_EXTENSION_URL } from 'pedigree/fhirUrls';

/**
 * Every problem open-pedigree would meet in a Questionnaire, before an editor is given it
 * (OpenPedigree.checkQuestionnaire; the website's Try your own form page lists them). Never throws.
 *
 * - `fatal`: the editor wouldn't use the Questionnaire and would fall back to its built-in form:
 *   not a Questionnaire, no items, or extensions under their retired pre-2.0 URLs (one each);
 * - `ignored` / `moved`: what the parser logs as it drops a mapping, item or selection, or moves
 *   an item (the same cases, in document order), then references the editor can't resolve: a
 *   condition on an item that isn't there, a predicate it doesn't know, a linkId used twice.
 *
 * It checks the Questionnaire alone: a warning that depends on how a host configures the editor
 * (e.g. value sets without a terminology server) isn't its to report.
 */
export class QuestionnaireProblems {
  problems: QuestionnaireProblem[];

  constructor(problems: QuestionnaireProblem[]) {
    this.problems = problems;
  }

  /** Whether the editor would refuse the Questionnaire (and use its built-in form instead). */
  isFatal(): boolean {
    return this.problems.some((p) => p.effect === 'fatal');
  }

  /** The problems as a numbered list, one per line ('' for none). */
  toString(): string {
    return this.problems.map((p, i) => (i + 1) + '. ' + p.message).join('\n');
  }
}

const fatal = (message: string): QuestionnaireProblem => ({ message: message, effect: 'fatal' });

// Every item, nested ones included, in document order.
function allItems(items: any, out: any[] = []): any[] {
  (Array.isArray(items) ? items : []).forEach((item) => {
    if (item && typeof item === 'object') {
      out.push(item);
      allItems(item.item, out);
    }
  });
  return out;
}

// The references the editor resolves as it goes, checked against the Questionnaire: conditions on
// items, predicate names, and linkIds used more than once.
function referenceProblems(items: any[]): QuestionnaireProblem[] {
  const problems: QuestionnaireProblem[] = [];
  const linkIds = new Set<string>();
  const reported = new Set<string>();
  items.forEach((item) => {
    if (typeof item.linkId === 'string') {
      if (linkIds.has(item.linkId) && !reported.has(item.linkId)) {
        reported.add(item.linkId);
        problems.push({ linkId: item.linkId, effect: 'ignored', message: 'The linkId ' + item.linkId + ' is used by more than one item: their answers are saved under the same name, and conditions on it can\'t tell them apart.' });
      }
      linkIds.add(item.linkId);
    }
  });
  const known = (table: any) => Object.keys(table).join(', ');
  items.forEach((item) => {
    ['enableWhen', 'disabledWhen'].forEach((list) => {
      (Array.isArray(item[list]) ? item[list] : []).forEach((condition: any) => {
        if (!condition || typeof condition !== 'object') {
          return;
        }
        const predicate = Array.isArray(condition.extension)
          && condition.extension.find((ext: any) => ext && ext.url === PREDICATE_EXTENSION_URL);
        if (predicate && predicate.valueCode) {
          if (!WHOLE_ITEM_PREDICATES[predicate.valueCode]) {
            problems.push({ linkId: item.linkId, effect: 'ignored', message: 'Item ' + item.linkId + ': the ' + list + ' predicate "' + predicate.valueCode + '" is unknown, so it counts as false (true where negated). Known predicates: ' + known(WHOLE_ITEM_PREDICATES) + '.' });
          }
        } else if (typeof condition.question === 'string' && !linkIds.has(condition.question)) {
          problems.push({ linkId: item.linkId, effect: 'ignored', message: 'Item ' + item.linkId + ': an ' + list + ' condition is on "' + condition.question + '", which no item has as its linkId, so it is treated as never answered.' });
        }
      });
    });
    if (item.disablingPredicate && !PER_OPTION_PREDICATES[item.disablingPredicate]) {
      problems.push({ linkId: item.linkId, effect: 'ignored', message: 'Item ' + item.linkId + ': the disablingPredicate "' + item.disablingPredicate + '" is unknown, so no option is disabled. Known per-option predicates: ' + known(PER_OPTION_PREDICATES) + '.' });
    }
  });
  return problems;
}

export function checkQuestionnaire(questionnaire: any): QuestionnaireProblems {
  try {
    if (!questionnaire || typeof questionnaire !== 'object' || Array.isArray(questionnaire)) {
      return new QuestionnaireProblems([fatal('This isn\'t a FHIR resource: a Questionnaire is a JSON object.')]);
    }
    if (questionnaire.resourceType !== 'Questionnaire') {
      return new QuestionnaireProblems([fatal('This is ' + (questionnaire.resourceType ? 'a ' + questionnaire.resourceType : 'not a FHIR resource (it has no resourceType)') + ', not a Questionnaire.')]);
    }
    if (!Array.isArray(questionnaire.item) || questionnaire.item.length === 0) {
      return new QuestionnaireProblems([fatal('The Questionnaire has no items, so there is no form to show.')]);
    }
    const retired = retiredExtensionsIn(questionnaire.item);
    if (retired.length) {
      return new QuestionnaireProblems(retired.map((r) => fatal('It uses ' + r.url + ', which open-pedigree no longer reads: use ' + r.replacement + ' instead.')));
    }
    const problems: QuestionnaireProblem[] = [];
    // (the editor's own parse, collecting what it logs - and logging it, as the editor would)
    parseQuestionnaire(questionnaire, problems);
    return new QuestionnaireProblems(problems.concat(referenceProblems(allItems(questionnaire.item))));
  } catch (err) {
    // (anything the parser can't get through is something the editor couldn't use either)
    return new QuestionnaireProblems([fatal('open-pedigree can\'t read this Questionnaire: ' + ((err && (err as any).message) || err) + '.')]);
  }
}
