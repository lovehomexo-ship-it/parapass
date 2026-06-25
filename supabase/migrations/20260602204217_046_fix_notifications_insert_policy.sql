/*
  # Fix notifications insert policy

  ## Problem
  The current INSERT policy only allows users to insert notifications
  targeting themselves (user_id = auth.uid()). This prevents parachutistes
  from sending validation request notifications to moniteurs.

  ## Changes
  - Drop the overly restrictive insert policy
  - Add a permissive insert policy: any authenticated user can create
    a notification for any other user (needed for validation requests,
    delegation alerts, etc.)
  - The SELECT/UPDATE policies already ensure each user can only read
    and modify their own notifications
*/

DROP POLICY IF EXISTS "Users can insert notifications targeting themselves" ON notifications;

CREATE POLICY "Authenticated users can insert notifications"
  ON notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (true);
