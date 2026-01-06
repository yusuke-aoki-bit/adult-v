'use client';

import { useState, useEffect, useCallback } from 'react';

// Constants
const STORAGE_KEY = 'adult-v-scene-info';
const VOTE_HISTORY_KEY = 'adult-v-vote-history';
const MAX_LABEL_LENGTH = 100;
const MAX_DESCRIPTION_LENGTH = 500;
const MAX_TIMESTAMP_SECONDS = 24 * 60 * 60; // 24 hours max

export interface SceneMarker {
  id: string;
  timestamp: number; // seconds
  endTimestamp?: number; // seconds (optional end time)
  label: string;
  description?: string;
  rating: number; // 1-5
  votes: number;
  userId?: string; // for tracking who submitted
  createdAt: string;
}

export interface ProductSceneInfo {
  productId: number;
  scenes: SceneMarker[];
  totalDuration?: number | undefined;
  averageSceneRating: number;
  bestScene?: SceneMarker | undefined;
}

// SSR-safe localStorage access
function getStoredSceneInfo(): Record<number, ProductSceneInfo> {
  if (typeof window === 'undefined') return {};
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

// Save scene info to localStorage with error feedback
function saveSceneInfo(data: Record<number, ProductSceneInfo>): boolean {
  if (typeof window === 'undefined') return false;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch (error) {
    console.error('Failed to save scene info:', error);
    return false;
  }
}

// Helper to recalculate stats
function recalculateStats(scenes: SceneMarker[]): { averageSceneRating: number; bestScene: SceneMarker | undefined } {
  if (scenes.length === 0) {
    return { averageSceneRating: 0, bestScene: undefined };
  }

  const averageSceneRating = scenes.reduce((sum, s) => sum + s.rating, 0) / scenes.length;
  const bestScene = scenes.reduce(
    (best, s) => (!best || s.rating > best.rating ? s : best),
    undefined as SceneMarker | undefined
  );

  return { averageSceneRating, bestScene };
}

// Sanitize text input to prevent XSS
function sanitizeText(text: string, maxLength: number): string {
  return text
    .slice(0, maxLength)
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .trim();
}

// Vote history management (prevents duplicate votes)
function getVoteHistory(): Record<string, 'up' | 'down'> {
  if (typeof window === 'undefined') return {};
  try {
    const stored = localStorage.getItem(VOTE_HISTORY_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

function saveVoteHistory(history: Record<string, 'up' | 'down'>): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(VOTE_HISTORY_KEY, JSON.stringify(history));
  } catch (error) {
    console.error('Failed to save vote history:', error);
  }
}

export function hasVoted(sceneId: string): 'up' | 'down' | null {
  const history = getVoteHistory();
  return history[sceneId] || null;
}

function recordVote(sceneId: string, direction: 'up' | 'down'): void {
  const history = getVoteHistory();
  history[sceneId] = direction;
  saveVoteHistory(history);
}

function clearVote(sceneId: string): void {
  const history = getVoteHistory();
  delete history[sceneId];
  saveVoteHistory(history);
}

export function useSceneInfo(productId: number) {
  const [sceneInfo, setSceneInfo] = useState<ProductSceneInfo | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load scene info for this product (SSR-safe)
  useEffect(() => {
    const allSceneInfo = getStoredSceneInfo();
    setSceneInfo(allSceneInfo[productId] || null);
    setIsLoaded(true);
  }, [productId]);

  // Add a new scene marker (immutable)
  const addScene = useCallback((scene: Omit<SceneMarker, 'id' | 'votes' | 'createdAt'>) => {
    const allSceneInfo = getStoredSceneInfo();
    const current = allSceneInfo[productId] || {
      productId,
      scenes: [],
      averageSceneRating: 0,
    };

    const sanitizedDescription = scene.description ? sanitizeText(scene.description, MAX_DESCRIPTION_LENGTH) : undefined;
    const newScene: SceneMarker = {
      timestamp: scene.timestamp,
      label: sanitizeText(scene.label || 'Scene', MAX_LABEL_LENGTH),
      rating: scene.rating,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
      votes: 1,
      createdAt: new Date().toISOString(),
      ...(scene.endTimestamp !== undefined && { endTimestamp: scene.endTimestamp }),
      ...(sanitizedDescription !== undefined && { description: sanitizedDescription }),
      ...(scene.userId !== undefined && { userId: scene.userId }),
    };

    const newScenes = [...current.scenes, newScene].sort((a, b) => a.timestamp - b.timestamp);
    const stats = recalculateStats(newScenes);

    const updatedInfo: ProductSceneInfo = {
      ...current,
      scenes: newScenes,
      ...stats,
    };

    allSceneInfo[productId] = updatedInfo;
    saveSceneInfo(allSceneInfo);
    setSceneInfo(updatedInfo);

    return newScene;
  }, [productId]);

  // Vote on a scene (immutable - no direct state mutation)
  // Returns: 'voted' | 'toggled' | 'already_voted' | 'failed'
  const voteScene = useCallback((sceneId: string, upvote: boolean): 'voted' | 'toggled' | 'already_voted' | 'failed' => {
    const allSceneInfo = getStoredSceneInfo();
    const current = allSceneInfo[productId];
    if (!current) return 'failed';

    const direction = upvote ? 'up' : 'down';
    const previousVote = hasVoted(sceneId);

    // If user already voted in the same direction, don't allow
    if (previousVote === direction) {
      return 'already_voted';
    }

    // Calculate vote change
    let voteChange = upvote ? 1 : -1;

    // If toggling vote (e.g., from up to down), need to reverse previous vote too
    if (previousVote !== null) {
      voteChange = upvote ? 2 : -2; // Undo previous vote + apply new vote
    }

    // Create new scenes array with immutable update
    const newScenes = current.scenes.map((s) =>
      s.id === sceneId
        ? { ...s, votes: Math.max(0, s.votes + voteChange) }
        : s
    );

    const updatedInfo: ProductSceneInfo = {
      ...current,
      scenes: newScenes,
    };

    allSceneInfo[productId] = updatedInfo;
    saveSceneInfo(allSceneInfo);
    setSceneInfo(updatedInfo);

    // Record the vote
    recordVote(sceneId, direction);

    return previousVote !== null ? 'toggled' : 'voted';
  }, [productId]);

  // Remove a scene (immutable)
  const removeScene = useCallback((sceneId: string) => {
    const allSceneInfo = getStoredSceneInfo();
    const current = allSceneInfo[productId];
    if (!current) return;

    const newScenes = current.scenes.filter((s) => s.id !== sceneId);
    const stats = recalculateStats(newScenes);

    const updatedInfo: ProductSceneInfo = {
      ...current,
      scenes: newScenes,
      ...stats,
    };

    allSceneInfo[productId] = updatedInfo;
    saveSceneInfo(allSceneInfo);
    setSceneInfo(updatedInfo);
  }, [productId]);

  return {
    sceneInfo,
    isLoaded,
    addScene,
    voteScene,
    removeScene,
    hasScenes: (sceneInfo?.scenes.length || 0) > 0,
    getVoteStatus: hasVoted,
  };
}

// Format timestamp to MM:SS or HH:MM:SS
export function formatTimestamp(seconds: number): string {
  const safeSeconds = Math.max(0, Math.min(seconds, MAX_TIMESTAMP_SECONDS));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const secs = Math.floor(safeSeconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

// Parse timestamp string to seconds with validation
export function parseTimestamp(str: string): number | null {
  const trimmed = str.trim();
  if (!trimmed) return null;

  const parts = trimmed.split(':').map(Number);
  if (parts.some(isNaN) || parts.some(n => n < 0)) return null;

  let totalSeconds: number;

  if (parts.length === 2) {
    const minutes = parts[0]!;
    const seconds = parts[1]!;
    if (seconds >= 60) return null; // Invalid seconds
    totalSeconds = minutes * 60 + seconds;
  } else if (parts.length === 3) {
    const hours = parts[0]!;
    const minutes = parts[1]!;
    const seconds = parts[2]!;
    if (minutes >= 60 || seconds >= 60) return null; // Invalid time
    totalSeconds = hours * 3600 + minutes * 60 + seconds;
  } else {
    return null;
  }

  // Validate reasonable range (max 24 hours)
  if (totalSeconds > MAX_TIMESTAMP_SECONDS) return null;

  return totalSeconds;
}
