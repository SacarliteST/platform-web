import type {
  TestProtocolResponse,
  TestStatusResponse,
} from '../../api/education/model';
import { toNullableNumber, toNumber } from '../../shared/lib';

export type TestStatus = {
  isStarted: boolean;
  tryNumber: number | null;
};

export function normalizeTestStatus(dto: TestStatusResponse): TestStatus {
  return {
    isStarted: dto.isStarted,
    tryNumber: toNullableNumber(dto.tryNumber),
  };
}

export type TestProtocol = Omit<
  TestProtocolResponse,
  'tryNumber' | 'score' | 'maxScore' | 'grade'
> & {
  tryNumber: number;
  score: number | null;
  maxScore: number | null;
  grade: number;
};

export function normalizeTestProtocol(dto: TestProtocolResponse): TestProtocol {
  return {
    ...dto,
    tryNumber: toNumber(dto.tryNumber),
    score: toNullableNumber(dto.score),
    maxScore: toNullableNumber(dto.maxScore),
    grade: toNumber(dto.grade),
  };
}

const GRADE_LABELS: Record<number, string> = {
  0: 'Не оценено',
  2: 'Неудовлетворительно',
  3: 'Удовлетворительно',
  4: 'Хорошо',
  5: 'Отлично',
};

export function formatGrade(grade: number | null): string {
  if (grade === null) {
    return 'Не оценено';
  }

  return GRADE_LABELS[grade] ?? String(grade);
}
