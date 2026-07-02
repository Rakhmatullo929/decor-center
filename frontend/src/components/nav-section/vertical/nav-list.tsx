import { useState, useEffect, useCallback } from 'react';
import { matchPath } from 'react-router-dom';
// @mui
import Collapse from '@mui/material/Collapse';
// routes
import { usePathname } from 'src/routes/hook';
//
import { NavListProps, NavConfigProps } from '../types';
import NavItem from './nav-item';

// ----------------------------------------------------------------------

type NavListRootProps = {
  data: NavListProps;
  depth: number;
  hasChild: boolean;
  config: NavConfigProps;
};

function hasActiveChild(items: NavListProps[] | undefined, pathname: string): boolean {
  if (!items?.length) {
    return false;
  }

  return items.some((item) => {
    const selfActive = item.path
      ? !!matchPath({ path: item.path, end: false }, pathname)
      : false;

    if (selfActive) {
      return true;
    }

    return hasActiveChild(item.children as NavListProps[] | undefined, pathname);
  });
}

export default function NavList({ data, depth, hasChild, config }: NavListRootProps) {
  const pathname = usePathname();

  const selfActive = data.path
    ? !!matchPath({ path: data.path, end: false }, pathname)
    : false;
  const active = selfActive || hasActiveChild(data.children as NavListProps[] | undefined, pathname);

  const externalLink = data.path.includes('http');

  const [open, setOpen] = useState(active);

  useEffect(() => {
    if (!active) {
      handleClose();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const handleToggle = useCallback(() => {
    setOpen((prev) => !prev);
  }, []);

  const handleClose = useCallback(() => {
    setOpen(false);
  }, []);

  return (
    <>
      <NavItem
        item={data}
        depth={depth}
        open={open}
        active={active}
        externalLink={externalLink}
        onClick={handleToggle}
        config={config}
      />

      {hasChild && (
        <Collapse in={open} unmountOnExit>
          <NavSubList data={data.children} depth={depth} config={config} />
        </Collapse>
      )}
    </>
  );
}

// ----------------------------------------------------------------------

type NavListSubProps = {
  data: NavListProps[];
  depth: number;
  config: NavConfigProps;
};

function NavSubList({ data, depth, config }: NavListSubProps) {
  return (
    <>
      {data.map((list) => (
        <NavList
          key={list.title + list.path}
          data={list}
          depth={depth + 1}
          hasChild={!!list.children}
          config={config}
        />
      ))}
    </>
  );
}
