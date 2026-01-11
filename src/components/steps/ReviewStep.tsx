"use client";

import { useState, useMemo } from "react";
import { RephraseResponse, AgencyComponent } from "@/lib/types";
import agencyEmails from "@/data/agency-emails.json";

interface ReviewStepProps {
  rephraseResponse: RephraseResponse;
  onContinue: (editedRequest: string, agency: AgencyComponent) => void;
  onBack: () => void;
}

// Convert our scraped data to AgencyComponent format
interface ScrapedAgency {
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

const allAgencies: AgencyComponent[] = (agencyEmails as ScrapedAgency[])
  .filter(a => a.email && a.email.length > 0)
  .map(a => ({
    id: a.componentId,
    name: a.name,
    abbreviation: a.abbreviation,
    agency: {
      id: a.componentId,
      name: a.parentAgency || a.name,
      abbreviation: a.abbreviation,
    },
    emails: [a.email],
  }));

export default function ReviewStep({
  rephraseResponse,
  onContinue,
  onBack,
}: ReviewStepProps) {
  const [editedRequest, setEditedRequest] = useState(rephraseResponse.rephrased);
  const [agencySearch, setAgencySearch] = useState(rephraseResponse.suggestedAgency || "");
  const [showResults, setShowResults] = useState(true);

  // Filter agencies based on search
  const filteredAgencies = useMemo(() => {
    if (!agencySearch.trim()) return allAgencies.slice(0, 20);
    const search = agencySearch.toLowerCase();
    return allAgencies
      .filter(a =>
        a.name.toLowerCase().includes(search) ||
        a.abbreviation?.toLowerCase().includes(search) ||
        a.agency.name.toLowerCase().includes(search)
      )
      .slice(0, 20);
  }, [agencySearch]);

  // Local state for selected agency - initialized to first match
  const [localSelectedAgency, setLocalSelectedAgency] = useState<AgencyComponent | null>(() => {
    if (!rephraseResponse.suggestedAgency) return allAgencies[0] || null;
    const search = rephraseResponse.suggestedAgency.toLowerCase();
    const match = allAgencies.find(a =>
      a.name.toLowerCase().includes(search) ||
      a.abbreviation?.toLowerCase().includes(search) ||
      a.agency.name.toLowerCase().includes(search)
    );
    return match || allAgencies[0] || null;
  });

  const handleAgencyClick = (agency: AgencyComponent) => {
    setLocalSelectedAgency(agency);
    setShowResults(false);
    setAgencySearch(agency.name);
  };

  const handleContinue = () => {
    if (localSelectedAgency && editedRequest.trim()) {
      onContinue(editedRequest, localSelectedAgency);
    }
  };

  const canContinue = localSelectedAgency !== null && editedRequest.trim().length > 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">
          Review Your Request
        </h2>
        <p className="mt-2 text-gray-400">
          We&apos;ve rephrased your request into proper FOIA language. Feel free to
          edit it if needed.
        </p>
      </div>

      {/* Original Query */}
      <div className="rounded-lg bg-gray-700 p-4">
        <p className="text-sm font-medium text-gray-400">Your original request:</p>
        <p className="mt-1 text-gray-200">&quot;{rephraseResponse.original}&quot;</p>
      </div>

      {/* Rephrased Request */}
      <div className="space-y-2">
        <label
          htmlFor="rephrasedRequest"
          className="block text-sm font-medium text-gray-300"
        >
          FOIA Request (editable)
        </label>
        <textarea
          id="rephrasedRequest"
          rows={8}
          value={editedRequest}
          onChange={(e) => setEditedRequest(e.target.value)}
          className="w-full rounded-lg border border-gray-600 bg-gray-700 px-4 py-3 text-white focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        />
      </div>

      {/* Agency Selection */}
      <div className="space-y-2">
        <label
          htmlFor="agencySearch"
          className="block text-sm font-medium text-gray-300"
        >
          Select Agency ({allAgencies.length} agencies accept email)
        </label>
        <div className="relative">
          <input
            id="agencySearch"
            type="text"
            value={agencySearch}
            onChange={(e) => {
              setAgencySearch(e.target.value);
              setShowResults(true);
            }}
            onFocus={() => setShowResults(true)}
            placeholder="Search for an agency..."
            className="w-full rounded-lg border border-gray-600 bg-gray-700 px-4 py-3 text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />

          {/* Search Results Dropdown */}
          {showResults && filteredAgencies.length > 0 && (
            <div className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-gray-600 bg-gray-700 shadow-lg">
              {filteredAgencies.map((agency) => (
                <button
                  key={agency.id}
                  type="button"
                  onClick={() => handleAgencyClick(agency)}
                  className={`w-full px-4 py-3 text-left hover:bg-gray-600 ${
                    localSelectedAgency?.id === agency.id ? "bg-gray-600" : ""
                  }`}
                >
                  <div className="font-medium text-white">{agency.name}</div>
                  <div className="text-sm text-gray-400">
                    {agency.agency.name} • {agency.emails?.[0]}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Selected Agency */}
        {localSelectedAgency && (
          <div className="mt-2 rounded-lg border border-green-700 bg-green-900/50 p-3">
            <div className="flex items-center gap-2">
              <svg
                className="h-5 w-5 text-green-400"
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
              <span className="font-medium text-green-300">
                {localSelectedAgency.name}
              </span>
            </div>
            <p className="mt-1 text-sm text-green-400">
              Email: {localSelectedAgency.emails?.[0]}
            </p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex-1 rounded-lg border border-gray-600 px-6 py-3 font-semibold text-gray-300 transition-colors hover:bg-gray-700"
        >
          Back
        </button>
        <button
          type="button"
          onClick={handleContinue}
          disabled={!canContinue}
          className="flex-1 rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-600"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
