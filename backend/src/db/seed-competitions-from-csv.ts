import { pool } from "../config/database";
import * as fs from "fs";
import * as path from "path";

interface CompetitionDescription {
  no: string;
  name: string;
  description: string;
}

interface CompetitionRound {
  roundName: string;
  roundType: string;
  startDate?: string;
  deadline?: string;
  examDate?: string;
  resultsDate?: string;
  fee: number;
  location?: string;
}

interface Competition {
  name: string;
  organizerName: string;
  category: string;
  gradeLevel: string;
  websiteUrl?: string;
  registrationStatus: string;
  isInternational: boolean;
  detailedDescription?: string;
  rounds: CompetitionRound[];
}

/**
 * Parse CSV file into array of objects
 * Handles multi-line quoted fields correctly
 */
function parseCSV(filePath: string): string[][] {
  const content = fs.readFileSync(filePath, "utf-8");
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = "";
  let inQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    const nextChar = content[i + 1];

    if (char === '"') {
      // Handle escaped quotes ("")
      if (inQuotes && nextChar === '"') {
        currentField += '"';
        i++; // Skip next quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      // End of field
      currentRow.push(currentField.trim());
      currentField = "";
    } else if (char === "\n" && !inQuotes) {
      // End of row
      currentRow.push(currentField.trim());
      if (currentRow.length > 0) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentField = "";

      // Handle \r\n line endings
      if (nextChar === "\r") {
        i++;
      }
    } else if (char === "\r" && nextChar === "\n" && !inQuotes) {
      // Windows line ending - skip \r, \n will be handled next
      continue;
    } else {
      currentField += char;
    }
  }

  // Add final field and row if exists
  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.length > 0) {
      rows.push(currentRow);
    }
  }

  return rows;
}

/**
 * Parse competition descriptions from desc.csv
 */
function parseDescriptions(filePath: string): Map<string, string> {
  const rows = parseCSV(filePath);
  const descriptions = new Map<string, string>();

  for (const row of rows) {
    if (row.length >= 5 && row[2] && row[3] && row[4]) {
      const no = row[2].trim();
      const name = row[3].trim();
      const description = row[4].trim();

      if (no && name && description && no !== "No.") {
        // Extract just the competition name (remove website URL in parentheses)
        const cleanName = name.replace(/\s*\([^)]*\)/, "").trim();
        descriptions.set(cleanName, description);
      }
    }
  }

  return descriptions;
}

/**
 * Parse fee string to number
 */
function parseFee(feeStr: string): number {
  if (!feeStr || feeStr.toLowerCase() === "free" || feeStr.toLowerCase().includes("gratis")) {
    return 0;
  }

  // Remove currency symbols and commas
  const cleaned = feeStr.replace(/[Rp£$,\s]/g, "");

  // Handle ranges (take the lower value)
  if (cleaned.includes("-")) {
    const parts = cleaned.split("-");
    return parseInt(parts[0]) || 0;
  }

  // Handle "Est." estimates
  if (cleaned.toLowerCase().includes("est")) {
    const match = cleaned.match(/\d+/);
    return match ? parseInt(match[0]) : 0;
  }

  return parseInt(cleaned) || 0;
}

/**
 * Parse date string to ISO format
 */
function parseDate(dateStr: string): string | undefined {
  if (!dateStr || dateStr.trim() === "" || dateStr.toLowerCase() === "tbd") {
    return undefined;
  }

  // Handle multiple dates (take the first one)
  if (dateStr.includes("\n") || dateStr.includes("&")) {
    const firstDate = dateStr.split(/[\n&]/)[0].trim();
    return parseDate(firstDate);
  }

  try {
    // Try to parse various date formats
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return date.toISOString();
    }
  } catch {
    // Ignore parse errors
  }

  return undefined;
}

/**
 * Check if registration status is valid
 */
function isValidStatus(status: string): boolean {
  const validStatuses = ["On Going", "Closed", "Coming Soon"];
  return validStatuses.includes(status);
}

