import { Button } from '@mantine/core';
import { Link } from 'react-router-dom';
import { EmptyState, Page } from '../../shared/ui';

export function NotFoundPage() {
  return (
    <Page>
      <EmptyState
        title="Страница не найдена"
        description="Проверьте адрес или вернитесь на стартовую страницу."
        actions={
          <Button component={Link} to="/">
            На главную
          </Button>
        }
      />
    </Page>
  );
}
