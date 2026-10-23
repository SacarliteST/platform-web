/** Ключ sessionStorage: короткое сообщение для страницы входа (например, «Пароль изменён»). */
export const LOGIN_NOTICE_KEY = 'platform-login-notice';

/** Забирает сообщение для страницы входа и стирает его: оно показывается один раз. */
export function takeLoginNotice(): string | null {
  try {
    const value = sessionStorage.getItem(LOGIN_NOTICE_KEY);
    if (value) {
      sessionStorage.removeItem(LOGIN_NOTICE_KEY);
    }
    return value;
  } catch {
    return null;
  }
}
