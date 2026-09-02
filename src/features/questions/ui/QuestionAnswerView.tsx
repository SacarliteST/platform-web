import { Badge, Group, List, Stack, Text } from '@mantine/core';
import { useMemo } from 'react';
import type { QuestionKind } from '../../../entities';
import { toNumber } from '../../../shared/lib';
import {
  decodeMatchSelection,
  decodeSelectedIds,
  parseDisplayOptions,
  parseMatchAnswer,
  parseMatchDisplay,
  parseShortAnswer,
  parseSingleChoiceAnswer,
} from '../model';

type QuestionAnswerViewProps = {
  kind: QuestionKind;
  questionText: string;
  body: string;
  /** Эталон вопроса (JSON). */
  answer?: string;
  /** Ответ студента (строка/JSON). */
  userAnswer: string;
  isCorrect: boolean;
  questionScore?: number | string;
  questionWeight?: number | string;
};

export function QuestionAnswerView({
  answer,
  body,
  isCorrect,
  kind,
  questionScore,
  questionText,
  questionWeight,
  userAnswer,
}: QuestionAnswerViewProps) {
  return (
    <Stack gap="xs">
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <Text fw={600}>{questionText}</Text>
        <Group gap="xs" wrap="nowrap">
          {questionScore !== undefined && questionWeight !== undefined ? (
            <Badge color="gray" radius="sm" variant="light">
              {toNumber(questionScore)} / {toNumber(questionWeight)}
            </Badge>
          ) : null}
          <Badge color={isCorrect ? 'green' : 'red'} radius="sm" variant="light">
            {isCorrect ? 'Верно' : 'Неверно'}
          </Badge>
        </Group>
      </Group>
      <QuestionAnswerBody kind={kind} body={body} answer={answer} userAnswer={userAnswer} />
    </Stack>
  );
}

function QuestionAnswerBody({
  answer,
  body,
  kind,
  userAnswer,
}: Pick<QuestionAnswerViewProps, 'kind' | 'body' | 'answer' | 'userAnswer'>) {
  const options = useMemo(
    () => (kind === 'Match' ? [] : parseDisplayOptions(kind, body)),
    [kind, body],
  );

  if (kind === 'ShortAnswer') {
    const correct = answer ? parseShortAnswer(answer)?.answer : undefined;
    return (
      <Stack gap={2}>
        <Text size="sm">
          Ответ студента: <b>{userAnswer || '—'}</b>
        </Text>
        {correct ? (
          <Text size="sm" c="dimmed">
            Эталон: {correct}
          </Text>
        ) : null}
      </Stack>
    );
  }

  if (kind === 'SingleChoice') {
    const correctId = answer ? parseSingleChoiceAnswer(answer)?.correctAnswerId : undefined;
    return (
      <List size="sm" spacing={2}>
        {options.map((option) => {
          const chosen = option.id === userAnswer;
          const isRight = option.id === correctId;
          return (
            <List.Item key={option.id}>
              <Text component="span" fw={chosen ? 600 : 400} c={isRight ? 'green' : undefined}>
                {option.text}
              </Text>
              {chosen ? <Text component="span" c="dimmed"> — выбран</Text> : null}
            </List.Item>
          );
        })}
      </List>
    );
  }

  if (kind === 'MultipleChoice') {
    const selected = decodeSelectedIds(userAnswer);
    return (
      <List size="sm" spacing={2}>
        {options.map((option) => (
          <List.Item key={option.id}>
            <Text component="span" fw={selected.includes(option.id) ? 600 : 400}>
              {option.text}
            </Text>
            {selected.includes(option.id) ? <Text component="span" c="dimmed"> — выбран</Text> : null}
          </List.Item>
        ))}
      </List>
    );
  }

  const { leftItems, rightItems } = parseMatchDisplay(body);
  const rightById = new Map(rightItems.map((item) => [item.id, item.text]));
  const selection = decodeMatchSelection(userAnswer);
  const correctPairs = answer ? (parseMatchAnswer(answer)?.matches ?? []) : [];

  return (
    <List size="sm" spacing={2}>
      {leftItems.map((left) => {
        const chosenRight = selection.find((item) => item.left === left.id)?.right;
        const correctRight = correctPairs.find((pair) => pair.left.id === left.id)?.right.id;
        return (
          <List.Item key={left.id}>
            <Text component="span">
              {left.text} → {chosenRight ? rightById.get(chosenRight) ?? '—' : '—'}
            </Text>
            {correctRight && correctRight !== chosenRight ? (
              <Text component="span" c="dimmed">
                {' '}
                (эталон: {rightById.get(correctRight) ?? '—'})
              </Text>
            ) : null}
          </List.Item>
        );
      })}
    </List>
  );
}
