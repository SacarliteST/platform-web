import { Button, Group, Modal, Stack, Text } from '@mantine/core';
import type { ReactNode } from 'react';

type ConfirmModalProps = {
  opened: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmColor?: string;
  children?: ReactNode;
  loading?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ConfirmModal({
  cancelLabel = 'Отмена',
  children,
  confirmColor = 'red',
  confirmLabel = 'Удалить',
  loading = false,
  message,
  onCancel,
  onConfirm,
  opened,
  title,
}: ConfirmModalProps) {
  return (
    <Modal centered opened={opened} title={title} onClose={onCancel}>
      <Stack gap="md">
        <Text size="sm">{message}</Text>
        {children}
      </Stack>
      <Group justify="flex-end" mt="lg">
        <Button variant="default" onClick={onCancel}>
          {cancelLabel}
        </Button>
        <Button color={confirmColor} loading={loading} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </Group>
    </Modal>
  );
}
