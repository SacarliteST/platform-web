import {
  ActionIcon,
  Alert,
  Button,
  Checkbox,
  Group,
  NumberInput,
  Radio,
  Stack,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core';
import { useMemo, useState } from 'react';
import type { QuestionKind } from '../../../entities';
import { typeIdFromKind } from '../../../entities';
import { FormActions } from '../../../shared/ui';
import { buildQuestionPayload, formSchemaForKind, type QuestionFormValues } from '../model';

export type QuestionEditorSubmit = {
  type: string;
  text: string;
  body: string;
  answer: string;
  weight: number;
};

type QuestionEditorProps = {
  kind: QuestionKind;
  initialValues?: QuestionFormValues;
  submitting?: boolean;
  submitLabel?: string;
  onSubmit: (payload: QuestionEditorSubmit) => void | Promise<void>;
  onCancel?: () => void;
};

type OptionState = { id: string; text: string; correct: boolean; weight: number };
type PairState = { key: string; left: string; right: string; weight: number };

let optionCounter = 0;
const nextOptionId = () => `opt-${Date.now().toString(36)}-${(optionCounter += 1)}`;

function initialOptions(values: QuestionFormValues | undefined, kind: QuestionKind): OptionState[] {
  if (values?.kind === 'SingleChoice' && kind === 'SingleChoice') {
    return values.options.map((option) => ({ ...option, correct: false, weight: 0 }));
  }
  if (values?.kind === 'MultipleChoice' && kind === 'MultipleChoice') {
    return values.options.map((option) => ({ ...option }));
  }
  return [
    { id: nextOptionId(), text: '', correct: false, weight: 0 },
    { id: nextOptionId(), text: '', correct: false, weight: 0 },
  ];
}

function initialPairs(values: QuestionFormValues | undefined): PairState[] {
  if (values?.kind === 'Match') {
    return values.pairs.map((pair) => ({ key: nextOptionId(), ...pair }));
  }
  return [
    { key: nextOptionId(), left: '', right: '', weight: 0.5 },
    { key: nextOptionId(), left: '', right: '', weight: 0.5 },
  ];
}

export function QuestionEditor({
  initialValues,
  kind,
  onCancel,
  onSubmit,
  submitLabel = 'Сохранить вопрос',
  submitting = false,
}: QuestionEditorProps) {
  const [text, setText] = useState(initialValues?.text ?? '');
  const [weight, setWeight] = useState<number | string>(initialValues?.weight ?? 1);
  const [options, setOptions] = useState<OptionState[]>(() => initialOptions(initialValues, kind));
  const [correctId, setCorrectId] = useState<string>(
    initialValues?.kind === 'SingleChoice' ? initialValues.correctAnswerId : '',
  );
  const [pairs, setPairs] = useState<PairState[]>(() => initialPairs(initialValues));
  const [shortAnswer, setShortAnswer] = useState(
    initialValues?.kind === 'ShortAnswer' ? initialValues.answer : '',
  );
  const [error, setError] = useState<string | null>(null);

  const schema = useMemo(() => formSchemaForKind(kind), [kind]);

  const handleSubmit = async () => {
    setError(null);
    const values = collectValues();
    const parsed = schema.safeParse(values);

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Проверьте заполнение формы.');
      return;
    }

    const payload = buildQuestionPayload(parsed.data as QuestionFormValues);
    await onSubmit({
      type: typeIdFromKind(kind),
      text: parsed.data.text,
      weight: parsed.data.weight,
      body: payload.body,
      answer: payload.answer,
    });
  };

  function collectValues(): Record<string, unknown> {
    const base = { kind, text, weight: typeof weight === 'number' ? weight : Number(weight) };
    switch (kind) {
      case 'SingleChoice':
        return {
          ...base,
          options: options.map(({ id, text: optionText }) => ({ id, text: optionText })),
          correctAnswerId: correctId,
        };
      case 'MultipleChoice':
        return {
          ...base,
          options: options.map(({ id, text: optionText, correct, weight: optionWeight }) => ({
            id,
            text: optionText,
            correct,
            weight: optionWeight,
          })),
        };
      case 'Match':
        return { ...base, pairs: pairs.map(({ left, right, weight: pairWeight }) => ({ left, right, weight: pairWeight })) };
      case 'ShortAnswer':
        return { ...base, answer: shortAnswer };
    }
  }

  return (
    <Stack gap="md">
      <Textarea
        label="Текст вопроса"
        autosize
        minRows={2}
        value={text}
        onChange={(event) => setText(event.currentTarget.value)}
      />
      <NumberInput
        label="Вес вопроса"
        description="Сумма весов вопросов, выбранных для одного теста, не должна превышать 100"
        min={0}
        max={100}
        step={0.5}
        value={weight}
        onChange={setWeight}
        w={280}
      />

      {kind === 'ShortAnswer' ? (
        <TextInput
          label="Эталонный ответ"
          description="Несколько допустимых вариантов — через точку с запятой"
          value={shortAnswer}
          onChange={(event) => setShortAnswer(event.currentTarget.value)}
        />
      ) : null}

      {kind === 'SingleChoice' || kind === 'MultipleChoice' ? (
        <Stack gap="xs">
          <Group justify="space-between">
            <Text fw={600} size="sm">
              Варианты ответа
            </Text>
            <Button
              size="xs"
              variant="light"
              onClick={() =>
                setOptions((current) => [
                  ...current,
                  { id: nextOptionId(), text: '', correct: false, weight: 0 },
                ])
              }
            >
              Добавить вариант
            </Button>
          </Group>
          {options.map((option) => (
            <Group key={option.id} gap="xs" wrap="nowrap" align="flex-start">
              {kind === 'SingleChoice' ? (
                <Radio
                  checked={correctId === option.id}
                  onChange={() => setCorrectId(option.id)}
                  aria-label="Правильный вариант"
                  mt={8}
                />
              ) : (
                <Checkbox
                  checked={option.correct}
                  onChange={(event) => {
                    const checked = event.currentTarget.checked;
                    setOptions((current) =>
                      current.map((item) =>
                        item.id === option.id ? { ...item, correct: checked } : item,
                      ),
                    );
                  }}
                  aria-label="Правильный вариант"
                  mt={8}
                />
              )}
              <TextInput
                flex={1}
                placeholder="Текст варианта"
                value={option.text}
                onChange={(event) => {
                  const value = event.currentTarget.value;
                  setOptions((current) =>
                    current.map((item) =>
                      item.id === option.id ? { ...item, text: value } : item,
                    ),
                  );
                }}
              />
              {kind === 'MultipleChoice' ? (
                <NumberInput
                  w={110}
                  min={0}
                  max={1}
                  step={0.1}
                  placeholder="Вес"
                  value={option.weight}
                  onChange={(value) =>
                    setOptions((current) =>
                      current.map((item) =>
                        item.id === option.id ? { ...item, weight: Number(value) || 0 } : item,
                      ),
                    )
                  }
                />
              ) : null}
              <ActionIcon
                color="red"
                variant="subtle"
                mt={4}
                aria-label="Удалить вариант"
                onClick={() => setOptions((current) => current.filter((item) => item.id !== option.id))}
              >
                ✕
              </ActionIcon>
            </Group>
          ))}
        </Stack>
      ) : null}

      {kind === 'Match' ? (
        <Stack gap="xs">
          <Group justify="space-between">
            <Text fw={600} size="sm">
              Пары сопоставления
            </Text>
            <Button
              size="xs"
              variant="light"
              onClick={() =>
                setPairs((current) => [
                  ...current,
                  { key: nextOptionId(), left: '', right: '', weight: 0 },
                ])
              }
            >
              Добавить пару
            </Button>
          </Group>
          {pairs.map((pair) => (
            <Group key={pair.key} gap="xs" wrap="nowrap" align="flex-start">
              <TextInput
                flex={1}
                placeholder="Левая часть"
                value={pair.left}
                onChange={(event) => {
                  const value = event.currentTarget.value;
                  setPairs((current) =>
                    current.map((item) =>
                      item.key === pair.key ? { ...item, left: value } : item,
                    ),
                  );
                }}
              />
              <TextInput
                flex={1}
                placeholder="Правая часть"
                value={pair.right}
                onChange={(event) => {
                  const value = event.currentTarget.value;
                  setPairs((current) =>
                    current.map((item) =>
                      item.key === pair.key ? { ...item, right: value } : item,
                    ),
                  );
                }}
              />
              <NumberInput
                w={110}
                min={0}
                max={1}
                step={0.1}
                placeholder="Вес"
                value={pair.weight}
                onChange={(value) =>
                  setPairs((current) =>
                    current.map((item) =>
                      item.key === pair.key ? { ...item, weight: Number(value) || 0 } : item,
                    ),
                  )
                }
              />
              <ActionIcon
                color="red"
                variant="subtle"
                mt={4}
                aria-label="Удалить пару"
                onClick={() => setPairs((current) => current.filter((item) => item.key !== pair.key))}
              >
                ✕
              </ActionIcon>
            </Group>
          ))}
        </Stack>
      ) : null}

      {error ? (
        <Alert color="red" variant="light" title="Не удалось сохранить">
          {error}
        </Alert>
      ) : null}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void handleSubmit();
        }}
      >
        <FormActions submitLabel={submitLabel} loading={submitting} onCancel={onCancel} />
      </form>
    </Stack>
  );
}
