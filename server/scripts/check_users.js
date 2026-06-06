import { supabase } from '../config/supabaseClient.js';

async function main() {
  const { data, error } = await supabase.from('profiles').select('*');
  if (error) {
    console.error('Error fetching profiles:', error);
  } else {
    console.log('Profiles currently in DB:', data);
  }
}

main();
