import { describe, expect, it } from 'vitest';
import { readReason } from '../../shared/lib';
import { trainingLinkErrorMessage } from './training-link-error';

describe('trainingLinkErrorMessage', () => {
  it('различает причины 409', () => {
    expect(trainingLinkErrorMessage(409, { reason: 'ModuleDisabled' })).toMatch(/отключён/);
    expect(trainingLinkErrorMessage(409, { reason: 'TrainingBankDisabled' })).toMatch(/не включён/);
  });

  it('502 — недоступен сервис авторизации', () => {
    expect(trainingLinkErrorMessage(502, { reason: 'IdentityUnavailable' })).toMatch(/авторизации/);
  });

  it('403, 404 и неизвестный статус', () => {
    expect(trainingLinkErrorMessage(403, undefined)).toMatch(/только студентам/);
    expect(trainingLinkErrorMessage(404, undefined)).toMatch(/не найден/);
    expect(trainingLinkErrorMessage(500, undefined)).toBe('Не удалось открыть банк заданий.');
  });
});

describe('readReason', () => {
  it('читает reason из объекта и игнорирует остальное', () => {
    expect(readReason({ reason: 'X' })).toBe('X');
    expect(readReason({ reason: 1 })).toBeUndefined();
    expect(readReason(null)).toBeUndefined();
    expect(readReason('text')).toBeUndefined();
  });
});
