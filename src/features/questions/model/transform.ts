import { questionKindFromTypeId } from '../../../entities';
import type { QuestionKind } from '../../../entities';
import type {
  MatchAnswer,
  MatchBody,
  MatchUserAnswerItem,
  MultipleChoiceAnswer,
  MultipleChoiceBody,
  ShortAnswerAnswer,
  ShortAnswerBody,
  SingleChoiceAnswer,
  SingleChoiceBody,
} from './payload';
import type {
  MatchFormValues,
  MultipleChoiceFormValues,
  QuestionFormValues,
  ShortAnswerFormValues,
  SingleChoiceFormValues,
} from './schema';

export type QuestionPayload = { body: string; answer: string };

/** Форма редактора → строки `body` / `answer` для CreateQuestion / UpdateQuestion. */
export function buildQuestionPayload(values: QuestionFormValues): QuestionPayload {
  switch (values.kind) {
    case 'SingleChoice':
      return buildSingleChoice(values);
    case 'MultipleChoice':
      return buildMultipleChoice(values);
    case 'Match':
      return buildMatch(values);
    case 'ShortAnswer':
      return buildShortAnswer(values);
  }
}

function buildSingleChoice(values: SingleChoiceFormValues): QuestionPayload {
  const options = values.options.map((option) => ({ id: option.id, text: option.text.trim() }));
  const body: SingleChoiceBody = { type: 1, questionText: values.text.trim(), options };
  const answer: SingleChoiceAnswer = { answers: options, correctAnswerId: values.correctAnswerId };
  return { body: JSON.stringify(body), answer: JSON.stringify(answer) };
}

function buildMultipleChoice(values: MultipleChoiceFormValues): QuestionPayload {
  const options = values.options.map((option) => ({
    id: option.id,
    text: option.text.trim(),
    correct: option.correct,
    weight: option.weight,
  }));
  const body: MultipleChoiceBody = {
    type: 2,
    questionText: values.text.trim(),
    options: options.map(({ id, text }) => ({ id, text })),
  };
  const answer: MultipleChoiceAnswer = { answers: options };
  return { body: JSON.stringify(body), answer: JSON.stringify(answer) };
}

function buildMatch(values: MatchFormValues): QuestionPayload {
  const pairs = values.pairs.map((pair, index) => ({
    left: { id: `a${index + 1}`, text: pair.left.trim() },
    right: { id: `q${index + 1}`, text: pair.right.trim() },
    weight: pair.weight,
  }));
  const body: MatchBody = {
    type: 3,
    questionText: values.text.trim(),
    leftItems: pairs.map((pair) => pair.left),
    rightItems: pairs.map((pair) => pair.right),
  };
  const answer: MatchAnswer = { matches: pairs };
  return { body: JSON.stringify(body), answer: JSON.stringify(answer) };
}

function buildShortAnswer(values: ShortAnswerFormValues): QuestionPayload {
  const body: ShortAnswerBody = { type: 4, questionText: values.text.trim() };
  const answer: ShortAnswerAnswer = { answer: values.answer.trim() };
  return { body: JSON.stringify(body), answer: JSON.stringify(answer) };
}

// --- разбор ------------------------------------------------------------

function safeParse<T>(json: string): T | null {
  try {
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}

export function parseSingleChoiceAnswer(json: string): SingleChoiceAnswer | null {
  return safeParse<SingleChoiceAnswer>(json);
}

export function parseMultipleChoiceAnswer(json: string): MultipleChoiceAnswer | null {
  return safeParse<MultipleChoiceAnswer>(json);
}

export function parseMatchAnswer(json: string): MatchAnswer | null {
  return safeParse<MatchAnswer>(json);
}

export function parseShortAnswer(json: string): ShortAnswerAnswer | null {
  return safeParse<ShortAnswerAnswer>(json);
}

/** Сырое поле `body` вопроса, приведённое к списку отображаемых вариантов. */
export function parseDisplayOptions(kind: QuestionKind, bodyJson: string): { id: string; text: string }[] {
  const body = safeParse<Record<string, unknown>>(bodyJson);
  if (!body) {
    return [];
  }

  if (kind === 'Match') {
    return [];
  }

  const options = body.options;
  return Array.isArray(options)
    ? options.filter(isChoiceOption).map((option) => ({ id: option.id, text: option.text }))
    : [];
}

export function parseMatchDisplay(bodyJson: string): {
  leftItems: { id: string; text: string }[];
  rightItems: { id: string; text: string }[];
} {
  const body = safeParse<MatchBody>(bodyJson);
  return {
    leftItems: Array.isArray(body?.leftItems) ? body.leftItems.filter(isChoiceOption) : [],
    rightItems: Array.isArray(body?.rightItems) ? body.rightItems.filter(isChoiceOption) : [],
  };
}

function isChoiceOption(value: unknown): value is { id: string; text: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { id?: unknown }).id === 'string' &&
    typeof (value as { text?: unknown }).text === 'string'
  );
}

// --- ответ студента --------------------------------------------------

export function encodeUserAnswer(kind: QuestionKind, raw: string | string[] | MatchUserAnswerItem[]): string {
  if (kind === 'SingleChoice' || kind === 'ShortAnswer') {
    return typeof raw === 'string' ? raw : '';
  }

  return JSON.stringify(raw ?? []);
}

export function decodeSelectedIds(userAnswer: string): string[] {
  const parsed = safeParse<unknown>(userAnswer);
  return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
}

export function decodeMatchSelection(userAnswer: string): MatchUserAnswerItem[] {
  const parsed = safeParse<unknown>(userAnswer);
  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed
    .filter(
      (item): item is { left?: unknown; right?: unknown } =>
        typeof item === 'object' && item !== null,
    )
    .map((item) => ({
      left: typeof item.left === 'string' ? item.left : '',
      right: typeof item.right === 'string' ? item.right : '',
    }));
}

// --- восстановление формы редактора из сохранённого вопроса ------------

type StoredQuestion = { text: string; type: string; weight: number; answer: string };

/**
 * `QuestionResponse` (эталон в JSON) → значения формы `QuestionEditor` для режима правки.
 * Возвращает `null`, если тип неизвестен или `answer` не парсится.
 */
export function questionToFormValues(question: StoredQuestion): QuestionFormValues | null {
  const kind = questionKindFromTypeId(question.type);
  if (!kind) {
    return null;
  }

  const base = { text: question.text, weight: question.weight };

  switch (kind) {
    case 'SingleChoice': {
      const parsed = parseSingleChoiceAnswer(question.answer);
      if (!parsed) return null;
      return {
        kind,
        ...base,
        options: parsed.answers.map((option) => ({ id: option.id, text: option.text })),
        correctAnswerId: parsed.correctAnswerId,
      };
    }
    case 'MultipleChoice': {
      const parsed = parseMultipleChoiceAnswer(question.answer);
      if (!parsed) return null;
      return {
        kind,
        ...base,
        options: parsed.answers.map((option) => ({
          id: option.id,
          text: option.text,
          correct: option.correct,
          weight: option.weight,
        })),
      };
    }
    case 'Match': {
      const parsed = parseMatchAnswer(question.answer);
      if (!parsed) return null;
      return {
        kind,
        ...base,
        pairs: parsed.matches.map((match) => ({
          left: match.left.text,
          right: match.right.text,
          weight: match.weight,
        })),
      };
    }
    case 'ShortAnswer': {
      const parsed = parseShortAnswer(question.answer);
      return { kind, ...base, answer: parsed?.answer ?? '' };
    }
  }
}
