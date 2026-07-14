import { evaluateGraphPredicate } from 'pedigree/questionnaire/graphPredicateEvaluator';

function extractAnswerValue(condition: any): any {
  if (condition.hasOwnProperty('answerBoolean')) {
    return condition.answerBoolean;
  }
  if (condition.hasOwnProperty('answerString')) {
    return condition.answerString;
  }
  if (condition.hasOwnProperty('answerInteger')) {
    return condition.answerInteger;
  }
  if (condition.hasOwnProperty('answerDecimal')) {
    return condition.answerDecimal;
  }
  if (condition.hasOwnProperty('answerDate')) {
    return condition.answerDate;
  }
  if (condition.hasOwnProperty('answerCoding')) {
    return condition.answerCoding.code;
  }
  return undefined;
}

function currentAnswerValue(answer: any): any {
  if (answer && typeof answer === 'object' && answer.hasOwnProperty('code')) {
    return answer.code;
  }
  return answer;
}

function evaluateCondition(condition: any, answers: any, context: any): boolean {
  if (condition.predicate) {
    if (!context || !context.node || !context.graph) {
      console.warn('enableWhen condition references predicate "' + condition.predicate + '" but no graph/app-state context was provided - treating as unsatisfied');
      return false;
    }
    const result = evaluateGraphPredicate(condition.predicate, context.node, context.graph, context.patientProvider);
    return condition.negate ? !result : result;
  }

  const current = currentAnswerValue(answers[condition.question]);
  const expected = extractAnswerValue(condition);

  switch (condition.operator) {
  case 'exists':
    return expected === false ? (current === undefined || current === null || current === '') : (current !== undefined && current !== null && current !== '');
  case '=':
    return current === expected;
  case '!=':
    return current !== expected;
  case '>':
    return current !== undefined && current !== null && current > expected;
  case '<':
    return current !== undefined && current !== null && current < expected;
  case '>=':
    return current !== undefined && current !== null && current >= expected;
  case '<=':
    return current !== undefined && current !== null && current <= expected;
  default:
    return false;
  }
}

/**
 * Returns true if the item's conditions are satisfied (i.e. it should be shown).
 *
 * `context`, when provided, is `{node, graph, patientProvider}` - required only when a
 * condition references a graph/app-state predicate (see graphPredicateEvaluator.ts) instead
 * of another item's answer.
 */
export function evaluateEnableWhen(enableWhen: any, enableBehavior: any, answers: any, context?: any): boolean {
  if (!enableWhen || enableWhen.length === 0) {
    return true;
  }
  const results = enableWhen.map((condition: any) => evaluateCondition(condition, answers, context));
  if (enableBehavior === 'any') {
    return results.some((r: boolean) => r);
  }
  return results.every((r: boolean) => r);
}
