import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);
async function run() {
  try {
    const { data, error } = await supabase.from('recommendations').select('*');
    if (error) console.error("DB Error:", error.message);
    else console.log(JSON.stringify(data, null, 2));
  } catch (e) {
    console.error("No recommendations table maybe?", e.message);
  }
}
run();
