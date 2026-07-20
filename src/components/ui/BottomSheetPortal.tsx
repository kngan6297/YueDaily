import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

type PortalContextValue = {
  mount: (id: string, node: React.ReactNode) => void;
  unmount: (id: string) => void;
};

const BottomSheetPortalContext = createContext<PortalContextValue | null>(null);

/**
 * Host render bottom sheet ở cấp root (trong SafeAreaProvider).
 * Modal che lên tab bar app; padding đáy chỉ dùng inset navbar hệ thống.
 */
export function BottomSheetPortalProvider({ children }: { children: React.ReactNode }) {
  const [entries, setEntries] = useState<Map<string, React.ReactNode>>(new Map());

  const mount = useCallback((id: string, node: React.ReactNode) => {
    setEntries((prev) => {
      const next = new Map(prev);
      next.set(id, node);
      return next;
    });
  }, []);

  const unmount = useCallback((id: string) => {
    setEntries((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const value = useMemo(() => ({ mount, unmount }), [mount, unmount]);

  return (
    <BottomSheetPortalContext.Provider value={value}>
      {children}
      {[...entries.entries()].map(([id, node]) => (
        <React.Fragment key={id}>{node}</React.Fragment>
      ))}
    </BottomSheetPortalContext.Provider>
  );
}

export function useBottomSheetPortal() {
  return useContext(BottomSheetPortalContext);
}