/**
 * Parse main catalog CSV
 */
function parseKatalog(filePath: string, descriptions: Map<string, string>): Competition[] {
  const rows = parseCSV(filePath);
  const competitions: Competition[] = [];
  let currentComp: Competition | null = null;

  // Find header row (starts with "Registration Status")
  let startIndex = 0;
  for (let i = 0; i < rows.length; i++) {
    if (rows[i][0]?.includes("Registration Status")) {
      startIndex = i + 1;
      break;
    }
  }

  console.log(`📍 Starting parsing from row ${startIndex}`);

  for (let i = startIndex; i < rows.length; i++) {
    const row = rows[i];

    // Skip completely empty rows
    if (row.every(cell => !cell || cell.trim() === "")) continue;

    const status = row[0]?.trim();
    const no = row[1]?.trim();
    const name = row[2]?.trim();
    const grades = row[4]?.trim();
    const category = row[5]?.trim();
    const roundName = row[6]?.trim();
    const examType = row[7]?.trim();
    const startReg = row[8]?.trim();
    const deadline = row[9]?.trim();
    const examDate = row[10]?.trim();
    const resultsDate = row[11]?.trim();
    const fee = row[12]?.trim();
    const regLink = row[13]?.trim();

    // Check if this is a header/separator row
    const isHeaderRow =
      name?.includes("Name & Logo") ||
      name?.includes("Affiliated Competitions") ||
      (no && no.includes("No."));

    // Check if this is an invalid name (but not an additional round row)
    const isInvalidName =
      name &&
      (name === "000,," ||
        name.startsWith("000") ||
        name.length < 3 ||
        name.includes("which takes place") ||
        name.includes("ultimately fostering"));

    // Skip if it's a header row or has an invalid name
    if (isHeaderRow || isInvalidName) {
      continue;
    }

    // Check if this is a new competition (has a valid number and name)
    // Number should be 1-2 digits, not "000" or empty
    const isValidNo = no && /^\d{1,2}$/.test(no) && parseInt(no) > 0;

    if (isValidNo && name) {
      // Validate or default status
      let validStatus = status;
      if (!status || !isValidStatus(status)) {
        validStatus = "Coming Soon"; // Default for missing/invalid status
        console.log(`  ⚠️  Row ${i}: Invalid status "${status}", defaulting to "Coming Soon"`);
      }

      // Save previous competition if exists
      if (currentComp) {
        competitions.push(currentComp);
      }

      // Determine if international (from row ~66 onwards is affiliated/international section)
      const isInternational = name.toLowerCase().includes("international") ||
                              name.toLowerCase().includes("global") ||
                              name.toLowerCase().includes("olympiad") ||
                              i >= 66;

      // Start new competition
      currentComp = {
        name: name.trim(),
        organizerName: "Competzy",
        category: category || "General",
        gradeLevel: grades || "1-12",
        websiteUrl: regLink,
        registrationStatus: validStatus as "On Going" | "Closed" | "Coming Soon",
        isInternational,
        detailedDescription: descriptions.get(name.split("(")[0].trim()),
        rounds: [],
      };

      // Add first round if present
      if (roundName && examType) {
        currentComp.rounds.push({
          roundName: roundName.trim(),
          roundType: examType.trim() as "Online" | "On-site",
          startDate: parseDate(startReg),
          deadline: parseDate(deadline),
          examDate: parseDate(examDate),
          resultsDate: parseDate(resultsDate),
          fee: parseFee(fee),
        });
      }
    } else if (currentComp && roundName && examType) {
      // This is an additional round for the current competition
      currentComp.rounds.push({
        roundName: roundName.trim(),
        roundType: examType.trim() as "Online" | "On-site",
        startDate: parseDate(startReg),
        deadline: parseDate(deadline),
        examDate: parseDate(examDate),
        resultsDate: parseDate(resultsDate),
        fee: parseFee(fee),
      });
    }
  }

  // Don't forget the last competition
  if (currentComp) {
    competitions.push(currentComp);
  }

  return competitions;
}

