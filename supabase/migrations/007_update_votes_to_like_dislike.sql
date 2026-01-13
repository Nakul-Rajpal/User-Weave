-- =====================================================
-- Update: Change vote types from approve/request_changes/comment to like/dislike
-- Purpose: Simplify voting system to just like/dislike
-- =====================================================

-- Step 1: Drop the old check constraint
ALTER TABLE public.final_version_votes
  DROP CONSTRAINT IF EXISTS final_version_votes_vote_check;

-- Step 2: Update existing votes to new format FIRST (before adding new constraint)
-- Map: approve -> like, request_changes -> dislike, comment -> dislike
UPDATE public.final_version_votes
SET vote = CASE
  WHEN vote = 'approve' THEN 'like'
  WHEN vote IN ('request_changes', 'comment') THEN 'dislike'
  ELSE vote
END
WHERE vote IN ('approve', 'request_changes', 'comment');

-- Step 3: Now add new check constraint for like/dislike only
ALTER TABLE public.final_version_votes
  ADD CONSTRAINT final_version_votes_vote_check
  CHECK (vote IN ('like', 'dislike'));

-- Update table comment
COMMENT ON TABLE public.final_version_votes IS 'Tracks user votes (like/dislike) on final versions during code review';
