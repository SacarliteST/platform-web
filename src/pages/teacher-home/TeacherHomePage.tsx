import { AppCard, ContourHeader, EmptyState, Page } from '../../shared/ui';

export function TeacherHomePage() {
  return (
    <Page>
      <ContourHeader
        title="Преподаватель"
        modeLabel="в разработке"
        description="Курсы, модули, теория, вопросы, практики и проверка сдач."
      />
      <AppCard>
        <EmptyState
          title="Контур в разработке"
          description="Экраны преподавателя реализуются в Phase 4."
        />
      </AppCard>
    </Page>
  );
}
