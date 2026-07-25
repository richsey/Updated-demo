import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://yghyepdssvhzaqjxdpfi.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlnaHllcGRzc3ZoemFxanhkcGZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3NzIwOTgsImV4cCI6MjA4OTM0ODA5OH0.e4FB10SOyxjS9ZyyntZ0gJ11bOWobo6ATbJlRylNkDE'
);

async function check() {
  const { data, error } = await supabase.from('profiles').select('*').limit(1);
  console.log('Error:', error);
  console.log('Data:', data);
}

check();
