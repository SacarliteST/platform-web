import {
  ActionIcon,
  Alert,
  Anchor,
  Button,
  FileButton,
  Group,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  useCreateTheoryDocument,
  useCreateTheoryLink,
  useDeleteTheoryDocument,
  useDeleteTheoryLink,
  useGetTheory,
  useGetTheoryDocuments,
  useGetTheoryLinks,
  useUpdateTheoryText,
  useUpdateTheoryTitle,
} from '../../api/education/theories/theories';
import { RichTextField } from '../../features/rich-text';
import { downloadEducationFile } from '../../shared/http';
import {
  AppCard,
  ConfirmModal,
  Page,
  PageBreadcrumbs,
  PageHeader,
  QueryBoundary,
} from '../../shared/ui';

export function TeacherTheoryPage() {
  const { courseId = '', moduleId = '', theoryId = '' } = useParams();
  const theoryQuery = useGetTheory(theoryId, { query: { enabled: Boolean(theoryId), retry: false } });
  const linksQuery = useGetTheoryLinks(theoryId, { query: { enabled: Boolean(theoryId), retry: false } });
  const docsQuery = useGetTheoryDocuments(theoryId, { query: { enabled: Boolean(theoryId), retry: false } });

  const updateTitle = useUpdateTheoryTitle();
  const updateText = useUpdateTheoryText();
  const createLink = useCreateTheoryLink();
  const deleteLink = useDeleteTheoryLink();
  const createDoc = useCreateTheoryDocument();
  const deleteDoc = useDeleteTheoryDocument();

  const theory = theoryQuery.data?.status === 200 ? theoryQuery.data.data : undefined;

  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [linkDesc, setLinkDesc] = useState('');
  const [docDesc, setDocDesc] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [deleteLinkId, setDeleteLinkId] = useState<string | null>(null);
  const [deleteDocId, setDeleteDocId] = useState<string | null>(null);

  useEffect(() => {
    if (theory) {
      setTitle(theory.name);
      setText(theory.text);
    }
  }, [theory]);

  const backToModule = `/teacher/courses/${courseId}/modules/${moduleId}`;

  const saveTitle = async () => {
    setNotice(null);
    const response = await updateTitle
      .mutateAsync({ theoryId, data: { title: title.trim() } })
      .catch(() => null);
    setNotice(response && response.status === 204 ? 'Заголовок сохранён.' : 'Не удалось сохранить заголовок.');
  };

  const saveText = async () => {
    setNotice(null);
    const response = await updateText.mutateAsync({ theoryId, data: { text } }).catch(() => null);
    setNotice(response && response.status === 204 ? 'Текст сохранён.' : 'Не удалось сохранить текст.');
  };

  const addLink = async () => {
    if (!linkUrl.trim()) {
      return;
    }
    const response = await createLink
      .mutateAsync({ data: { theoryMaterialId: theoryId, link: linkUrl.trim(), description: linkDesc.trim() } })
      .catch(() => null);
    if (response && response.status === 200) {
      setLinkUrl('');
      setLinkDesc('');
      await linksQuery.refetch();
    }
  };

  const uploadDoc = async (file: File | null) => {
    if (!file) {
      return;
    }
    const response = await createDoc
      .mutateAsync({ data: { theoryMaterialId: theoryId, description: docDesc.trim(), file } })
      .catch(() => null);
    if (response && response.status === 200) {
      setDocDesc('');
      await docsQuery.refetch();
    }
  };

  return (
    <Page>
      <PageBreadcrumbs
        items={[
          { label: 'Главная', to: '/' },
          { label: 'Преподаватель', to: '/teacher/courses' },
          { label: 'Модуль', to: backToModule },
          { label: theory?.name ?? 'Теория' },
        ]}
      />

      <Group justify="space-between" align="flex-end" gap="md" wrap="wrap">
        <PageHeader title={theory?.name ?? 'Теоретический материал'} description="Заголовок, текст, ссылки и документы." />
        <Button component={Link} to={backToModule} size="sm" variant="outline">
          К модулю
        </Button>
      </Group>

      {notice ? (
        <Alert color="blue" variant="light" onClose={() => setNotice(null)} withCloseButton>
          {notice}
        </Alert>
      ) : null}

      <QueryBoundary
        isPending={theoryQuery.isPending}
        isError={theoryQuery.isError || theoryQuery.data?.status !== 200}
        data={theory}
        errorTitle="Education API недоступен"
      >
        {() => (
          <Stack gap="md">
            <AppCard p="md">
              <Stack gap="sm">
                <Title order={3} size="h5">
                  Заголовок
                </Title>
                <Group align="flex-end" gap="sm" wrap="wrap">
                  <TextInput
                    flex={1}
                    value={title}
                    onChange={(event) => setTitle(event.currentTarget.value)}
                  />
                  <Button onClick={saveTitle} loading={updateTitle.isPending}>
                    Сохранить
                  </Button>
                </Group>
              </Stack>
            </AppCard>

            <AppCard p="md">
              <Stack gap="sm">
                <Group justify="space-between">
                  <Title order={3} size="h5">
                    Текст
                  </Title>
                  <Button onClick={saveText} loading={updateText.isPending}>
                    Сохранить текст
                  </Button>
                </Group>
                <RichTextField value={text} onChange={setText} />
              </Stack>
            </AppCard>

            <AppCard p="md">
              <Stack gap="sm">
                <Title order={3} size="h5">
                  Ссылки
                </Title>
                <Group align="flex-end" gap="sm" wrap="wrap">
                  <TextInput
                    label="URL"
                    flex={1}
                    value={linkUrl}
                    onChange={(event) => setLinkUrl(event.currentTarget.value)}
                  />
                  <TextInput
                    label="Описание"
                    flex={1}
                    value={linkDesc}
                    onChange={(event) => setLinkDesc(event.currentTarget.value)}
                  />
                  <Button onClick={addLink} loading={createLink.isPending}>
                    Добавить
                  </Button>
                </Group>
                <QueryBoundary
                  isPending={linksQuery.isPending}
                  isError={linksQuery.isError || linksQuery.data?.status !== 200}
                  data={linksQuery.data?.status === 200 ? linksQuery.data.data : undefined}
                  emptyTitle="Ссылок нет"
                  isEmpty={(rows) => rows.length === 0}
                >
                  {(rows) => (
                    <Table withTableBorder>
                      <Table.Tbody>
                        {rows.map((row) => (
                          <Table.Tr key={row.id}>
                            <Table.Td>
                              <Anchor href={row.link} target="_blank" rel="noreferrer" size="sm">
                                {row.description || row.link}
                              </Anchor>
                            </Table.Td>
                            <Table.Td w={60}>
                              <ActionIcon
                                color="red"
                                variant="subtle"
                                aria-label="Удалить ссылку"
                                onClick={() => setDeleteLinkId(row.id)}
                              >
                                ✕
                              </ActionIcon>
                            </Table.Td>
                          </Table.Tr>
                        ))}
                      </Table.Tbody>
                    </Table>
                  )}
                </QueryBoundary>
              </Stack>
            </AppCard>

            <AppCard p="md">
              <Stack gap="sm">
                <Title order={3} size="h5">
                  Документы
                </Title>
                <Group align="flex-end" gap="sm" wrap="wrap">
                  <TextInput
                    label="Описание"
                    flex={1}
                    value={docDesc}
                    onChange={(event) => setDocDesc(event.currentTarget.value)}
                  />
                  <FileButton onChange={uploadDoc}>
                    {(props) => (
                      <Button {...props} loading={createDoc.isPending}>
                        Загрузить файл
                      </Button>
                    )}
                  </FileButton>
                </Group>
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
                            <Table.Td w={200}>
                              <Group gap="xs" wrap="nowrap">
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
                                <ActionIcon
                                  color="red"
                                  variant="subtle"
                                  aria-label="Удалить документ"
                                  onClick={() => setDeleteDocId(row.id)}
                                >
                                  ✕
                                </ActionIcon>
                              </Group>
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

      <ConfirmModal
        opened={deleteLinkId !== null}
        title="Удалить ссылку"
        message="Ссылка будет удалена из материала."
        confirmLabel="Удалить"
        loading={deleteLink.isPending}
        onCancel={() => setDeleteLinkId(null)}
        onConfirm={async () => {
          if (deleteLinkId) {
            await deleteLink.mutateAsync({ linkId: deleteLinkId }).catch(() => null);
            await linksQuery.refetch();
          }
          setDeleteLinkId(null);
        }}
      />
      <ConfirmModal
        opened={deleteDocId !== null}
        title="Удалить документ"
        message="Файл будет удалён из материала."
        confirmLabel="Удалить"
        loading={deleteDoc.isPending}
        onCancel={() => setDeleteDocId(null)}
        onConfirm={async () => {
          if (deleteDocId) {
            await deleteDoc.mutateAsync({ docId: deleteDocId }).catch(() => null);
            await docsQuery.refetch();
          }
          setDeleteDocId(null);
        }}
      />
    </Page>
  );
}
