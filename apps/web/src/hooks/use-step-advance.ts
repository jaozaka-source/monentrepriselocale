import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router';
import { advanceStep } from '@/lib/client-steps';
import { useClientData } from '@/components/espace/client-data-context';

export function useStepAdvance() {
  const { refresh } = useClientData();
  const navigate = useNavigate();
  const [advancing, setAdvancing] = useState(false);
  const [error, setError] = useState('');

  const advance = useCallback(
    async (comment?: string) => {
      setAdvancing(true);
      setError('');
      try {
        const { current_step } = await advanceStep(comment);
        await refresh();
        navigate(`/espace/etapes/${current_step}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Une erreur est survenue.');
        setAdvancing(false);
      }
    },
    [refresh, navigate],
  );

  return { advance, advancing, error };
}
