import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

const DEFAULT_TARGET_PCT = 20;

export interface UseSettingsResult {
  targetCostPct: number;
  save: (pct: number) => Promise<string | null>;
}

export function useSettings(enabled: boolean): UseSettingsResult {
  const [targetCostPct, setTargetCostPct] = useState(DEFAULT_TARGET_PCT);
  const [rowId, setRowId] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    void supabase
      .from('settings')
      .select('id, target_cost_pct')
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled && data) {
          setRowId(data.id as string);
          setTargetCostPct(Number(data.target_cost_pct));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  const save = useCallback(
    async (pct: number): Promise<string | null> => {
      if (rowId !== null) {
        const { error } = await supabase
          .from('settings')
          .update({ target_cost_pct: pct })
          .eq('id', rowId);
        if (error) return error.message;
      } else {
        const { data, error } = await supabase
          .from('settings')
          .insert({ target_cost_pct: pct })
          .select('id')
          .single();
        if (error) return error.message;
        setRowId((data as { id: string }).id);
      }
      setTargetCostPct(pct);
      return null;
    },
    [rowId],
  );

  return { targetCostPct, save };
}
