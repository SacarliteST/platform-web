import { Anchor, Button, Group, List, Stack, Table, Text, Title } from '@mantine/core';
import { Link, useParams } from 'react-router-dom';
import {
  useGetTheory,
  useGetTheoryDocuments,
  useGetTheoryLinks,
} from '../../api/education/theories/theories';
import { RichTextViewer } from '../../features/rich-text/RichTextViewer';
import { downloadEducationFile } from '../../shared/http';
import {
  AppCard,
  Page,
  PageBreadcrumbs,
  PageHeader,
  QueryBoundary,
} from '../../shared/ui';

export function StudentTheoryPage() {
  const { courseId = '', moduleId = '', theoryId = '' } = useParams();
  const theoryQuery = useGetTheory(theoryId, { query: { enabled: Boolean(theoryId), retry: false } });
  const linksQuery = useGetTheoryLinks(theoryId, {
    query: { enabled: Boolean(theoryId), retry: false },
  });
  const docsQuery = useGetTheoryDocuments(theoryId, {
    query: { enabled: Boolean(theoryId), retry: false },
  });

  const theory = theoryQuery.data?.status === 200 ? theoryQuery.data.data : undefined;
  const backToModule = `/student/courses/${courseId}/modules/${moduleId}`;

  return (
    <Page>
      <PageBreadcrumbs
        items={[
          { label: 'Главная', to: '/' },
          { label: 'Студент', to: '/student/courses' },
          { label: 'Модуль', to: backToModule },
          { label: theory?.name ?? 'Теория' },
        ]}
      />

      <Group justify="space-between" align="flex-end" gap="md" wrap="wrap">
        <PageHeader title={theory?.name ?? 'Теоретический материал'} description="Материал для изучения." />
        <Button component={Link} to={backToModule} size="sm" variant="outline">
          К модулю
        </Button>
      </Group>

      <QueryBoundary
        isPending={theoryQuery.isPending}
        isError={theoryQuery.isError || theoryQuery.data?.status !== 200}
        data={theory}
        errorTitle="Education API недоступен"
      >
        {(data) => (
          <Stack gap="md">
            <AppCard p="md">
              {data.text ? (
                <RichTextViewer html={data.text} />
              ) : (
                <Text c="dimmed" size="sm">
                  Текст материала не заполнен.
                </Text>
              )}
            </AppCard>

            <AppCard p="md">
              <Stack gap="sm">
                <Title order={3} size="h5">
                  Ссылки
                </Title>
                <QueryBoundary
                  isPending={linksQuery.isPending}
                  isError={linksQuery.isError || linksQuery.data?.status !== 200}
                  data={linksQuery.data?.status === 200 ? linksQuery.data.data : undefined}
                  emptyTitle="Ссылок нет"
                  isEmpty={(rows) => rows.length === 0}
                >
                  {(rows) => (
                    <List spacing={4} size="sm">
                      {rows.map((row) => (
                        <List.Item key={row.id}>
                          <Anchor href={row.link} target="_blank" rel="noreferrer">
                            {row.description || row.link}
                          </Anchor>
                        </List.Item>
                      ))}
                    </List>
                  )}
                </QueryBoundary>
              </Stack>
            </AppCard>

            <AppCard p="md">
              <Stack gap="sm">
                <Title order={3} size="h5">
                  Документы
                </Title>
                <QueryBoundary
                  isPending={docsQuery.isPending}
                  isError={docsQuery.isError || docsQuery.data?.status !== 200}
                  data={docsQuery.data?.status === 200 ? docsQuery.data.data : undefined}
                  emptyTitle="Документов нет"
                  isEmpty={(rows) => rows.length === 0}
                >
                  {(rows) => (
                    <Table withTableBorder>
                      <Table.Tbody>
                        {rows.map((row) => (
                          <Table.Tr key={row.id}>
                            <Table.Td>
                              <Text size="sm">{row.description || row.name}</Text>
                            </Table.Td>
                            <Table.Td w={140}>
                              <Button
                                size="xs"
                                variant="subtle"
                                onClick={() =>
                                  downloadEducationFile(
                                    `/api/v1/files/${encodeURIComponent(row.path)}`,
                                    row.name,
                                  )
                                }
                              >
                                Скачать
                              </Button>
                            </Table.Td>
                          </Table.Tr>
                        ))}
                      </Table.Tbody>
                    </Table>
                  )}
                </QueryBoundary>
              </Stack>
            </AppCard>
          </Stack>
        )}
      </QueryBoundary>
    </Page>
  );
}
