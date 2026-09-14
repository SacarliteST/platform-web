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
      <AppCard>
        <EmptyState
          title="Практические модули"
          description="Наполнение внешних модулей темами, базами и заданиями — напрямую, без привязки к практике."
          actions={
            <Button component={Link} to="/teacher/modules">
              Открыть модули
            </Button>
          }
        />
      </AppCard>
    </Page>
  );
}
