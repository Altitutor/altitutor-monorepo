-- Enable real-time for student_payment_methods table
-- This allows the frontend to subscribe to changes via Supabase Realtime

-- Add table to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.student_payment_methods;

COMMENT ON TABLE public.student_payment_methods IS 'Payment methods for students. Real-time enabled for live updates.';

