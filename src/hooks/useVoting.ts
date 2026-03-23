import { useState, useEffect, useCallback } from 'react';
import {
  getPreferredSessionBackend,
  listSessionVotes,
  SessionBackend,
  SessionKind,
  upsertSessionVote,
} from '../utils/live-session-repository';
import { supabase } from '../utils/supabase/client';

export interface VoteData {
  oderId: string;
  selectedOptions: string[]; // Array of option IDs
  votedAt: number;
  voterName?: string;
}

interface UseVotingOptions {
  sessionId: string | null;
  slideId: string;
  currentUserId?: string;
  currentUserName?: string;
  sessionType?: SessionKind;
  backend?: SessionBackend;
}

interface UseVotingReturn {
  votes: Record<string, VoteData>; // keyed by oderId
  hasVoted: boolean;
  myVote: string[] | null;
  isLoading: boolean;
  error: string | null;
  vote: (optionIds: string[]) => Promise<void>;
  getVoteCounts: () => Record<string, number>;
  getTotalVotes: () => number;
}

export function useVoting({
  sessionId,
  slideId,
  currentUserId,
  currentUserName,
  sessionType = 'live',
  backend = getPreferredSessionBackend(),
}: UseVotingOptions): UseVotingReturn {
  const [votes, setVotes] = useState<Record<string, VoteData>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Subscribe to votes changes
  useEffect(() => {
    if (!sessionId || !slideId) {
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    const channel = supabase
      .channel(`session-votes:${sessionId}:${slideId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'live_session_votes', filter: `session_public_id=eq.${sessionId}` }, async () => {
        try {
          const nextVotes = await listSessionVotes(backend, sessionId, sessionType, slideId);
          setVotes(nextVotes);
          setIsLoading(false);
        } catch (err) {
          console.error('Error refreshing Supabase votes:', err);
          setError('Nepodařilo se načíst hlasování');
          setIsLoading(false);
        }
      })
      .subscribe();

    listSessionVotes(backend, sessionId, sessionType, slideId)
      .then((nextVotes) => setVotes(nextVotes))
      .catch((err) => {
        console.error('Error fetching Supabase votes:', err);
        setError('Nepodařilo se načíst hlasování');
      })
      .finally(() => setIsLoading(false));

    return () => {
      supabase.removeChannel(channel);
    };
  }, [backend, sessionId, sessionType, slideId]);
  
  // Check if current user has voted
  const hasVoted = currentUserId ? !!votes[currentUserId] : false;
  const myVote = currentUserId && votes[currentUserId] ? votes[currentUserId].selectedOptions : null;
  
  // Vote function
  const vote = useCallback(async (optionIds: string[]) => {
    if (!sessionId || !slideId || !currentUserId) {
      console.error('Cannot vote: missing sessionId, slideId, or userId');
      return;
    }
    
    try {
      await upsertSessionVote(backend, sessionId, slideId, currentUserId, optionIds, currentUserName);
    } catch (err) {
      console.error('Error voting:', err);
      throw err;
    }
  }, [backend, sessionId, slideId, currentUserId, currentUserName]);
  
  // Get vote counts per option
  const getVoteCounts = useCallback(() => {
    const counts: Record<string, number> = {};
    
    Object.values(votes).forEach(vote => {
      vote.selectedOptions.forEach(optionId => {
        counts[optionId] = (counts[optionId] || 0) + 1;
      });
    });
    
    return counts;
  }, [votes]);
  
  // Get total number of unique voters
  const getTotalVotes = useCallback(() => {
    return Object.keys(votes).length;
  }, [votes]);
  
  return {
    votes,
    hasVoted,
    myVote,
    isLoading,
    error,
    vote,
    getVoteCounts,
    getTotalVotes,
  };
}

export default useVoting;

