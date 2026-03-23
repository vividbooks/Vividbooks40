import type {
  Worksheet,
  WorksheetBlock,
  ChoiceOption,
  FreeAnswerSubQuestion,
  MultipleChoiceContent,
  FreeAnswerContent,
} from '../types/worksheet';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function normalizeRichHtml(html: string | undefined | null): string {
  return String(html ?? '').trim();
}

export function isRichHtml(value: string | undefined | null): boolean {
  return /<[a-z][\s\S]*>/i.test(String(value ?? ''));
}

export function richHtmlToPlainText(html: string | undefined | null): string {
  const source = String(html ?? '');
  if (!source) return '';

  if (typeof document !== 'undefined') {
    const root = document.createElement('div');
    root.innerHTML = source;
    return (root.textContent ?? '').replace(/\u00a0/g, ' ').trim();
  }

  return source
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

export function plainTextToRichHtml(text: string | undefined | null): string {
  const source = String(text ?? '');
  if (!source.trim()) return '';
  return source
    .split('\n')
    .map((line) => escapeHtml(line))
    .join('<br>');
}

export function legacyQuestionStringToHtml(value: string | undefined | null): string {
  const source = String(value ?? '');
  if (!source.trim()) return '';
  if (isRichHtml(source)) return normalizeRichHtml(source);
  return source
    .replace(/\*\*([\s\S]+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*\n]+?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br>');
}

export function getQuestionHtml(content: { question?: string; questionHtml?: string }): string {
  return normalizeRichHtml(content.questionHtml) || legacyQuestionStringToHtml(content.question);
}

export function setQuestionHtml<T extends { question?: string; questionHtml?: string }>(content: T, questionHtml: string): T {
  const normalized = normalizeRichHtml(questionHtml);
  return {
    ...content,
    questionHtml: normalized,
    question: richHtmlToPlainText(normalized),
  };
}

export function getOptionTextHtml(option: ChoiceOption): string {
  return normalizeRichHtml(option.textHtml) || legacyQuestionStringToHtml(option.text);
}

export function setOptionTextHtml(option: ChoiceOption, textHtml: string): ChoiceOption {
  const normalized = normalizeRichHtml(textHtml);
  return {
    ...option,
    textHtml: normalized,
    text: richHtmlToPlainText(normalized),
  };
}

export function getSubQuestionTextHtml(subQuestion: FreeAnswerSubQuestion): string {
  return normalizeRichHtml(subQuestion.textHtml) || legacyQuestionStringToHtml(subQuestion.text);
}

export function setSubQuestionTextHtml(subQuestion: FreeAnswerSubQuestion, textHtml: string): FreeAnswerSubQuestion {
  const normalized = normalizeRichHtml(textHtml);
  return {
    ...subQuestion,
    textHtml: normalized,
    text: richHtmlToPlainText(normalized),
  };
}

function migrateMultipleChoiceContent(content: MultipleChoiceContent): MultipleChoiceContent {
  return {
    ...content,
    ...setQuestionHtml(content, getQuestionHtml(content)),
    explanationHtml: normalizeRichHtml(content.explanationHtml) || legacyQuestionStringToHtml(content.explanation),
    options: (content.options || []).map((option) => setOptionTextHtml(option, getOptionTextHtml(option))),
  };
}

function migrateFreeAnswerContent(content: FreeAnswerContent): FreeAnswerContent {
  return {
    ...content,
    ...setQuestionHtml(content, getQuestionHtml(content)),
    hintHtml: normalizeRichHtml(content.hintHtml) || legacyQuestionStringToHtml(content.hint),
    sampleAnswerHtml: normalizeRichHtml(content.sampleAnswerHtml) || legacyQuestionStringToHtml(content.sampleAnswer),
    subQuestions: content.subQuestions?.map((subQuestion) =>
      setSubQuestionTextHtml(subQuestion, getSubQuestionTextHtml(subQuestion))
    ),
  };
}

export function migrateWorksheetTextContent(worksheet: Worksheet): Worksheet {
  return {
    ...worksheet,
    blocks: (worksheet.blocks || []).map((block) => {
      if (block.type === 'multiple-choice') {
        return {
          ...block,
          content: migrateMultipleChoiceContent(block.content as MultipleChoiceContent),
        };
      }

      if (block.type === 'free-answer') {
        return {
          ...block,
          content: migrateFreeAnswerContent(block.content as FreeAnswerContent),
        };
      }

      return block;
    }),
  };
}

export function migrateWorksheetTextContentIfNeeded(worksheet: Worksheet | null): Worksheet | null {
  if (!worksheet) return null;
  return migrateWorksheetTextContent(worksheet);
}
