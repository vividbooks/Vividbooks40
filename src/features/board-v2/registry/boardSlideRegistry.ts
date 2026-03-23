import { SLIDE_TYPES, type SlideTypeOption } from '../../../components/quiz/slide-types';

const slideTypeById = new Map<string, SlideTypeOption>(
  SLIDE_TYPES.map((item) => [item.id, item])
);

export function getBoardSlideTypeOptions(): SlideTypeOption[] {
  return SLIDE_TYPES;
}

export function getBoardSlideTypeById(id: string): SlideTypeOption | undefined {
  return slideTypeById.get(id);
}

export function getBoardActivityTypeOptions(): SlideTypeOption[] {
  return SLIDE_TYPES.filter((item) => item.type === 'activity');
}

export function getBoardToolTypeOptions(): SlideTypeOption[] {
  return SLIDE_TYPES.filter((item) => item.type === 'tools');
}
