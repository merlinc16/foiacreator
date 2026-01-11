"use client";

import { useState } from "react";
import { UserDetails } from "@/lib/types";

interface DetailsStepProps {
  initialDetails: UserDetails | null;
  onSubmit: (details: UserDetails) => void;
  onBack: () => void;
}

const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY", "DC"
];

const DEFAULT_DETAILS: UserDetails = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  address: {
    line1: "",
    line2: "",
    city: "",
    state: "",
    zip: "",
  },
  feeCategory: "other",
  maxFee: 25,
  feeWaiverRequested: false,
  feeWaiverReason: "",
};

export default function DetailsStep({
  initialDetails,
  onSubmit,
  onBack,
}: DetailsStepProps) {
  const [details, setDetails] = useState<UserDetails>(
    initialDetails || DEFAULT_DETAILS
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!details.firstName.trim()) newErrors.firstName = "First name is required";
    if (!details.lastName.trim()) newErrors.lastName = "Last name is required";
    if (!details.email.trim()) newErrors.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(details.email)) {
      newErrors.email = "Invalid email address";
    }
    if (!details.address.line1.trim()) newErrors.line1 = "Address is required";
    if (!details.address.city.trim()) newErrors.city = "City is required";
    if (!details.address.state) newErrors.state = "State is required";
    if (!details.address.zip.trim()) newErrors.zip = "ZIP code is required";
    if (details.feeWaiverRequested && !details.feeWaiverReason?.trim()) {
      newErrors.feeWaiverReason = "Please explain why you qualify for a fee waiver";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      onSubmit(details);
    }
  };

  const updateAddress = (field: keyof UserDetails["address"], value: string) => {
    setDetails((prev) => ({
      ...prev,
      address: { ...prev.address, [field]: value },
    }));
  };

  const inputClass = (hasError: boolean) =>
    `mt-1 w-full rounded-lg border px-4 py-2 bg-gray-700 text-white placeholder-gray-400 ${
      hasError ? "border-red-500" : "border-gray-600"
    } focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20`;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Your Details</h2>
        <p className="mt-2 text-gray-400">
          We need some information about you to complete your FOIA request.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Name */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="firstName"
              className="block text-sm font-medium text-gray-300"
            >
              First Name *
            </label>
            <input
              id="firstName"
              type="text"
              value={details.firstName}
              onChange={(e) =>
                setDetails((prev) => ({ ...prev, firstName: e.target.value }))
              }
              className={inputClass(!!errors.firstName)}
            />
            {errors.firstName && (
              <p className="mt-1 text-sm text-red-400">{errors.firstName}</p>
            )}
          </div>
          <div>
            <label
              htmlFor="lastName"
              className="block text-sm font-medium text-gray-300"
            >
              Last Name *
            </label>
            <input
              id="lastName"
              type="text"
              value={details.lastName}
              onChange={(e) =>
                setDetails((prev) => ({ ...prev, lastName: e.target.value }))
              }
              className={inputClass(!!errors.lastName)}
            />
            {errors.lastName && (
              <p className="mt-1 text-sm text-red-400">{errors.lastName}</p>
            )}
          </div>
        </div>

        {/* Contact */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-300"
            >
              Email *
            </label>
            <input
              id="email"
              type="email"
              value={details.email}
              onChange={(e) =>
                setDetails((prev) => ({ ...prev, email: e.target.value }))
              }
              className={inputClass(!!errors.email)}
            />
            {errors.email && (
              <p className="mt-1 text-sm text-red-400">{errors.email}</p>
            )}
          </div>
          <div>
            <label
              htmlFor="phone"
              className="block text-sm font-medium text-gray-300"
            >
              Phone (optional)
            </label>
            <input
              id="phone"
              type="tel"
              value={details.phone}
              onChange={(e) =>
                setDetails((prev) => ({ ...prev, phone: e.target.value }))
              }
              className={inputClass(false)}
            />
          </div>
        </div>

        {/* Address */}
        <div className="space-y-4">
          <div>
            <label
              htmlFor="line1"
              className="block text-sm font-medium text-gray-300"
            >
              Street Address *
            </label>
            <input
              id="line1"
              type="text"
              value={details.address.line1}
              onChange={(e) => updateAddress("line1", e.target.value)}
              className={inputClass(!!errors.line1)}
            />
            {errors.line1 && (
              <p className="mt-1 text-sm text-red-400">{errors.line1}</p>
            )}
          </div>
          <div>
            <label
              htmlFor="line2"
              className="block text-sm font-medium text-gray-300"
            >
              Address Line 2 (optional)
            </label>
            <input
              id="line2"
              type="text"
              value={details.address.line2}
              onChange={(e) => updateAddress("line2", e.target.value)}
              placeholder="Apt, Suite, Unit, etc."
              className={inputClass(false)}
            />
          </div>
          <div className="grid grid-cols-6 gap-4">
            <div className="col-span-3">
              <label
                htmlFor="city"
                className="block text-sm font-medium text-gray-300"
              >
                City *
              </label>
              <input
                id="city"
                type="text"
                value={details.address.city}
                onChange={(e) => updateAddress("city", e.target.value)}
                className={inputClass(!!errors.city)}
              />
              {errors.city && (
                <p className="mt-1 text-sm text-red-400">{errors.city}</p>
              )}
            </div>
            <div className="col-span-1">
              <label
                htmlFor="state"
                className="block text-sm font-medium text-gray-300"
              >
                State *
              </label>
              <select
                id="state"
                value={details.address.state}
                onChange={(e) => updateAddress("state", e.target.value)}
                className={`mt-1 w-full rounded-lg border px-3 py-2 bg-gray-700 text-white ${
                  errors.state ? "border-red-500" : "border-gray-600"
                } focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20`}
              >
                <option value="">--</option>
                {US_STATES.map((state) => (
                  <option key={state} value={state}>
                    {state}
                  </option>
                ))}
              </select>
              {errors.state && (
                <p className="mt-1 text-sm text-red-400">{errors.state}</p>
              )}
            </div>
            <div className="col-span-2">
              <label
                htmlFor="zip"
                className="block text-sm font-medium text-gray-300"
              >
                ZIP Code *
              </label>
              <input
                id="zip"
                type="text"
                value={details.address.zip}
                onChange={(e) => updateAddress("zip", e.target.value)}
                className={inputClass(!!errors.zip)}
              />
              {errors.zip && (
                <p className="mt-1 text-sm text-red-400">{errors.zip}</p>
              )}
            </div>
          </div>
        </div>

        {/* Fee Category */}
        <div>
          <label className="block text-sm font-medium text-gray-300">
            Fee Category
          </label>
          <p className="mt-1 text-sm text-gray-400">
            This determines how you&apos;ll be charged for processing your request.
          </p>
          <div className="mt-3 space-y-2">
            {[
              { value: "other", label: "Individual / General Public" },
              { value: "news_media", label: "News Media / Journalist" },
              { value: "educational", label: "Educational Institution" },
              { value: "commercial", label: "Commercial Use" },
            ].map((option) => (
              <label
                key={option.value}
                className="flex items-center gap-3 rounded-lg border border-gray-600 p-3 cursor-pointer hover:bg-gray-700"
              >
                <input
                  type="radio"
                  name="feeCategory"
                  value={option.value}
                  checked={details.feeCategory === option.value}
                  onChange={(e) =>
                    setDetails((prev) => ({
                      ...prev,
                      feeCategory: e.target.value as UserDetails["feeCategory"],
                    }))
                  }
                  className="h-4 w-4 text-blue-600"
                />
                <span className="text-white">{option.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Max Fee */}
        <div>
          <label
            htmlFor="maxFee"
            className="block text-sm font-medium text-gray-300"
          >
            Maximum Fee You&apos;re Willing to Pay
          </label>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-gray-400">$</span>
            <input
              id="maxFee"
              type="number"
              min="0"
              step="5"
              value={details.maxFee}
              onChange={(e) =>
                setDetails((prev) => ({
                  ...prev,
                  maxFee: parseFloat(e.target.value) || 0,
                }))
              }
              className="w-24 rounded-lg border border-gray-600 bg-gray-700 px-4 py-2 text-white focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
          <p className="mt-1 text-sm text-gray-400">
            The agency will contact you if fees exceed this amount.
          </p>
        </div>

        {/* Fee Waiver */}
        <div>
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={details.feeWaiverRequested}
              onChange={(e) =>
                setDetails((prev) => ({
                  ...prev,
                  feeWaiverRequested: e.target.checked,
                }))
              }
              className="h-4 w-4 rounded text-blue-600"
            />
            <span className="text-sm font-medium text-gray-300">
              Request a fee waiver
            </span>
          </label>
          {details.feeWaiverRequested && (
            <div className="mt-3">
              <label
                htmlFor="feeWaiverReason"
                className="block text-sm font-medium text-gray-300"
              >
                Reason for Fee Waiver *
              </label>
              <textarea
                id="feeWaiverReason"
                rows={3}
                value={details.feeWaiverReason}
                onChange={(e) =>
                  setDetails((prev) => ({
                    ...prev,
                    feeWaiverReason: e.target.value,
                  }))
                }
                placeholder="Explain how disclosure will contribute significantly to public understanding..."
                className={`mt-1 w-full rounded-lg border px-4 py-2 bg-gray-700 text-white placeholder-gray-400 ${
                  errors.feeWaiverReason ? "border-red-500" : "border-gray-600"
                } focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20`}
              />
              {errors.feeWaiverReason && (
                <p className="mt-1 text-sm text-red-400">
                  {errors.feeWaiverReason}
                </p>
              )}
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
            type="submit"
            className="flex-1 rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-blue-700"
          >
            Review & Submit
          </button>
        </div>
      </form>
    </div>
  );
}
