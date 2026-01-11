"use client";

import { useState } from "react";
import { UserDetails, AgencyComponent } from "@/lib/types";

interface SubmitStepProps {
  rephrasedRequest: string;
  briefDescription: string;
  agency: AgencyComponent;
  userDetails: UserDetails;
  onBack: () => void;
  onReset: () => void;
}

// Agency emails data - loaded from our scraped data
import agencyEmails from "@/data/agency-emails.json";

function findAgencyEmail(agencyId: string, agencyName: string): string | null {
  // Try to match by component ID first
  const byId = agencyEmails.find((a: { componentId: string; email: string }) => a.componentId === agencyId);
  if (byId && byId.email) {
    return byId.email;
  }

  // Try to match by name
  const byName = agencyEmails.find(
    (a: { name: string; email: string }) => a.name.toLowerCase() === agencyName.toLowerCase()
  );
  if (byName && byName.email) {
    return byName.email;
  }

  // Try partial name match
  const partialMatch = agencyEmails.find(
    (a: { name: string; email: string }) =>
      a.name.toLowerCase().includes(agencyName.toLowerCase()) ||
      agencyName.toLowerCase().includes(a.name.toLowerCase())
  );
  if (partialMatch && partialMatch.email) {
    return partialMatch.email;
  }

  return null;
}

