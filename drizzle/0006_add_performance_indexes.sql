-- Performance indexes for ActiveCAMT website
-- Phase 1: Add indexes to speed up common query patterns

-- Attendance: compound index for scan lookups (eventId + studentId)
CREATE INDEX IF NOT EXISTS idx_attendance_event_student ON attendance(event_id, student_id);

-- Attendance: student lookup for user registration queries
CREATE INDEX IF NOT EXISTS idx_attendance_student ON attendance(student_id);

-- Attendance: check-in time for today's checkins count
CREATE INDEX IF NOT EXISTS idx_attendance_checkin_time ON attendance(check_in_time);

-- Score history: event lookup for award-points
CREATE INDEX IF NOT EXISTS idx_score_history_event ON score_history(event_id);

-- Users: profile completion for individual leaderboard
CREATE INDEX IF NOT EXISTS idx_users_profile_completed ON users(profile_completed);

-- Users: house membership for house member counts
CREATE INDEX IF NOT EXISTS idx_users_house_id ON users(house_id);

-- Session: user ID lookup for session resolution
CREATE INDEX IF NOT EXISTS idx_session_userid ON session("userId");

-- Account: user ID lookup for account resolution
CREATE INDEX IF NOT EXISTS idx_account_userid ON account("userId");
