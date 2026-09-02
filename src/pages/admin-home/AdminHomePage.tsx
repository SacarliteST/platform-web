import { AppCard, ContourHeader, EmptyState, Page } from '../../shared/ui';

export function AdminHomePage() {
  return (
    <Page>
      <ContourHeader
        title="Администратор"
        modeLabel="в разработке"
        description="Управление пользователями, ролями и учебными профилями платформы."
      />
      <AppCard>
        <EmptyState
          title="Контур в разработке"
          description="Экраны администрирования переносятся из sql-module-web (Phase 3)."
        />
      </AppCard>
    </Page>
  );
}
