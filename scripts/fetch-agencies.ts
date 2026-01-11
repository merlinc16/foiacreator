// Script to fetch all agencies and their FOIA email addresses from foia.gov API
// Run with: npx ts-node scripts/fetch-agencies.ts

const FOIA_API_KEY = process.env.FOIA_API_KEY || "";
const FOIA_API_BASE = "https://api.foia.gov/api";

interface AgencyData {
  id: string;
  name: string;
  abbreviation: string;
  parentAgency: string;
  parentAbbreviation: string;
  emails: string[];
  website: string;
  address: string;
}

async function fetchAllAgencies(): Promise<AgencyData[]> {
  const allAgencies: AgencyData[] = [];
  let page = 0;
  let hasMore = true;

  console.log("Fetching all agencies from foia.gov...");

  while (hasMore) {
    const offset = page * 50;
    const url = `${FOIA_API_BASE}/agency_components?include=agency&page[limit]=50&page[offset]=${offset}`;

    console.log(`Fetching page ${page + 1}...`);

    const response = await fetch(url, {
      headers: {
        "X-API-Key": FOIA_API_KEY,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      console.error(`Error fetching page ${page + 1}: ${response.status}`);
      break;
    }

    const data = await response.json();
    const components = data.data || [];
    const included = data.included || [];

    if (components.length === 0) {
      hasMore = false;
      break;
    }

    for (const comp of components) {
      const attrs = comp.attributes || {};
      const agencyId = comp.relationships?.agency?.data?.id;
      const parentAgency = included.find((inc: { id: string }) => inc.id === agencyId);

      const emails = attrs.emails || [];
      // Also check for submission_address email patterns
      const submissionEmails = attrs.submission_address?.email ? [attrs.submission_address.email] : [];
      // Check for FOIA officer email
      const foiaOfficerEmail = attrs.foia_officer?.email ? [attrs.foia_officer.email] : [];
      // Check request_form URL for email patterns
      const requestFormEmail = attrs.request_form?.email ? [attrs.request_form.email] : [];

      const allEmails = [...new Set([...emails, ...submissionEmails, ...foiaOfficerEmail, ...requestFormEmail])].filter(Boolean);

      const agency: AgencyData = {
        id: comp.id,
        name: attrs.title || "Unknown",
        abbreviation: attrs.abbreviation || "",
        parentAgency: parentAgency?.attributes?.name || "",
        parentAbbreviation: parentAgency?.attributes?.abbreviation || "",
        emails: allEmails,
        website: attrs.website?.uri || attrs.request_form?.uri || "",
        address: formatAddress(attrs.submission_address),
      };

      allAgencies.push(agency);
    }

    page++;

    // Rate limiting
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  console.log(`\nTotal agencies fetched: ${allAgencies.length}`);

  // Stats
  const withEmails = allAgencies.filter((a) => a.emails.length > 0);
  console.log(`Agencies with email addresses: ${withEmails.length}`);
  console.log(`Agencies without email addresses: ${allAgencies.length - withEmails.length}`);

  return allAgencies;
}

function formatAddress(addr: { address_lines?: string[]; city?: string; state?: string; zip?: string } | undefined): string {
  if (!addr) return "";
  const lines = addr.address_lines || [];
  const city = addr.city || "";
  const state = addr.state || "";
  const zip = addr.zip || "";
  return [...lines, `${city}, ${state} ${zip}`].filter(Boolean).join(", ");
}

async function main() {
  if (!FOIA_API_KEY) {
    console.error("Error: FOIA_API_KEY environment variable not set");
    console.log("Run with: FOIA_API_KEY=your-key npx ts-node scripts/fetch-agencies.ts");
    process.exit(1);
  }

  const agencies = await fetchAllAgencies();

  // Save to JSON file
  const fs = await import("fs");
  const outputPath = "./src/data/agencies.json";

  // Create data directory if it doesn't exist
  fs.mkdirSync("./src/data", { recursive: true });

  fs.writeFileSync(outputPath, JSON.stringify(agencies, null, 2));
  console.log(`\nSaved to ${outputPath}`);

  // Print some examples with emails
  console.log("\nSample agencies with emails:");
  const samples = agencies.filter((a) => a.emails.length > 0).slice(0, 10);
  for (const agency of samples) {
    console.log(`  - ${agency.name}: ${agency.emails.join(", ")}`);
  }
}

main().catch(console.error);
