import { useDeferredValue, useEffect, useState } from 'react';

import type { ReactElement } from 'react';

import { useSearch, useUiActions } from '@/store';
import { Input } from '@/ui';

/** The field echoes keystrokes at once; the grid filters on the deferred value, off the urgent path. */
export function SearchBox(): ReactElement {
  const search = useSearch();
  const { setSearch } = useUiActions();
  const [draft, setDraft] = useState(search);
  const deferredDraft = useDeferredValue(draft);

  useEffect(() => {
    setSearch(deferredDraft);
  }, [deferredDraft, setSearch]);

  return (
    <Input
      type="search"
      label="Search nodes by ID"
      placeholder="Search node ID"
      value={draft}
      onValueChange={setDraft}
    />
  );
}
