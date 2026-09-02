import { Accordion, Anchor, List, Text } from '@mantine/core';
import { AppCard, Page, PageHeader } from '../../shared/ui';

type HelpSection = {
  id: string;
  title: string;
  body: React.ReactNode;
};

const sections: HelpSection[] = [
  {
    id: 'intro',
    title: '1. Введение',
    body: (
      <Text size="sm">
        Scoodle — платформа обучения и оценки знаний. Веб-интерфейс разделён на три контура:
        администратор, преподаватель, студент. Доступный контур определяется ролью в токене.
      </Text>
    ),
  },
  {
    id: 'general',
    title: '2. Общее описание',
    body: (
      <List size="sm" spacing={4}>
        <List.Item>Курсы содержат модули; модуль содержит теорию, банк вопросов и практики.</List.Item>
        <List.Item>Практика включает тест (вопросы 4 типов) и практические задания с файлами решений.</List.Item>
        <List.Item>Итоговая оценка складывается из лучшей попытки теста и средней оценки за задания.</List.Item>
      </List>
    ),
  },
  {
    id: 'student',
    title: '3. Руководство студента',
    body: (
      <List size="sm" spacing={4}>
        <List.Item>Откройте назначенный курс → модуль → материалы.</List.Item>
        <List.Item>Изучите теорию, затем откройте практику и начните попытку теста.</List.Item>
        <List.Item>Ответьте на вопросы и отправьте попытку; результат виден в протоколе.</List.Item>
        <List.Item>Практическое задание сдаётся файлом; файл можно заменить до принятия преподавателем.</List.Item>
      </List>
    ),
  },
  {
    id: 'teacher',
    title: '4. Руководство преподавателя',
    body: (
      <List size="sm" spacing={4}>
        <List.Item>Создайте курс, добавьте модули.</List.Item>
        <List.Item>Наполните модуль теорией (текст + ссылки + документы) и банком вопросов.</List.Item>
        <List.Item>Создайте практику, выберите вопросы, задайте попытки и пороги оценок, опубликуйте.</List.Item>
        <List.Item>Добавьте задания практики; проверяйте сдачи — комментарии и оценка 2–5.</List.Item>
        <List.Item>Смотрите протоколы попыток студентов.</List.Item>
      </List>
    ),
  },
  {
    id: 'admin',
    title: '5. Руководство администратора',
    body: (
      <List size="sm" spacing={4}>
        <List.Item>Управление учётными записями и ролями — через IdentityService.</List.Item>
        <List.Item>Связывание identity-пользователей с локальными учебными профилями платформы.</List.Item>
        <List.Item>Назначение студентов на курсы и практики.</List.Item>
        <List.Item>Журнал аудита и состояние сервисов.</List.Item>
      </List>
    ),
  },
  {
    id: 'tech',
    title: '6. Технические требования',
    body: (
      <List size="sm" spacing={4}>
        <List.Item>Современный браузер (Chrome, Firefox, Edge актуальных версий).</List.Item>
        <List.Item>Доступ к сервисам Education API и IdentityService (адреса — в runtime config).</List.Item>
      </List>
    ),
  },
  {
    id: 'contacts',
    title: '7. Контакты',
    body: (
      <Text size="sm">
        Система интеллектуальной оценки знаний «Scoodle». Разработчик: В.С. Боковой, кафедра
        САПРиУ, СПбГТИ(ТУ). Поддержка:{' '}
        <Anchor href="mailto:support@scoodle.ru">support@scoodle.ru</Anchor>.
      </Text>
    ),
  },
];

export function HelpPage() {
  return (
    <Page>
      <PageHeader title="Справка" description="Краткое руководство по контурам платформы." />
      <AppCard p="md">
        <Accordion multiple defaultValue={['intro']} variant="separated">
          {sections.map((section) => (
            <Accordion.Item key={section.id} value={section.id}>
              <Accordion.Control>{section.title}</Accordion.Control>
              <Accordion.Panel>{section.body}</Accordion.Panel>
            </Accordion.Item>
          ))}
        </Accordion>
      </AppCard>
    </Page>
  );
}
