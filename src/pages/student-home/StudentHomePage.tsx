import { Button } from '@mantine/core';
import { Link } from 'react-router-dom';
import { AppCard, ContourHeader, EmptyState, Page } from '../../shared/ui';

export function StudentHomePage() {
  return (
    <Page>
      <ContourHeader
        title="Студент"
        description="Назначенные курсы, теория, тесты, сдача заданий и протоколы."
      />
      <AppCard>
        <EmptyState
          title="Мои курсы"
          description="Открывайте назначенные курсы, изучайте теорию, проходите тесты и сдавайте задания."
          actions={
            <Button component={Link} to="/student/courses">
              Открыть курсы
            </Button>
          }
        />
      </AppCard>
    </Page>
  );
}
