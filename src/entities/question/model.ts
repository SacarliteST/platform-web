import type { QuestionResponse } from '../../api/education/model';
import { toNumber } from '../../shared/lib';

/** Поддерживаемые виды вопросов (совпадают с Education.Domain.Tests.QuestionKind). */
export type QuestionKind = 'SingleChoice' | 'MultipleChoice' | 'Match' | 'ShortAnswer';

/**
 * Фиксированные идентификаторы типов вопросов (Education.Domain.Tests.QuestionTypeIds).
 * Справочника-эндпоинта нет — значения захардкожены по контракту бэкенда.
 */
export const QUESTION_TYPE_IDS: Record<QuestionKind, string> = {
  SingleChoice: '20000000-0000-0000-0000-000000000001',
  MultipleChoice: '20000000-0000-0000-0000-000000000002',
  Match: '20000000-0000-0000-0000-000000000003',
  ShortAnswer: '20000000-0000-0000-0000-000000000004',
};

const KIND_BY_TYPE_ID: Record<string, QuestionKind> = Object.fromEntries(
  (Object.entries(QUESTION_TYPE_IDS) as [QuestionKind, string][]).map(([kind, id]) => [
    id.toLowerCase(),
    kind,
  ]),
);

export function questionKindFromTypeId(typeId: string): QuestionKind | null {
  return KIND_BY_TYPE_ID[typeId.trim().toLowerCase()] ?? null;
}

export function typeIdFromKind(kind: QuestionKind): string {
  return QUESTION_TYPE_IDS[kind];
}

export const QUESTION_KIND_LABELS: Record<QuestionKind, string> = {
  SingleChoice: 'Один вариант',
  MultipleChoice: 'Несколько вариантов',
  Match: 'Сопоставление',
  ShortAnswer: 'Короткий ответ',
};

export const QUESTION_KIND_OPTIONS = (Object.keys(QUESTION_KIND_LABELS) as QuestionKind[]).map(
  (kind) => ({ value: kind, label: QUESTION_KIND_LABELS[kind] }),
);

/** Вопрос с нормализованным весом и распознанным видом. */
export type Question = Omit<QuestionResponse, 'weight'> & {
  weight: number;
  kind: QuestionKind | null;
};

export function normalizeQuestion(dto: QuestionResponse): Question {
  return {
    ...dto,
    weight: toNumber(dto.weight),
    kind: questionKindFromTypeId(dto.type),
  };
}
