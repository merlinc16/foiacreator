// Fast parallel scraper for FOIA officer emails
// Run with: npx ts-node scripts/scrape-foia-emails-fast.ts

import { chromium } from "playwright";
import * as fs from "fs";

const FOIA_API_KEY = process.env.FOIA_API_KEY || "jdsseNsRvDsVcTaWoewwfXKykNrdSactU17JLFBn";
const PARALLEL_TABS = 10; // Number of concurrent tabs

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

async function fetchComponentIds(): Promise<string[]> {
  const componentIds: string[] = [];
  let pageNum = 0;
  let hasMore = true;

  console.log("Fetching all component IDs from API...");

  while (hasMore) {
    const offset = pageNum * 50;
    const url = `https://api.foia.gov/api/agency_components?page[limit]=50&page[offset]=${offset}`;

    try {
      const response = await fetch(url, {
        headers: {
          Accept: "application/json",
          "X-API-Key": FOIA_API_KEY,
        },
      });

      if (!response.ok) {
        console.log(`API error: ${response.status}`);
        hasMore = false;
        break;
      }

      const data = await response.json();
      const components = data.data || [];

      if (components.length === 0) {
        hasMore = false;
        break;
      }

      for (const comp of components) {
        componentIds.push(comp.id);
      }

      pageNum++;
    } catch (err) {
      console.log(`API error: ${err}`);
      hasMore = false;
    }
  }

  console.log(`Total component IDs: ${componentIds.length}`);
  return componentIds;
}

async function scrapeAgencyPage(
  page: ReturnType<Awaited<ReturnType<typeof chromium.launch>>["newPage"]> extends Promise<infer T> ? T : never,
  componentId: string
): Promise<AgencyEmail | null> {
  const url = `https://www.foia.gov/request/agency-component/${componentId}/`;

  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });
    await page.waitForTimeout(500);

    // Click on "Agency information" tab
    try {
      const agencyInfoTab = await page.$('text="Agency information"');
      if (agencyInfoTab) {
        await agencyInfoTab.click();
        await page.waitForTimeout(800);
      }
    } catch {
      // Tab might not exist
    }

    // Extract data
    const data = await page.evaluate(() => {
      let email = "";
      const pageText = document.body.innerText;

      // Look for mailto links, excluding generic portal one
      const emailLinks = document.querySelectorAll('a[href^="mailto:"]');
      for (const el of emailLinks) {
        const href = (el as HTMLAnchorElement).href;
        if (href.includes("@") && !href.includes("National.FOIAPortal")) {
          email = href.replace("mailto:", "").split("?")[0];
          break;
        }
      }

      // Look in text for agency-specific emails
      if (!email) {
        const emailMatch = pageText.match(/[\w.-]+@[\w.-]+\.(gov|mil|us)/gi);
        if (emailMatch && emailMatch.length > 0) {
          const agencyEmails = emailMatch.filter(
            (e) => !e.toLowerCase().includes("national.foiaportal")
          );
          if (agencyEmails.length > 0) {
            const foiaEmail = agencyEmails.find(
              (e) =>
                e.toLowerCase().includes("foia") ||
                e.toLowerCase().includes("request")
            );
            email = foiaEmail || agencyEmails[0];
          }
        }
      }

      const name = document.querySelector("h1")?.textContent?.trim() || "";

      return { name, email };
    });

    return {
      name: data.name,
      abbreviation: "",
      parentAgency: "",
      email: data.email,
      website: url,
      foiaOfficer: "",
      address: "",
      phone: "",
      componentId: componentId,
    };
  } catch (err) {
    return {
      name: "",
      abbreviation: "",
      parentAgency: "",
      email: "",
      website: url,
      foiaOfficer: "",
      address: "",
      phone: "",
      componentId: componentId,
    };
  }
}

async function scrapeInParallel(componentIds: string[]): Promise<AgencyEmail[]> {
  const agencies: AgencyEmail[] = [];

  console.log(`\nLaunching browser with ${PARALLEL_TABS} parallel tabs...`);
  const browser = await chromium.launch({ headless: true });

  try {
    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    });

    // Create multiple pages
    const pages = await Promise.all(
      Array.from({ length: PARALLEL_TABS }, () => context.newPage())
    );

    // Process in batches
    for (let i = 0; i < componentIds.length; i += PARALLEL_TABS) {
      const batch = componentIds.slice(i, i + PARALLEL_TABS);
      const progress = Math.round(((i + batch.length) / componentIds.length) * 100);
      console.log(`[${i + 1}-${i + batch.length}/${componentIds.length}] (${progress}%)`);

      const results = await Promise.all(
        batch.map((id, idx) => scrapeAgencyPage(pages[idx], id))
      );

      for (const result of results) {
        if (result) {
          agencies.push(result);
          if (result.email) {
            console.log(`  ${result.name}: ${result.email}`);
          }
        }
      }
    }

    // Close pages
    await Promise.all(pages.map((p) => p.close()));
  } finally {
    await browser.close();
  }

  return agencies;
}

async function main() {
  console.log("Starting fast FOIA email scraper...\n");

  const componentIds = await fetchComponentIds();

  if (componentIds.length === 0) {
    console.log("No component IDs found!");
    return;
  }

  const agencies = await scrapeInParallel(componentIds);

  // Save to JSON
  const outputPath = "./src/data/agency-emails.json";
  fs.mkdirSync("./src/data", { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(agencies, null, 2));

  console.log(`\nSaved ${agencies.length} agencies to ${outputPath}`);

  // Stats
  const withEmails = agencies.filter((a) => a.email);
  console.log(`\nAgencies with emails: ${withEmails.length}`);
  console.log(`Agencies without emails: ${agencies.length - withEmails.length}`);

  // Sample
  console.log("\nSample agencies with emails:");
  withEmails.slice(0, 20).forEach((a) => {
    console.log(`  ${a.name}: ${a.email}`);
  });
}

main().catch(console.error);
