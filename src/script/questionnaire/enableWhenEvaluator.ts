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

function evaluateCondition(condition: any, answers: any): boolean {
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
 */
export function evaluateEnableWhen(enableWhen: any, enableBehavior: any, answers: any): boolean {
  if (!enableWhen || enableWhen.length === 0) {
    return true;
  }
  const results = enableWhen.map((condition: any) => evaluateCondition(condition, answers));
  if (enableBehavior === 'any') {
    return results.some((r: boolean) => r);
  }
  return results.every((r: boolean) => r);
}
