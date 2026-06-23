'use client';
import { useEffect } from 'react';
import { useStore } from '@/lib/store';

export default function FirebaseSyncProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { startSync, stopSync } = useStore();

  useEffect(() => {
    startSync();
    return () => stopSync();
  }, [startSync, stopSync]);

  return <>{children}</>;
}
