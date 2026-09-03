import { Button } from '@mantine/core';
import { Link } from 'react-router-dom';
import { AppCard, ContourHeader, EmptyState, Page } from '../../shared/ui';

export function TeacherHomePage() {
  return (
    <Page>
      <ContourHeader
        title="Преподаватель"
        description="Курсы, модули, теория, вопросы, практики и проверка сдач."
      />
      <AppCard>
        <EmptyState
          title="Курсы"
          description="Управление учебными курсами и их наполнением."
          actions={
            <Button component={Link} to="/teacher/courses">
              Открыть курсы
            </Button>
          }
        />
      </AppCard>
    </Page>
  );
}
