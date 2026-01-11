// Script to scrape FOIA officer emails from foia.gov
// Run with: npx ts-node scripts/scrape-foia-emails.ts

import { chromium } from "playwright";
import * as fs from "fs";

const FOIA_API_KEY = process.env.FOIA_API_KEY || "jdsseNsRvDsVcTaWoewwfXKykNrdSactU17JLFBn";

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

      console.log(`  Page ${pageNum + 1}: ${components.length} components`);
      pageNum++;
      await new Promise((r) => setTimeout(r, 100));
    } catch (err) {
      console.log(`API error: ${err}`);
      hasMore = false;
    }
  }

  console.log(`Total component IDs: ${componentIds.length}`);
  return componentIds;
}

async function scrapeAgencyEmails(): Promise<AgencyEmail[]> {
  const agencies: AgencyEmail[] = [];

  // First get all component IDs from API
  const componentIds = await fetchComponentIds();

  if (componentIds.length === 0) {
    console.log("No component IDs found!");
    return [];
  }

  console.log("\nLaunching browser to scrape emails from each agency page...");
  const browser = await chromium.launch({
    headless: true,
  });

  try {
    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    });

    const page = await context.newPage();

    // Visit each agency's request page and click "Agency information" tab
    for (let i = 0; i < componentIds.length; i++) {
      const componentId = componentIds[i];
      const url = `https://www.foia.gov/request/agency-component/${componentId}/`;

      console.log(`[${i + 1}/${componentIds.length}] Scraping: ${componentId}`);

      try {
        await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
        await page.waitForTimeout(1000);

        // Click on "Agency information" tab to see email
        try {
          const agencyInfoTab = await page.$('text="Agency information"');
          if (agencyInfoTab) {
            await agencyInfoTab.click();
            await page.waitForTimeout(1500);
          }
        } catch (e) {
          // Tab might not exist, continue
        }

        // Take screenshot of first few for debugging
        if (i < 3) {
          await page.screenshot({ path: `./agency-${i + 1}-info-screenshot.png` });
          console.log(`  Screenshot saved to ./agency-${i + 1}-info-screenshot.png`);
        }

        // Extract email and agency info from page
        const data = await page.evaluate(() => {
          let email = "";
          const pageText = document.body.innerText;

          // Look for mailto links, but exclude the generic foia.gov one
          const emailLinks = document.querySelectorAll('a[href^="mailto:"]');
          for (const el of emailLinks) {
            const href = (el as HTMLAnchorElement).href;
            if (href.includes("@") && !href.includes("National.FOIAPortal")) {
              email = href.replace("mailto:", "").split("?")[0];
              break;
            }
          }

          // Look in page text for agency-specific email patterns
          if (!email) {
            // Look for gov emails excluding the generic portal one
            const emailMatch = pageText.match(/[\w.-]+@[\w.-]+\.(gov|mil|us)/gi);
            if (emailMatch && emailMatch.length > 0) {
              // Filter out the generic portal email
              const agencyEmails = emailMatch.filter(
                (e) => !e.toLowerCase().includes("national.foiaportal")
              );
              if (agencyEmails.length > 0) {
                // Prefer FOIA-related emails
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

          // Look for FOIA Officer or Service Center info
          let foiaOfficer = "";
          const officerMatch = pageText.match(
            /(?:FOIA (?:Officer|Contact|Public Liaison)|Service Center)[:\s]+([A-Za-z\s.-]+?)(?:\n|$)/i
          );
          if (officerMatch) {
            foiaOfficer = officerMatch[1].trim();
          }

          // Look for phone
          let phone = "";
          const phoneMatch = pageText.match(/\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
          if (phoneMatch) {
            phone = phoneMatch[0];
          }

          // Look for address
          let address = "";
          const addressMatch = pageText.match(
            /(?:\d+[^,\n]+,\s*)?[A-Za-z\s]+,\s*[A-Z]{2}\s+\d{5}/
          );
          if (addressMatch) {
            address = addressMatch[0];
          }

          return { name, email, foiaOfficer, phone, address };
        });

        const agency: AgencyEmail = {
          name: data.name,
          abbreviation: "",
          parentAgency: "",
          email: data.email,
          website: url,
          foiaOfficer: data.foiaOfficer,
          address: data.address,
          phone: data.phone,
          componentId: componentId,
        };

        agencies.push(agency);

        if (data.email) {
          console.log(`  ${data.name}: ${data.email}`);
        } else {
          console.log(`  ${data.name}: No email found`);
        }

        // Rate limiting
        await page.waitForTimeout(200);
      } catch (err) {
        console.log(`  Error: ${err}`);
      }
    }
  } finally {
    await browser.close();
  }

  return agencies;
}

async function main() {
  console.log("Starting FOIA email scraper...\n");

  const agencies = await scrapeAgencyEmails();

  // Save to JSON
  const outputPath = "./src/data/agency-emails.json";
  fs.mkdirSync("./src/data", { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(agencies, null, 2));

  console.log(`\nSaved ${agencies.length} agencies to ${outputPath}`);

  // Stats
  const withEmails = agencies.filter((a) => a.email);
  console.log(`\nAgencies with emails: ${withEmails.length}`);
  console.log(`Agencies without emails: ${agencies.length - withEmails.length}`);

  // Sample with emails
  console.log("\nSample agencies with emails:");
  withEmails.slice(0, 20).forEach((a) => {
    console.log(`  ${a.name}: ${a.email}`);
  });
}

main().catch(console.error);
