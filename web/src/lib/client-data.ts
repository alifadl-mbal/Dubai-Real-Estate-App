"use client";

import { useEffect, useState } from "react";

export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

// Tiny fetch cache for the static JSON files: each file is requested once per page load.
const cache = new Map<string, Promise<unknown>>();

export function loadJson<T>(file: string): Promise<T> {
  if (!cache.has(file)) {
    cache.set(
      file,
      fetch(`${BASE_PATH}/data/${file}`).then((r) => {
        if (!r.ok) throw new Error(`${file}: ${r.status}`);
        return r.json();
      }),
    );
  }
  return cache.get(file) as Promise<T>;
}

export function useJson<T>(file: string | null) {
  const [state, setState] = useState<{ file: string | null; data: T | null; error: Error | null }>(
    { file: null, data: null, error: null },
  );
  useEffect(() => {
    if (!file) return;
    let live = true;
    loadJson<T>(file)
      .then((data) => live && setState({ file, data, error: null }))
      .catch((error: Error) => live && setState({ file, data: null, error }));
    return () => {
      live = false;
    };
  }, [file]);
  // Never hand back data that belongs to a previous file.
  return state.file === file ? state : { file, data: null, error: null };
}
