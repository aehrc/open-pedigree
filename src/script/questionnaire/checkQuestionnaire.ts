import { parseQuestionnaire, retiredExtensionsIn, QuestionnaireProblem, RECORD_LINK_ACTIONS, LINKED_RECORD_TAB } from 'pedigree/questionnaire/questionnaireParser';
import { WHOLE_ITEM_PREDICATES, PER_OPTION_PREDICATES } from 'pedigree/questionnaire/graphPredicateEvaluator';
import { PREDICATE_EXTENSION_URL } from 'pedigree/fhirUrls';

/**
 * Every problem open-pedigree would meet in a Questionnaire, before an editor is given it
 * (OpenPedigree.checkQuestionnaire; the website's Try your own form page lists them). Never throws.
 *
 * - `fatal`: the editor can't build a form from it. Retired pre-2.0 extension URLs (one each) make
 *   it fall back to its built-in form. Something that isn't a Questionnaire, or one with no items,
 *   gives an empty form when passed as questionnaireLocal (as questionnaireUrl, a non-Questionnaire
 *   falls back to the built-in form).
 * - `ignored` / `moved`: what the parser logs as it drops a mapping, item or selection, or moves
 *   an item (the same cases, in document order); then what it drops without a word (an item with no
 *   linkId, and whatever sits inside a dropped item); then references the editor can't resolve: a
 *   condition on an item that isn't on the form, an operator it doesn't know or no value to compare,
 *   a predicate it doesn't know, a linkId used twice or taken by the editor's own action items.
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

const OPERATORS = ['exists', '=', '!=', '>', '<', '>=', '<='];
const ANSWER_KEYS = ['answerBoolean', 'answerString', 'answerInteger', 'answerDecimal', 'answerDate', 'answerCoding'];
// linkIds the editor gives its own items in every form (the linked-record action buttons and tab)
const RESERVED_LINK_IDS = RECORD_LINK_ACTIONS.concat([LINKED_RECORD_TAB.key]);

// What the parser drops without a word: an item with no linkId (and everything inside it), and
// whatever sits inside an item it dropped (an unsupported type, an unusable action).
function silentlyDropped(questionnaire: any, kept: Set<string>, reported: Set<string>): QuestionnaireProblem[] {
  const problems: QuestionnaireProblem[] = [];
  const count = (items: any): number => (Array.isArray(items) ? items : [])
    .reduce((n: number, item: any) => n + (item && typeof item === 'object' ? 1 + count(item.item) : 0), 0);
  const walk = (items: any, droppedParent: string | null) => {
    (Array.isArray(items) ? items : []).forEach((item: any) => {
      if (!item || typeof item !== 'object') {
        return;
      }
      if (typeof item.linkId !== 'string' || item.linkId === '') {
        const inside = count(item.item);
        problems.push({ effect: 'ignored', message: 'An item with no linkId' + (item.text ? ' ("' + item.text + '")' : '')
          + ' isn\'t on the form' + (inside ? ', nor are the ' + inside + ' items inside it' : '') + ': every item needs a linkId.' });
        return;
      }
      const dropped = !kept.has(item.linkId);
      if (dropped && droppedParent && !reported.has(item.linkId)) {
        problems.push({ linkId: item.linkId, effect: 'ignored', message: 'Item ' + item.linkId + ' isn\'t on the form: it sits inside ' + droppedParent + ', which the editor dropped.' });
      }
      walk(item.item, dropped ? item.linkId : droppedParent);
    });
  };
  walk(questionnaire.item, null);
  return problems;
}

// The references the editor resolves as it goes, checked against the items on its form: conditions,
// operators and values, predicate names, and linkIds used more than once or taken by the editor.
function referenceProblems(items: any[], kept: Set<string>): QuestionnaireProblem[] {
  const problems: QuestionnaireProblem[] = [];
  const linkIds = new Set<string>();
  const reported = new Set<string>();
  items.forEach((item) => {
    if (typeof item.linkId === 'string') {
      if (RESERVED_LINK_IDS.indexOf(item.linkId) !== -1) {
        problems.push({ linkId: item.linkId, effect: 'ignored', message: 'The linkId ' + item.linkId + ' is one the editor uses for its own linked-record items: answers saved under it would clash with them.' });
      }
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
        const where = 'Item ' + item.linkId + ': an ' + list + ' condition';
        const predicate = Array.isArray(condition.extension)
          && condition.extension.find((ext: any) => ext && ext.url === PREDICATE_EXTENSION_URL);
        if (predicate && predicate.valueCode) {
          if (!WHOLE_ITEM_PREDICATES[predicate.valueCode]) {
            problems.push({ linkId: item.linkId, effect: 'ignored', message: 'Item ' + item.linkId + ': the ' + list + ' predicate "' + predicate.valueCode + '" is unknown, so it counts as false (true where negated). Known predicates: ' + known(WHOLE_ITEM_PREDICATES) + '.' });
          }
          return;
        }
        if (typeof condition.question === 'string' && !linkIds.has(condition.question)) {
          problems.push({ linkId: item.linkId, effect: 'ignored', message: where + ' is on "' + condition.question + '", which no item has as its linkId, so it is treated as never answered.' });
        } else if (typeof condition.question === 'string' && !kept.has(condition.question)) {
          problems.push({ linkId: item.linkId, effect: 'ignored', message: where + ' is on ' + condition.question + ', which isn\'t on the form (the editor dropped it), so it is treated as never answered.' });
        }
        if (OPERATORS.indexOf(condition.operator) === -1) {
          problems.push({ linkId: item.linkId, effect: 'ignored', message: where + (condition.operator === undefined ? ' has no operator' : ' uses the operator "' + condition.operator + '", which the editor doesn\'t know') + ', so it is never met. Known operators: ' + OPERATORS.join(' ') + '.' });
        } else if (condition.operator !== 'exists' && !ANSWER_KEYS.some((k) => Object.prototype.hasOwnProperty.call(condition, k))) {
          problems.push({ linkId: item.linkId, effect: 'ignored', message: where + ' has no answer value (answerBoolean, answerString, ...) to compare with, so it is never met.' });
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
      return new QuestionnaireProblems([fatal('This isn\'t a FHIR resource: a Questionnaire is a JSON object, so the editor can\'t build a form from it.')]);
    }
    if (questionnaire.resourceType !== 'Questionnaire') {
      return new QuestionnaireProblems([fatal('This is ' + (questionnaire.resourceType ? 'a ' + questionnaire.resourceType : 'not a FHIR resource (it has no resourceType)') + ', not a Questionnaire, so the editor can\'t build a form from it.')]);
    }
    if (!Array.isArray(questionnaire.item) || questionnaire.item.length === 0) {
      return new QuestionnaireProblems([fatal('The Questionnaire has no items, so the editor\'s form would be empty.')]);
    }
    const retired = retiredExtensionsIn(questionnaire.item);
    if (retired.length) {
      return new QuestionnaireProblems(retired.map((r) => fatal('It uses ' + r.url + ', which open-pedigree no longer reads (the editor would use its built-in form instead): use ' + r.replacement + ' instead.')));
    }
    const problems: QuestionnaireProblem[] = [];
    // (the editor's own parse, collecting what it logs - and logging it, as the editor would)
    const parsed = parseQuestionnaire(questionnaire, problems);
    // the items on the form: fields, headings and tabs (an item moved to "General" included)
    const kept = new Set<string>(parsed.items.map((i: any) => i.linkId).concat(parsed.tabs.map((t: any) => t.key)));
    const reported = new Set<string>(problems.map((p) => p.linkId).filter(Boolean) as string[]);
    return new QuestionnaireProblems(problems
      .concat(silentlyDropped(questionnaire, kept, reported))
      .concat(referenceProblems(allItems(questionnaire.item), kept)));
  } catch (err) {
    // (anything the parser can't get through is something the editor couldn't use either)
    return new QuestionnaireProblems([fatal('open-pedigree can\'t read this Questionnaire: ' + ((err && (err as any).message) || err) + '.')]);
  }
}
