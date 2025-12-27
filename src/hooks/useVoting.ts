/**
 * Hook for real-time voting synchronization via Firebase
 */

import { useState, useEffect, useCallback } from 'react';
import { ref, onValue, update, get } from 'firebase/database';
import { database } from '../utils/firebase-config';

const QUIZ_SESSIONS_PATH = 'quiz_sessions';

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
    
    const votesRef = ref(database, `${QUIZ_SESSIONS_PATH}/${sessionId}/votes/${slideId}`);
    
    const unsubscribe = onValue(votesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setVotes(data);
      } else {
        setVotes({});
      }
      setIsLoading(false);
    }, (err) => {
      console.error('Error fetching votes:', err);
      setError('Nepodařilo se načíst hlasování');
      setIsLoading(false);
    });
    
    return () => {
      unsubscribe();
    };
  }, [sessionId, slideId]);
  
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
      const voteRef = ref(database, `${QUIZ_SESSIONS_PATH}/${sessionId}/votes/${slideId}/${currentUserId}`);
      
      const voteData: VoteData = {
        oderId: currentUserId,
        selectedOptions: optionIds,
        votedAt: Date.now(),
        voterName: currentUserName,
      };
      
      await update(voteRef, voteData);
    } catch (err) {
      console.error('Error voting:', err);
      throw err;
    }
  }, [sessionId, slideId, currentUserId, currentUserName]);
  
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