/**
 * Clear existing competitions and rounds
 */
async function clearCompetitions() {
  console.log("🗑️  Clearing existing competitions...");
  await pool.query("DELETE FROM competition_rounds");
  await pool.query("DELETE FROM competitions");
  console.log("✅ Cleared existing data");
}

/**
 * Generate a readable competition ID slug
 */
function generateCompId(name: string, index: number): string {
  // Create slug from name (lowercase, remove special chars, limit length)
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .substring(0, 40);

  return `comp-${index + 1}-${slug}`;
}

/**
 * Insert competitions and rounds into database
 */
async function insertCompetitions(competitions: Competition[]) {
  console.log(`📝 Inserting ${competitions.length} competitions...`);

  for (let i = 0; i < competitions.length; i++) {
    const comp = competitions[i];
    try {
      // Generate readable ID
      const compId = generateCompId(comp.name, i);

      // Insert competition
      await pool.query(
        `INSERT INTO competitions (
          id, name, organizer_name, category, grade_level,
          website_url, registration_status, is_international,
          detailed_description, round_count,
          fee, reg_open_date, reg_close_date, competition_date
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
        [
          compId,
          comp.name,
          comp.organizerName,
          comp.category,
          comp.gradeLevel,
          comp.websiteUrl,
          comp.registrationStatus,
          comp.isInternational,
          comp.detailedDescription,
          comp.rounds.length,
          comp.rounds[0]?.fee || 0, // Main fee from first round
          comp.rounds[0]?.startDate,
          comp.rounds[0]?.deadline,
          comp.rounds[0]?.examDate,
        ]
      );

      // Insert rounds
      for (let i = 0; i < comp.rounds.length; i++) {
        const round = comp.rounds[i];
        await pool.query(
          `INSERT INTO competition_rounds (
            comp_id, round_name, round_type, start_date,
            registration_deadline, exam_date, results_date,
            fee, round_order
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            compId,
            round.roundName,
            round.roundType,
            round.startDate,
            round.deadline,
            round.examDate,
            round.resultsDate,
            round.fee,
            i + 1,
          ]
        );
      }

      console.log(`  ✓ ${comp.name} (${comp.rounds.length} rounds)`);
    } catch (error) {
      console.error(`  ✗ Failed to insert ${comp.name}:`, error);
    }
  }

  console.log("✅ Competitions inserted successfully");
}

/**
 * Main seed function
 */
async function main() {
  try {
    console.log("🌱 Starting competition seed from CSV files...\n");

    // File paths (user Downloads folder)
    const descPath = "/Users/mujtabo/Downloads/Eduversal Competition Catalog (Last Updated_ 23 Oct 2025) - desc.csv";
    const katalogPath = "/Users/mujtabo/Downloads/Eduversal Competition Catalog (Last Updated_ 23 Oct 2025) - Katalog.csv";

    // Check if files exist
    if (!fs.existsSync(descPath)) {
      throw new Error(`Description file not found: ${descPath}`);
    }
    if (!fs.existsSync(katalogPath)) {
      throw new Error(`Catalog file not found: ${katalogPath}`);
    }

    // Parse CSV files
    console.log("📖 Parsing description file...");
    const descriptions = parseDescriptions(descPath);
    console.log(`   Found ${descriptions.size} descriptions`);

    console.log("📖 Parsing catalog file...");
    const competitions = parseKatalog(katalogPath, descriptions);
    console.log(`   Found ${competitions.length} competitions\n`);

    // Clear and insert
    await clearCompetitions();
    await insertCompetitions(competitions);

    console.log("\n✨ Seed completed successfully!");
    console.log(`📊 Summary: ${competitions.length} competitions with ${competitions.reduce((sum, c) => sum + c.rounds.length, 0)} total rounds`);

    process.exit(0);
  } catch (error) {
    console.error("❌ Seed failed:", error);
    process.exit(1);
  }
}

main();
