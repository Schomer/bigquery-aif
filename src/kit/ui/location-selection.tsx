"use client";

import * as React from "react";

import { HelpButton } from "./help-button";
import { Message, MessageContent, MessageIcon, MessageLink } from "./message";
import { RadioGroup, RadioGroupItem, RadioGroupLabel } from "./radio-group";
import { SelectField, SelectItem } from "./select";
import { cn } from "./utils";

/**
 * LocationSelection — "where should this live", as the console asks it.
 *
 * Region or multi-region, then which one, then which zone inside it. It is the
 * same four controls on every create page in Cloud, and getting them wrong has
 * consequences a form cannot undo — a resource in the wrong region is a
 * migration, not an edit. That is why this is a component rather than a
 * pattern: the wording, the order and the dependency between the fields are
 * the same everywhere, and the only thing a page supplies is the list.
 *
 * ### The dependency runs downhill, and resets
 *
 * Changing the type clears the region; changing the region clears the zone. A
 * zone that belonged to the previous region is not a stale value, it is a
 * wrong one, and leaving it selected while the label above it says something
 * else is how a form submits `us-central1` / `europe-west4-b`.
 *
 * ### The org policy message
 *
 * On by default. Location choices are commonly constrained by an organisation
 * policy, and a reader who cannot find their region needs to know that before
 * they go looking for a bug. Pass `orgPolicyMessage={null}` on a surface where
 * no policy applies.
 */

export type LocationKind = "region" | "multi-region";

export interface LocationOption {
  /** The id submitted — `us-central1`, `EU`. */
  name: string;
  kind: LocationKind;
  /** A description shown beside the name in the list. */
  description?: string;
  /** Zones inside this region. Only read when `kind` is `region`. */
  zones?: string[];
}

export interface LocationSelectionProps
  extends Omit<React.ComponentProps<"div">, "onChange"> {
  locations: LocationOption[];
  /** Which kinds the reader may pick. Both by default. */
  allowedKinds?: LocationKind[];
  kind?: LocationKind;
  location?: string;
  zone?: string;
  onKindChange?: (kind: LocationKind) => void;
  onLocationChange?: (location: string) => void;
  onZoneChange?: (zone: string) => void;
  /** Adds the third field. Only ever shown for a region. */
  enableZoneSelection?: boolean;
  disabled?: boolean;
  /** Replaces the default policy note. `null` removes it. */
  orgPolicyMessage?: React.ReactNode | null;
  regionDescription?: string;
  multiRegionDescription?: string;
}

const DEFAULT_ORG_POLICY = (
  <>
    Some locations may be unavailable because of your organization&apos;s resource location
    policy.{" "}
    <MessageLink
      href="https://cloud.google.com/resource-manager/docs/organization-policy/defining-locations"
      target="_blank"
      rel="noreferrer"
    >
      Learn more
    </MessageLink>
  </>
);

function LocationSelection({
  className,
  locations,
  allowedKinds = ["region", "multi-region"],
  kind,
  location,
  zone,
  onKindChange,
  onLocationChange,
  onZoneChange,
  enableZoneSelection = false,
  disabled = false,
  orgPolicyMessage = DEFAULT_ORG_POLICY,
  regionDescription = "Lower latency within a single region",
  multiRegionDescription = "Highest availability across largest area",
  ...props
}: LocationSelectionProps) {
  const [kindUncontrolled, setKindUncontrolled] = React.useState<LocationKind>(
    allowedKinds[0] ?? "region",
  );
  const [locationUncontrolled, setLocationUncontrolled] = React.useState("");
  const [zoneUncontrolled, setZoneUncontrolled] = React.useState("");

  const currentKind = kind ?? kindUncontrolled;
  const currentLocation = location ?? locationUncontrolled;
  const currentZone = zone ?? zoneUncontrolled;

  const setLocation = (next: string) => {
    if (location === undefined) setLocationUncontrolled(next);
    onLocationChange?.(next);
    if (zone === undefined) setZoneUncontrolled("");
    onZoneChange?.("");
  };

  const setKind = (next: LocationKind) => {
    if (kind === undefined) setKindUncontrolled(next);
    onKindChange?.(next);
    setLocation("");
  };

  const matching = locations.filter((item) => item.kind === currentKind);
  const zones =
    locations.find((item) => item.name === currentLocation)?.zones ?? [];
  const isRegion = currentKind === "region";

  return (
    <div
      data-slot="location-selection"
      className={cn("flex w-full flex-col gap-5", className)}
      {...props}
    >
      <RadioGroup
        value={currentKind}
        onValueChange={(value) => setKind(value as LocationKind)}
        disabled={disabled}
      >
        <RadioGroupLabel>
          <span className="flex items-center gap-1.5">
            Location type
            <HelpButton label="Help with location type" title="Location types">
              <p>
                A <strong>region</strong> is a specific geographical location where you can
                run your resources. A <strong>zone</strong> is an isolated location within a
                region.
              </p>
              <p>
                <strong>Multi-region</strong> resources are redundant and distributed within
                and across regions.
              </p>
            </HelpButton>
          </span>
        </RadioGroupLabel>
        {allowedKinds.includes("region") && (
          <RadioGroupItem value="region" hint={regionDescription}>
            Region
          </RadioGroupItem>
        )}
        {allowedKinds.includes("multi-region") && (
          <RadioGroupItem value="multi-region" hint={multiRegionDescription}>
            Multi-region
          </RadioGroupItem>
        )}
      </RadioGroup>

      {orgPolicyMessage && (
        <Message severity="info">
          <MessageIcon />
          <MessageContent>{orgPolicyMessage}</MessageContent>
        </Message>
      )}

      <div className="flex flex-col gap-4">
        <SelectField
          label={isRegion ? "Region" : "Multi-region"}
          value={currentLocation}
          onValueChange={setLocation}
          disabled={disabled}
          placeholder={isRegion ? "Select a region" : "Select a multi-region"}
        >
          {matching.map((item) => (
            <SelectItem key={item.name} value={item.name}>
              {item.description ? `${item.name} (${item.description})` : item.name}
            </SelectItem>
          ))}
        </SelectField>

        {isRegion && enableZoneSelection && (
          <SelectField
            label="Zone"
            value={currentZone}
            onValueChange={(next) => {
              if (zone === undefined) setZoneUncontrolled(next);
              onZoneChange?.(next);
            }}
            // Disabled until there is a region: the zone list is a property of
            // the region, so an enabled-but-empty select here is a dead end
            // that says nothing about why.
            disabled={disabled || !currentLocation}
            placeholder="Select a zone"
          >
            {zones.map((name) => (
              <SelectItem key={name} value={name}>
                {name}
              </SelectItem>
            ))}
          </SelectField>
        )}
      </div>
    </div>
  );
}

export { LocationSelection };
