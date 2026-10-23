const auditEventLabels: Record<string, string> = {
  UserCreated: 'Пользователь создан',
  UserRegistered: 'Самостоятельная регистрация',
  UserApproved: 'Заявка одобрена',
  UserRejected: 'Заявка отклонена',
  UserProfileUpdated: 'ФИО изменено администратором',
  UserProfileSelfUpdated: 'ФИО изменено пользователем',
  UserPasswordChanged: 'Пароль изменён пользователем',
  UserPasswordReset: 'Пароль сброшен администратором',
  InviteCodeCreated: 'Создан код приглашения',
  InviteCodeDeactivated: 'Код приглашения выключен',
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
