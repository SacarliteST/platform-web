/**
 * Формы JSON-полей вопроса. Контракт зафиксирован бэкендом
 * (Education.Domain.Tests.QuestionScoringService) и legacy-вебом — менять нельзя.
 *
 * `body`   — отображаемые данные вопроса (без признаков правильности).
 * `answer` — эталон для проверки (то, что читает QuestionScoringService).
 * ответ студента — одна строка: сырое значение либо JSON-массив.
 */

export type ChoiceOption = { id: string; text: string };

// --- SingleChoice ---------------------------------------------------------

export type SingleChoiceBody = {
  type: 1;
  questionText: string;
  options: ChoiceOption[];
};

export type SingleChoiceAnswer = {
  answers: ChoiceOption[];
  correctAnswerId: string;
};

// --- MultipleChoice -----------------------------------------------------

export type MultipleChoiceOption = ChoiceOption & { correct: boolean; weight: number };

export type MultipleChoiceBody = {
  type: 2;
  questionText: string;
  options: ChoiceOption[];
};

export type MultipleChoiceAnswer = {
  answers: MultipleChoiceOption[];
};

// --- Match --------------------------------------------------------------

export type MatchPair = {
  left: ChoiceOption;
  right: ChoiceOption;
  weight: number;
};

export type MatchBody = {
  type: 3;
  questionText: string;
  leftItems: ChoiceOption[];
  rightItems: ChoiceOption[];
};

export type MatchAnswer = {
  matches: MatchPair[];
};

/** Ответ студента на сопоставление (порядок полей не важен бэкенду). */
export type MatchUserAnswerItem = { left: string; right: string };

// --- ShortAnswer ------------------------------------------------------

export type ShortAnswerBody = {
  type: 4;
  questionText: string;
};

export type ShortAnswerAnswer = {
  /** Допустимые ответы через `;`. */
  answer: string;
};
