import { Button, Group } from '@mantine/core';

type FormActionsProps = {
  submitLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  onCancel?: () => void;
};

export function FormActions({
  cancelLabel = 'Отмена',
  loading = false,
  onCancel,
  submitLabel = 'Сохранить',
}: FormActionsProps) {
  return (
    <Group justify="flex-end" mt="md">
      {onCancel ? (
        <Button variant="default" onClick={onCancel}>
          {cancelLabel}
        </Button>
      ) : null}
      <Button loading={loading} type="submit">
        {submitLabel}
      </Button>
    </Group>
  );
}
