import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const env = fs.readFileSync(".env.local", "utf8");
for (const line of env.split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2];
}

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const { data, error } = await supabase.from("universities").select("id, official_name, official_website, country_code, ror_id");
if (error) { console.error(error); process.exit(1); }

// Check dup by normalized name
const byName = new Map();
for (const u of data) {
  const key = u.official_name.trim().toLowerCase();
  if (!byName.has(key)) byName.set(key, []);
  byName.get(key).push(u);
}
console.log("=== Duplicate by exact normalized name ===");
let dupCount = 0;
for (const [key, rows] of byName) {
  if (rows.length > 1) { dupCount++; console.log(key, rows.map(r=>r.id)); }
}
console.log("Total name-dup groups:", dupCount);

// Check dup by domain
function domain(url) {
  if (!url) return null;
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return null; }
}
const byDomain = new Map();
for (const u of data) {
  const d = domain(u.official_website);
  if (!d) continue;
  if (!byDomain.has(d)) byDomain.set(d, []);
  byDomain.get(d).push(u);
}
console.log("");
console.log("=== Duplicate by domain ===");
let domDup = 0;
for (const [key, rows] of byDomain) {
  if (rows.length > 1) { domDup++; console.log(key, rows.map(r=>`${r.official_name}(${r.id})`)); }
}
console.log("Total domain-dup groups:", domDup);

// null ror_id count
console.log("");
console.log("Total universities:", data.length);
console.log("Missing ror_id:", data.filter(u => !u.ror_id).length);
console.log("Missing official_website:", data.filter(u => !u.official_website).length);
