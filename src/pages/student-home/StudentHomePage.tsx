import { AppCard, ContourHeader, EmptyState, Page } from '../../shared/ui';

export function StudentHomePage() {
  return (
    <Page>
      <ContourHeader
        title="Студент"
        modeLabel="в разработке"
        description="Назначенные курсы, теория, тесты, сдача заданий и протоколы."
      />
      <AppCard>
        <EmptyState
          title="Контур в разработке"
          description="Экраны студента реализуются в Phase 5."
        />
      </AppCard>
    </Page>
  );
}
