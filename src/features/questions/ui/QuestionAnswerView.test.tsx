import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { QuestionAnswerView } from './QuestionAnswerView';
import { renderWithProviders } from '../../../test/render';

// TD-010: разбор протокола показывает текст выбранного варианта, а не его id.

describe('QuestionAnswerView', () => {
  it('SingleChoice — помечает выбранный вариант текстом', () => {
    renderWithProviders(
      <QuestionAnswerView
        kind="SingleChoice"
        questionText="Столица?"
        body='{"type":1,"questionText":"Столица?","options":[{"id":"a","text":"Париж"},{"id":"b","text":"Лион"}]}'
        userAnswer="a"
        isCorrect
      />,
    );
    expect(screen.getByText('Париж')).toBeInTheDocument();
    expect(screen.getByText('Лион')).toBeInTheDocument();
    expect(screen.getByText('— выбран')).toBeInTheDocument();
    expect(screen.getByText('Верно')).toBeInTheDocument();
    // сырой id не показываем
    expect(screen.queryByText(/^a$/)).not.toBeInTheDocument();
  });

  it('MultipleChoice — выбранными помечены только отмеченные', () => {
    renderWithProviders(
      <QuestionAnswerView
        kind="MultipleChoice"
        questionText="Кратные 2"
        body='{"type":2,"questionText":"Кратные 2","options":[{"id":"x","text":"Два"},{"id":"y","text":"Три"},{"id":"z","text":"Четыре"}]}'
        userAnswer='["x","z"]'
        isCorrect={false}
      />,
    );
    expect(screen.getAllByText('— выбран')).toHaveLength(2);
    expect(screen.getByText('Неверно')).toBeInTheDocument();
  });

  it('ShortAnswer — показывает текст ответа студента', () => {
    renderWithProviders(
      <QuestionAnswerView
        kind="ShortAnswer"
        questionText="2+2"
        body='{"type":4,"questionText":"2+2"}'
        userAnswer="четыре"
        isCorrect
      />,
    );
    expect(screen.getByText('четыре')).toBeInTheDocument();
  });
});
