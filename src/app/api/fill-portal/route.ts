import { NextRequest, NextResponse } from "next/server";
import { chromium } from "playwright";

interface FillPortalRequest {
  agencyId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  zip: string;
  requestDescription: string;
  feeWaiverRequested: boolean;
  feeWaiverReason?: string;
  maxFee: number;
  feeCategory: string;
}

// FBI component ID
const FBI_ID = "e366935f-20e1-4404-ac40-ed5518a5ce5a";

export async function POST(request: NextRequest) {
  try {
    const body: FillPortalRequest = await request.json();

    const {
      agencyId,
      firstName,
      lastName,
      email,
      phone,
      addressLine1,
      addressLine2,
      city,
      state,
      zip,
      requestDescription,
      feeWaiverRequested,
      feeWaiverReason,
      maxFee,
      feeCategory,
    } = body;

    if (!agencyId || !firstName || !lastName || !email || !requestDescription) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const isFBI = agencyId === FBI_ID;
    console.log(`Launching browser to fill FOIA portal for agency: ${agencyId} (FBI: ${isFBI})`);

    // Launch a VISIBLE browser (headless: false) so user can complete CAPTCHA
    const browser = await chromium.launch({
      headless: false,
      args: ["--start-maximized"],
    });

    const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    });

    const page = await context.newPage();

    // Navigate to the FOIA portal
    const portalUrl = `https://www.foia.gov/request/agency-component/${agencyId}/`;
    await page.goto(portalUrl, { waitUntil: "networkidle", timeout: 30000 });

    // Wait for the form to load
    await page.waitForTimeout(2000);

    // Map fee category to portal's dropdown index values
    // 0 = news media, 1 = educational, 2 = non-commercial scientific, 3 = commercial, 4 = all other
    const feeCategoryMap: Record<string, string> = {
      commercial: "3",
      educational: "1",
      news_media: "0",
      other: "4",
    };

    // Helper function to safely fill a field
    const safeFill = async (selector: string, value: string) => {
      try {
        const exists = await page.$(selector);
        if (exists) {
          await page.fill(selector, value);
          return true;
        }
      } catch (e) {
        console.log(`Could not fill ${selector}`);
      }
      return false;
    };

    // Helper function to safely select an option
    const safeSelect = async (selector: string, value: string) => {
      try {
        const exists = await page.$(selector);
        if (exists) {
          await page.selectOption(selector, value);
          return true;
        }
      } catch (e) {
        console.log(`Could not select ${selector}`);
      }
      return false;
    };

    try {
      // ============ STEP 1: Fill basic contact info ============
      await safeFill("#root_requester_contact_name_first", firstName);
      await safeFill("#root_requester_contact_name_last", lastName);
      await safeFill("#root_requester_contact_email", email);

      if (phone) {
        await safeFill("#root_requester_contact_phone_number", phone);
      }

      await safeFill("#root_requester_contact_address_line1", addressLine1);

      if (addressLine2) {
        await safeFill("#root_requester_contact_address_line2", addressLine2);
      }

      await safeFill("#root_requester_contact_address_city", city);
      await safeFill("#root_requester_contact_address_zip_postal_code", zip);

      // Standard form fields (non-FBI)
      await safeFill("#root_requester_contact_address_state_province", state);
      await safeSelect("#root_requester_contact_address_country", "246"); // United States

      // ============ STEP 2: Handle FBI-specific fields ============
      if (isFBI) {
        console.log("Filling FBI-specific fields...");

        // Address Type: 0 = Domestic - this reveals the state dropdown
        await safeSelect("#root_supporting_docs_fbi_address_type", "0");
        await page.waitForTimeout(500);

        // Now fill FBI state dropdown (appears after selecting Domestic)
        // Need to find the state value - it's a select with state names
        const stateMap: Record<string, string> = {
          "AL": "0", "AK": "1", "AZ": "2", "AR": "3", "CA": "4", "CO": "5", "CT": "6", "DE": "7",
          "DC": "8", "FL": "9", "GA": "10", "HI": "11", "ID": "12", "IL": "13", "IN": "14", "IA": "15",
          "KS": "16", "KY": "17", "LA": "18", "ME": "19", "MD": "20", "MA": "21", "MI": "22", "MN": "23",
          "MS": "24", "MO": "25", "MT": "26", "NE": "27", "NV": "28", "NH": "29", "NJ": "30", "NM": "31",
          "NY": "32", "NC": "33", "ND": "34", "OH": "35", "OK": "36", "OR": "37", "PA": "38", "RI": "39",
          "SC": "40", "SD": "41", "TN": "42", "TX": "43", "UT": "44", "VT": "45", "VA": "46", "WA": "47",
          "WV": "48", "WI": "49", "WY": "50"
        };
        const stateIndex = stateMap[state.toUpperCase()] || "0";
        await safeSelect("#root_supporting_docs_fbi_state_domestic", stateIndex);
        await page.waitForTimeout(300);

        // Request Subject: 0 = Myself, 1 = Deceased, 2 = All Other
        await safeSelect("#root_supporting_docs_fbi_request_subject", "2"); // All Other Subjects
        await page.waitForTimeout(500);

        // Requester Type: 0 = Myself, 1 = Organization
        await safeSelect("#root_supporting_docs_fbi_requester_type", "0");
        await page.waitForTimeout(500);

        // Now the request description field should be visible
        await safeFill("#root_supporting_docs_fbi_request_description", requestDescription);

        // Perjury confirmation: 0 = Yes
        await safeSelect("#root_supporting_docs_fbi_citizen_confirm", "0");
        await page.waitForTimeout(300);

        // Signature (typed) - use full name
        await safeFill("#root_supporting_docs_fbi_citizen_signature", `${firstName} ${lastName}`);

        // Today's date in MM/DD/YYYY format
        const today = new Date();
        const dateStr = `${String(today.getMonth() + 1).padStart(2, "0")}/${String(today.getDate()).padStart(2, "0")}/${today.getFullYear()}`;
        await safeFill("#root_supporting_docs_fbi_citizen_today", dateStr);

        console.log("FBI-specific fields filled.");
      } else {
        // Standard form: fill request description
        await safeFill("#root_request_description_request_description", requestDescription);
      }

      // ============ STEP 3: Fee and processing options ============
      await safeSelect("#root_processing_fees_request_category", feeCategoryMap[feeCategory] || "4");

      if (feeWaiverRequested) {
        await safeSelect("#root_processing_fees_fee_waiver", "1");
        await page.waitForTimeout(500);
        if (feeWaiverReason) {
          await safeFill("#root_processing_fees_fee_waiver_explanation", feeWaiverReason);
        }
      } else {
        await safeSelect("#root_processing_fees_fee_waiver", "0");
      }

      await safeFill("#root_processing_fees_fee_amount_willing", maxFee.toString());
      await safeSelect("#root_expedited_processing_expedited_processing", "0");

      console.log("Form filled successfully. User needs to complete CAPTCHA.");

    } catch (fillError) {
      console.error("Error filling some fields:", fillError);
    }

    // Don't close the browser - leave it open for user to complete CAPTCHA

    return NextResponse.json({
      success: true,
      message: "Browser opened and form pre-filled. Complete the CAPTCHA and click Submit.",
    });

  } catch (error) {
    console.error("Fill portal error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to open portal",
      },
      { status: 500 }
    );
  }
}
