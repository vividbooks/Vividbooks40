import type { ABCActivitySlide } from '../types/quiz';

export type ABCAnswerValue = string | string[] | null | undefined;

export function getABCSelectedAnswerIds(answer: ABCAnswerValue): string[] {
  if (Array.isArray(answer)) {
    return Array.from(new Set(answer.filter(Boolean)));
  }

  if (typeof answer === 'string' && answer.trim()) {
    return [answer];
  }

  return [];
}

export function isABCAnswerSelected(answer: ABCAnswerValue, optionId: string): boolean {
  return getABCSelectedAnswerIds(answer).includes(optionId);
}

export function toggleABCAnswerSelection(
  currentAnswer: ABCAnswerValue,
  optionId: string,
  allowMultiple = false,
): string | string[] {
  if (!allowMultiple) {
    return optionId;
  }

  const selected = getABCSelectedAnswerIds(currentAnswer);
  return selected.includes(optionId)
    ? selected.filter((id) => id !== optionId)
    : [...selected, optionId];
}

export function evaluateABCAnswer(slide: ABCActivitySlide, answer: ABCAnswerValue): boolean {
  const selected = getABCSelectedAnswerIds(answer);
  const correct = slide.options.filter((option) => option.isCorrect).map((option) => option.id);

  if (selected.length === 0 || correct.length === 0) {
    return false;
  }

  const hasWrongSelection = selected.some((id) => !correct.includes(id));
  if (hasWrongSelection) {
    return false;
  }

  if (slide.allowMultipleCorrect) {
    if (slide.multipleCorrectRequirement === 'any') {
      return selected.some((id) => correct.includes(id));
    }

    return correct.every((id) => selected.includes(id));
  }

  return selected.length === 1 && correct.includes(selected[0]);
}
