const auditEventLabels: Record<string, string> = {
  UserCreated: 'Пользователь создан',
  UserRolesUpdated: 'Роли изменены',
  UserBlocked: 'Пользователь заблокирован',
  UserUnblocked: 'Пользователь разблокирован',
  LoginSucceeded: 'Успешный вход',
  LoginFailed: 'Ошибка входа',
  RefreshTokenIssued: 'Сессия обновлена',
  RefreshTokenRevoked: 'Сессия отозвана',
};

export const auditEventTypeOptions = Object.entries(auditEventLabels).map(([value, label]) => ({
  value,
  label,
}));

export const formatAuditEventType = (eventType: string): string =>
  auditEventLabels[eventType] ?? eventType;
