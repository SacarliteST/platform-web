import { Checkbox, Radio, Select, Stack, Text, TextInput } from '@mantine/core';
import { useMemo } from 'react';
import type { QuestionKind } from '../../../entities';
import {
  decodeMatchSelection,
  decodeSelectedIds,
  encodeUserAnswer,
  parseDisplayOptions,
  parseMatchDisplay,
  type MatchUserAnswerItem,
} from '../model';

type QuestionAnswerInputProps = {
  kind: QuestionKind;
  body: string;
  /** Закодированный ответ студента (строка/JSON-массив). */
  value: string;
  onChange: (nextValue: string) => void;
  disabled?: boolean;
};

export function QuestionAnswerInput({ body, disabled, kind, onChange, value }: QuestionAnswerInputProps) {
  if (kind === 'ShortAnswer') {
    return (
      <TextInput
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
        placeholder="Ваш ответ"
        disabled={disabled}
      />
    );
  }

  if (kind === 'SingleChoice') {
    return <SingleChoiceInput body={body} value={value} onChange={onChange} disabled={disabled} />;
  }

  if (kind === 'MultipleChoice') {
    return <MultipleChoiceInput body={body} value={value} onChange={onChange} disabled={disabled} />;
  }

  return <MatchInput body={body} value={value} onChange={onChange} disabled={disabled} />;
}

function SingleChoiceInput({ body, disabled, onChange, value }: Omit<QuestionAnswerInputProps, 'kind'>) {
  const options = useMemo(() => parseDisplayOptions('SingleChoice', body), [body]);

  return (
    <Radio.Group value={value} onChange={onChange}>
      <Stack gap="xs">
        {options.map((option) => (
          <Radio key={option.id} value={option.id} label={option.text} disabled={disabled} />
        ))}
      </Stack>
    </Radio.Group>
  );
}

function MultipleChoiceInput({ body, disabled, onChange, value }: Omit<QuestionAnswerInputProps, 'kind'>) {
  const options = useMemo(() => parseDisplayOptions('MultipleChoice', body), [body]);
  const selected = useMemo(() => decodeSelectedIds(value), [value]);

  return (
    <Checkbox.Group
      value={selected}
      onChange={(next) => onChange(encodeUserAnswer('MultipleChoice', next))}
    >
      <Stack gap="xs">
        {options.map((option) => (
          <Checkbox key={option.id} value={option.id} label={option.text} disabled={disabled} />
        ))}
      </Stack>
    </Checkbox.Group>
  );
}

function MatchInput({ body, disabled, onChange, value }: Omit<QuestionAnswerInputProps, 'kind'>) {
  const { leftItems, rightItems } = useMemo(() => parseMatchDisplay(body), [body]);
  const selection = useMemo(() => decodeMatchSelection(value), [value]);

  const rightOptions = rightItems.map((item) => ({ value: item.id, label: item.text }));

  const setRightFor = (leftId: string, rightId: string | null) => {
    const next: MatchUserAnswerItem[] = leftItems.map((left) => {
      const current = selection.find((item) => item.left === left.id);
      if (left.id === leftId) {
        return { left: left.id, right: rightId ?? '' };
      }
      return { left: left.id, right: current?.right ?? '' };
    });
    onChange(encodeUserAnswer('Match', next.filter((item) => item.right !== '')));
  };

  return (
    <Stack gap="sm">
      {leftItems.map((left) => (
        <Select
          key={left.id}
          label={left.text}
          data={rightOptions}
          value={selection.find((item) => item.left === left.id)?.right || null}
          onChange={(rightId) => setRightFor(left.id, rightId)}
          placeholder="Выберите соответствие"
          disabled={disabled}
          allowDeselect
        />
      ))}
      {leftItems.length === 0 ? <Text c="dimmed" size="sm">Нет данных вопроса.</Text> : null}
    </Stack>
  );
}
