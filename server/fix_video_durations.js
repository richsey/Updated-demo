import { createClient } from "@supabase/supabase-js";
import axios from "axios";
import dotenv from "dotenv";
import { fileURLToPath } from 'url';
import path from 'path';

// Load environment variables from the server folder
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../server/.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing Supabase credentials. Make sure server/.env contains SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function fetchYoutubeDuration(url) {
  try {
    const response = await axios.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
      }
    });
    
    let match = response.data.match(/"approxDurationMs"\s*:\s*"(\d+)"/);
    if (!match) {
      match = response.data.match(/"approxDurationMs"\s*:\s*(\d+)/);
    }
    
    if (match) {
      const durationMs = parseInt(match[1], 10);
      return Math.ceil(durationMs / 60000);
    }
  } catch (error) {
    console.error(`Failed to fetch duration for ${url}:`, error.message);
  }
  return null;
}

async function run() {
  console.log("Starting video duration migration...");

  const { data: materials, error } = await supabase
    .from("materials")
    .select("id, title, url, duration_minutes, type")
    .eq("type", "video");

  if (error) {
    console.error("Failed to fetch materials:", error.message);
    return;
  }

  console.log(`Found ${materials.length} video materials. Analysing...`);

  let updatedCount = 0;

  for (const mat of materials) {
    if (!mat.url) continue;

    const isYoutube = mat.url.includes("youtube.com") || mat.url.includes("youtu.be");
    
    if (isYoutube) {
      const actualDuration = await fetchYoutubeDuration(mat.url);
      
      if (actualDuration && actualDuration !== mat.duration_minutes) {
        console.log(`Updating "${mat.title}": ${mat.duration_minutes} min -> ${actualDuration} min`);
        
        const { error: updateError } = await supabase
          .from("materials")
          .update({ duration_minutes: actualDuration })
          .eq("id", mat.id);
          
        if (updateError) {
          console.error(`Failed to update ${mat.id}:`, updateError.message);
        } else {
          updatedCount++;
        }
      } else if (actualDuration === mat.duration_minutes) {
        console.log(`Skipping "${mat.title}": already correct at ${actualDuration} min`);
      } else {
        console.log(`Skipping "${mat.title}": couldn't extract duration from YouTube.`);
      }
    } else {
      console.log(`Skipping "${mat.title}": not a YouTube URL.`);
    }
    
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log(`\nMigration complete. Updated ${updatedCount} materials.`);
}

run();
