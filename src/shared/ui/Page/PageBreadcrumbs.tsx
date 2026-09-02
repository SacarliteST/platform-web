import { Anchor, Breadcrumbs } from '@mantine/core';
import { Link } from 'react-router-dom';

export type PageBreadcrumbItem = {
  label: string;
  to?: string;
};

type PageBreadcrumbsProps = {
  items: PageBreadcrumbItem[];
};

export function PageBreadcrumbs({ items }: PageBreadcrumbsProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <Breadcrumbs fz="sm">
      {items.map((item) =>
        item.to ? (
          <Anchor component={Link} key={`${item.label}:${item.to}`} to={item.to}>
            {item.label}
          </Anchor>
        ) : (
          <span key={item.label}>{item.label}</span>
        ),
      )}
    </Breadcrumbs>
  );
}
