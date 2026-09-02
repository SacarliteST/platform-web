import { z } from 'zod';
import type { QuestionKind } from '../../../entities';

const optionSchema = z.object({
  id: z.string().min(1),
  text: z.string().trim().min(1, 'Заполните текст варианта'),
});

const questionBaseSchema = z.object({
  text: z.string().trim().min(1, 'Заполните текст вопроса'),
  weight: z.number({ message: 'Укажите вес' }).positive('Вес должен быть больше 0'),
});

export const singleChoiceFormSchema = questionBaseSchema.extend({
  kind: z.literal('SingleChoice'),
  options: z.array(optionSchema).min(2, 'Нужно минимум два варианта'),
  correctAnswerId: z.string().min(1, 'Отметьте правильный вариант'),
}).refine((value) => value.options.some((option) => option.id === value.correctAnswerId), {
  message: 'Правильный вариант не найден среди вариантов',
  path: ['correctAnswerId'],
});

export const multipleChoiceFormSchema = questionBaseSchema.extend({
  kind: z.literal('MultipleChoice'),
  options: z
    .array(
      optionSchema.extend({
        correct: z.boolean(),
        weight: z.number().min(0).max(1),
      }),
    )
    .min(2, 'Нужно минимум два варианта'),
})
  .refine((value) => value.options.some((option) => option.correct), {
    message: 'Отметьте хотя бы один правильный вариант',
    path: ['options'],
  })
  .refine(
    (value) => Math.abs(value.options.reduce((sum, option) => sum + option.weight, 0) - 1) < 1e-6,
    { message: 'Сумма весов вариантов должна равняться 1', path: ['options'] },
  );

export const matchFormSchema = questionBaseSchema.extend({
  kind: z.literal('Match'),
  pairs: z
    .array(
      z.object({
        left: z.string().trim().min(1, 'Заполните левую часть'),
        right: z.string().trim().min(1, 'Заполните правую часть'),
        weight: z.number().min(0).max(1),
      }),
    )
    .min(2, 'Нужно минимум две пары'),
}).refine(
  (value) => Math.abs(value.pairs.reduce((sum, pair) => sum + pair.weight, 0) - 1) < 1e-6,
  { message: 'Сумма весов пар должна равняться 1', path: ['pairs'] },
);

export const shortAnswerFormSchema = questionBaseSchema.extend({
  kind: z.literal('ShortAnswer'),
  answer: z.string().trim().min(1, 'Заполните эталонный ответ'),
});

export type SingleChoiceFormValues = z.infer<typeof singleChoiceFormSchema>;
export type MultipleChoiceFormValues = z.infer<typeof multipleChoiceFormSchema>;
export type MatchFormValues = z.infer<typeof matchFormSchema>;
export type ShortAnswerFormValues = z.infer<typeof shortAnswerFormSchema>;

export type QuestionFormValues =
  | SingleChoiceFormValues
  | MultipleChoiceFormValues
  | MatchFormValues
  | ShortAnswerFormValues;

export function formSchemaForKind(kind: QuestionKind) {
  switch (kind) {
    case 'SingleChoice':
      return singleChoiceFormSchema;
    case 'MultipleChoice':
      return multipleChoiceFormSchema;
    case 'Match':
      return matchFormSchema;
    case 'ShortAnswer':
      return shortAnswerFormSchema;
  }
}
