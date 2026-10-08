import { useEffect, useRef, useState } from 'react';
import { useDebouncedValue } from './useDebouncedValue';

// Search box that updates instantly while the URL (and so the request) follows once typing
// pauses. `urlSearch` only seeds the box; later URL changes never overwrite what is typed.
export function useDebouncedSearch(urlSearch: string, onSearch: (value: string) => void) {
  const [input, setInput] = useState(urlSearch);
  const debounced = useDebouncedValue(input);
  const lastSent = useRef(urlSearch);

  // `onSearch` changes identity on every render. Reading it through a ref keeps the effect
  // below tied to the debounced text only, so a stale value can never overwrite the URL.
  const onSearchRef = useRef(onSearch);
  useEffect(() => {
    onSearchRef.current = onSearch;
  });

  useEffect(() => {
    const next = debounced.trim();
    if (next !== lastSent.current) {
      lastSent.current = next;
      onSearchRef.current(next);
    }
  }, [debounced]);

  // Clears the box and records it as already sent, so the debounce does not re-apply old text.
  const reset = () => {
    lastSent.current = '';
    setInput('');
  };

  return { input, setInput, reset };
}
