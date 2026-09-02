import type { PracticalGradeResponse } from '../../api/education/model';
import { toNullableNumber } from '../../shared/lib';

export type PracticalGrade = {
  grade: number | null;
  messages: string[];
};

export function normalizePracticalGrade(dto: PracticalGradeResponse): PracticalGrade {
  return {
    grade: toNullableNumber(dto.grade),
    messages: dto.messages ?? [],
  };
}