export default function SubmitStep({
  rephrasedRequest,
  briefDescription,
  agency,
  userDetails,
  onBack,
  onReset,
}: SubmitStepProps) {
  const [submitted, setSubmitted] = useState(false);

  const agencyEmail = findAgencyEmail(agency.id, agency.name);

  const feeCategoryLabels: Record<string, string> = {
    commercial: "Commercial use requester",
    educational: "Educational institution",
    news_media: "Representative of the news media",
    other: "All other requesters",
  };

  const emailSubject = `FOIA Request - ${briefDescription}`;

  const emailBody = `Dear FOIA Officer,

Pursuant to the Freedom of Information Act, 5 U.S.C. § 552, I am requesting access to the following records:

${rephrasedRequest}

REQUESTER INFORMATION:
Name: ${userDetails.firstName} ${userDetails.lastName}
Email: ${userDetails.email}
${userDetails.phone ? `Phone: ${userDetails.phone}` : ""}
Address: ${userDetails.address.line1}${userDetails.address.line2 ? `, ${userDetails.address.line2}` : ""}, ${userDetails.address.city}, ${userDetails.address.state} ${userDetails.address.zip}

FEE CATEGORY:
${feeCategoryLabels[userDetails.feeCategory]}

FEE LIMITATION:
I am willing to pay up to $${userDetails.maxFee} for processing fees. If the estimated cost exceeds this amount, please contact me before proceeding.

${
  userDetails.feeWaiverRequested
    ? `FEE WAIVER REQUEST:
I am requesting a waiver of all fees associated with this request.
Justification: ${userDetails.feeWaiverReason || "Information will contribute significantly to public understanding."}`
    : ""
}

PREFERRED RESPONSE FORMAT:
I would prefer to receive records in electronic format (PDF or other common digital format) sent to my email address if possible.

Thank you for your consideration of this request. I look forward to your response within the statutory timeframe.

Sincerely,
${userDetails.firstName} ${userDetails.lastName}
${userDetails.email}
`;

  const handleSubmit = async () => {
    if (!agencyEmail) {
      // Open FOIA portal (can't pre-fill - no API available)
      const portalUrl = `https://www.foia.gov/request/agency-component/${agency.id}/`;
      window.open(portalUrl, '_blank');
      setSubmitted(true);
      return;
    }

    // Create Gmail compose URL
    const gmailUrl = `https://mail.google.com/mail/?view=cm&to=${encodeURIComponent(agencyEmail)}&su=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;

    // Open Gmail in new tab
    window.open(gmailUrl, '_blank');

    // Mark as submitted
    setSubmitted(true);
  };

  const [copiedField, setCopiedField] = useState<string | null>(null);

  const copyToClipboard = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 1500);
  };

  const CopyButton = ({ text, fieldName }: { text: string; fieldName: string }) => (
    <button
      onClick={() => copyToClipboard(text, fieldName)}
      className="ml-2 px-2 py-0.5 text-xs rounded border border-gray-500 text-gray-300 hover:bg-gray-600 flex-shrink-0"
    >
      {copiedField === fieldName ? "Copied!" : "Copy"}
    </button>
  );

  const CopyableField = ({ label, value, fieldName }: { label: string; value: string; fieldName: string }) => (
    <div className="flex items-center justify-between py-2 border-b border-gray-700">
      <div className="min-w-0 flex-1">
        <span className="text-gray-400 text-xs block">{label}</span>
        <span className="text-white text-sm truncate block">{value}</span>
      </div>
      <CopyButton text={value} fieldName={fieldName} />
    </div>
  );

  // Success state
  if (submitted) {
    // Portal submission success
    if (!agencyEmail) {
      return (
        <div className="space-y-6 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-yellow-900/50">
            <svg
              className="h-8 w-8 text-yellow-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">Portal Opened!</h2>
            <p className="mt-2 text-gray-400">
              The FOIA portal for {agency.name} should have opened in a new tab.
              Use the Copy buttons below to fill in each field.
            </p>
          </div>

          {/* Copyable Fields for reference */}
          <div className="rounded-lg bg-gray-700 p-4 text-left">
            <h3 className="font-medium text-white mb-3">Your Information (click Copy for each)</h3>
            <CopyableField label="First Name" value={userDetails.firstName} fieldName="firstName" />
            <CopyableField label="Last Name" value={userDetails.lastName} fieldName="lastName" />
            <CopyableField label="Email" value={userDetails.email} fieldName="email" />
            {userDetails.phone && (
              <CopyableField label="Phone" value={userDetails.phone} fieldName="phone" />
            )}
            <CopyableField label="Street Address" value={userDetails.address.line1} fieldName="address1" />
            {userDetails.address.line2 && (
              <CopyableField label="Address Line 2" value={userDetails.address.line2} fieldName="address2" />
            )}
            <CopyableField label="City" value={userDetails.address.city} fieldName="city" />
            <CopyableField label="State" value={userDetails.address.state} fieldName="state" />
            <CopyableField label="ZIP Code" value={userDetails.address.zip} fieldName="zip" />
          </div>

          <div className="rounded-lg bg-gray-700 p-4 text-left">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium text-white">Request Description</h3>
              <CopyButton text={rephrasedRequest} fieldName="description" />
            </div>
            <div className="max-h-32 overflow-y-auto whitespace-pre-wrap text-sm text-gray-300 bg-gray-800 p-3 rounded">
              {rephrasedRequest}
            </div>
          </div>

          <button
            onClick={onReset}
            className="w-full rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-blue-700"
          >
            Submit Another Request
          </button>
        </div>
      );
    }

    // Gmail submission success
    return (
      <div className="space-y-6 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-900/50">
          <svg
            className="h-8 w-8 text-green-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        <div>
          <h2 className="text-2xl font-bold text-white">Gmail Opened!</h2>
          <p className="mt-2 text-gray-400">
            Gmail should have opened in a new tab with your FOIA request ready to send.
            Just click Send in Gmail!
          </p>
        </div>

        <div className="rounded-lg bg-gray-700 p-4 text-left">
          <h3 className="font-medium text-white">What happens next?</h3>
          <ul className="mt-2 space-y-2 text-sm text-gray-300">
            <li className="flex items-start gap-2">
              <span className="text-blue-400">1.</span>
              Click Send in Gmail to submit the request.
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-400">2.</span>
              The agency will acknowledge your request within a few days.
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-400">3.</span>
              They have 20 business days to respond (though complex requests may
              take longer).
            </li>
          </ul>
        </div>

        <p className="text-sm text-gray-400">
          Email will be sent to: {agencyEmail}
        </p>

        <button
          onClick={onReset}
          className="w-full rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-blue-700"
        >
          Submit Another Request
        </button>
      </div>
    );
  }

  // Portal submission state (agency without email)
  if (!agencyEmail) {
    const fullAddress = `${userDetails.address.line1}${userDetails.address.line2 ? ', ' + userDetails.address.line2 : ''}, ${userDetails.address.city}, ${userDetails.address.state} ${userDetails.address.zip}`;

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-white">Submit via Portal</h2>
          <p className="mt-2 text-gray-400">
            {agency.name} requires portal submission. Copy each field below into the portal form.
          </p>
        </div>

        <div className="rounded-lg bg-yellow-900/30 border border-yellow-700 p-4">
          <div className="flex gap-3">
            <svg className="h-6 w-6 text-yellow-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="font-medium text-yellow-300">Manual Entry Required</p>
              <p className="mt-1 text-sm text-yellow-400">
                Click &quot;Copy&quot; next to each field, then paste into the portal form.
              </p>
            </div>
          </div>
        </div>

        {/* Copyable Fields */}
        <div className="rounded-lg border border-gray-600 p-4">
          <h3 className="text-sm font-medium text-gray-300 mb-2">Your Information</h3>
          <CopyableField label="First Name" value={userDetails.firstName} fieldName="firstName" />
          <CopyableField label="Last Name" value={userDetails.lastName} fieldName="lastName" />
          <CopyableField label="Email" value={userDetails.email} fieldName="email" />
          {userDetails.phone && (
            <CopyableField label="Phone" value={userDetails.phone} fieldName="phone" />
          )}
          <CopyableField label="Street Address" value={userDetails.address.line1} fieldName="address1" />
          {userDetails.address.line2 && (
            <CopyableField label="Address Line 2" value={userDetails.address.line2} fieldName="address2" />
          )}
          <CopyableField label="City" value={userDetails.address.city} fieldName="city" />
          <CopyableField label="State" value={userDetails.address.state} fieldName="state" />
          <CopyableField label="ZIP Code" value={userDetails.address.zip} fieldName="zip" />
        </div>

        {/* Request Description */}
        <div className="rounded-lg border border-gray-600 p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-300">Request Description</h3>
            <CopyButton text={rephrasedRequest} fieldName="description" />
          </div>
          <div className="max-h-32 overflow-y-auto whitespace-pre-wrap text-sm text-gray-300 bg-gray-700 p-3 rounded">
            {rephrasedRequest}
          </div>
        </div>

        {/* Navigation */}
        <div className="flex gap-3">
          <button
            onClick={onBack}
            className="flex-1 rounded-lg border border-gray-600 px-6 py-3 font-semibold text-gray-300 transition-colors hover:bg-gray-700"
          >
            Back
          </button>
          <button
            onClick={handleSubmit}
            className="flex-1 rounded-lg bg-yellow-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-yellow-700"
          >
            Open Portal
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Review & Submit</h2>
        <p className="mt-2 text-gray-400">
          Please review your FOIA request before submitting.
        </p>
      </div>

      {/* Request Summary */}
      <div className="space-y-4 rounded-lg border border-gray-600 p-4">
        <div>
          <h3 className="text-sm font-medium text-gray-400">Agency</h3>
          <p className="text-white">{agency.name}</p>
          <p className="text-sm text-gray-400">
            {agencyEmail}
          </p>
        </div>

        <div>
          <h3 className="text-sm font-medium text-gray-400">Your Request</h3>
          <p className="whitespace-pre-wrap text-gray-200">{rephrasedRequest}</p>
        </div>

        <div className="border-t border-gray-600 pt-4">
          <h3 className="text-sm font-medium text-gray-400">Your Information</h3>
          <div className="mt-2 grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-400">Name:</span>{" "}
              <span className="text-white">
                {userDetails.firstName} {userDetails.lastName}
              </span>
            </div>
            <div>
              <span className="text-gray-400">Email:</span>{" "}
              <span className="text-white">{userDetails.email}</span>
            </div>
            <div className="col-span-2">
              <span className="text-gray-400">Address:</span>{" "}
              <span className="text-white">
                {userDetails.address.line1}
                {userDetails.address.line2 && `, ${userDetails.address.line2}`},{" "}
                {userDetails.address.city}, {userDetails.address.state}{" "}
                {userDetails.address.zip}
              </span>
            </div>
            <div>
              <span className="text-gray-400">Fee Category:</span>{" "}
              <span className="text-white">
                {feeCategoryLabels[userDetails.feeCategory]}
              </span>
            </div>
            <div>
              <span className="text-gray-400">Max Fee:</span>{" "}
              <span className="text-white">${userDetails.maxFee}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Submission info */}
      <div className="rounded-lg bg-blue-900/50 p-4 text-blue-300">
        <p className="font-medium">How Submission Works</p>
        <p className="text-sm">
          Clicking submit will open Gmail in a new tab with everything
          filled in. Just click Send in Gmail to submit your request.
        </p>
      </div>

      {/* Navigation */}
      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="flex-1 rounded-lg border border-gray-600 px-6 py-3 font-semibold text-gray-300 transition-colors hover:bg-gray-700"
        >
          Back
        </button>
        <button
          onClick={handleSubmit}
          className="flex-1 rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-blue-700"
        >
          Open Gmail & Submit
        </button>
      </div>
    </div>
  );
}
