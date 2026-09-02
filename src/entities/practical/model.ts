import type {
  PracticalQuestionsSetupResponse,
  PracticalResponse,
  SelectableQuestionResponse,
} from '../../api/education/model';
import { toNumber } from '../../shared/lib';
import { questionKindFromTypeId, type QuestionKind } from '../question';

export type Practical = PracticalResponse;

export type SelectableQuestion = SelectableQuestionResponse & {
  kind: QuestionKind | null;
};

/** Настройка теста практики с числовыми порогами. */
export type PracticalQuestionsSetup = {
  questions: SelectableQuestion[];
  isPublic: boolean;
  triesCount: number;
  percentForFive: number;
  percentForFour: number;
  percentForThree: number;
};

export function normalizePracticalSetup(
  dto: PracticalQuestionsSetupResponse,
): PracticalQuestionsSetup {
  return {
    questions: dto.questions.map((question) => ({
      ...question,
      kind: questionKindFromTypeId(question.type),
    })),
    isPublic: dto.isPublic,
    triesCount: toNumber(dto.triesCount, 1),
    percentForFive: toNumber(dto.percentForFive, 90),
    percentForFour: toNumber(dto.percentForFour, 75),
    percentForThree: toNumber(dto.percentForThree, 60),
  };
}
