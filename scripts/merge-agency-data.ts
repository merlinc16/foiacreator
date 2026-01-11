// Merge API agency data with scraped emails
// Run with: npx ts-node scripts/merge-agency-data.ts

import * as fs from "fs";

const FOIA_API_KEY = "jdsseNsRvDsVcTaWoewwfXKykNrdSactU17JLFBn";

interface AgencyEmail {
  name: string;
  abbreviation: string;
  parentAgency: string;
  email: string;
  website: string;
  foiaOfficer: string;
  address: string;
  phone: string;
  componentId: string;
}

async function fetchAgencyData(): Promise<Map<string, Partial<AgencyEmail>>> {
  const agencies = new Map<string, Partial<AgencyEmail>>();
  let pageNum = 0;
  let hasMore = true;

  console.log("Fetching agency details from API...");

  while (hasMore) {
    const offset = pageNum * 50;
    const url = `https://api.foia.gov/api/agency_components?include=agency&page[limit]=50&page[offset]=${offset}`;

    try {
      const response = await fetch(url, {
        headers: {
          Accept: "application/json",
          "X-API-Key": FOIA_API_KEY,
        },
      });

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
        const parentAgency = included.find(
          (inc: { id: string }) => inc.id === agencyId
        );

        agencies.set(comp.id, {
          name: attrs.title || "Unknown",
          abbreviation: attrs.abbreviation || "",
          parentAgency: parentAgency?.attributes?.name || "",
          foiaOfficer: attrs.foia_officer?.name || "",
          phone: attrs.foia_officer?.phone || attrs.public_liaison?.phone || "",
          address: formatAddress(attrs.submission_address),
          website: attrs.website?.uri || "",
        });
      }

      console.log(`  Page ${pageNum + 1}: ${components.length} components`);
      pageNum++;
    } catch (err) {
      console.log(`API error: ${err}`);
      hasMore = false;
    }
  }

  return agencies;
}

function formatAddress(
  addr: { address_lines?: string[]; city?: string; state?: string; zip?: string } | undefined
): string {
  if (!addr) return "";
  const lines = addr.address_lines || [];
  const city = addr.city || "";
  const state = addr.state || "";
  const zip = addr.zip || "";
  return [...lines, `${city}, ${state} ${zip}`].filter(Boolean).join(", ");
}

async function main() {
  // Load scraped emails
  const scrapedPath = "./src/data/agency-emails.json";
  const scraped: AgencyEmail[] = JSON.parse(fs.readFileSync(scrapedPath, "utf-8"));
  console.log(`Loaded ${scraped.length} scraped entries`);

  // Fetch API data
  const apiData = await fetchAgencyData();
  console.log(`Fetched ${apiData.size} API entries`);

  // Merge: use API data for names/details, keep scraped emails
  const merged: AgencyEmail[] = [];

  for (const entry of scraped) {
    const apiEntry = apiData.get(entry.componentId);

    if (apiEntry) {
      merged.push({
        name: apiEntry.name || entry.name,
        abbreviation: apiEntry.abbreviation || entry.abbreviation,
        parentAgency: apiEntry.parentAgency || entry.parentAgency,
        email: entry.email, // Keep scraped email
        website: entry.website || apiEntry.website || "",
        foiaOfficer: apiEntry.foiaOfficer || entry.foiaOfficer,
        address: apiEntry.address || entry.address,
        phone: apiEntry.phone || entry.phone,
        componentId: entry.componentId,
      });
    } else {
      merged.push(entry);
    }
  }

  // Save merged data
  fs.writeFileSync(scrapedPath, JSON.stringify(merged, null, 2));
  console.log(`\nSaved ${merged.length} merged entries to ${scrapedPath}`);

  // Stats
  const withEmails = merged.filter((a) => a.email);
  const withNames = merged.filter((a) => a.name && a.name !== "FOIA.gov");
  console.log(`\nAgencies with emails: ${withEmails.length}`);
  console.log(`Agencies with proper names: ${withNames.length}`);

  // Sample
  console.log("\nSample merged entries:");
  withEmails.slice(0, 15).forEach((a) => {
    console.log(`  ${a.name}: ${a.email}`);
  });
}

main().catch(console.error);
