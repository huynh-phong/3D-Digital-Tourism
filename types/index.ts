export type Lang = "vi" | "en";
export type Localized = Record<Lang, string>;

/**
 * How much we trust a piece of information.
 * - verified: stated by an official source listed in `source_urls`.
 * - conflicting: official sources disagree; both versions are recorded.
 * - estimated: a design estimate for the simulation (e.g. interior sizes).
 * - simulated: purely illustrative; no claim of historical accuracy.
 */
export type ConfidenceStatus = "verified" | "conflicting" | "estimated" | "simulated";

export interface Source {
  id: string;
  title: Localized;
  url: string;
  publisher: string;
  accessed: string; // ISO date
}

export interface Fact {
  id: string;
  text: Localized;
  source_ids: string[];
  confidence_status: ConfidenceStatus;
  note?: Localized;
}

/** Vec3 in metres inside the Dinh Độc Lập scene. +y up, gate at +z. */
export type Vec3 = [number, number, number];

/** f1 = tầng 1 (entrance floor, called "lầu một" by the site), f2 = tầng 2. */
export type FloorId = "grounds" | "f1" | "f2" | "basement" | "roof";

export interface KnowledgeEntry {
  id: string;
  name_vi: string;
  name_en: string;
  description_vi: string;
  description_en: string;
  historical_context_vi: string;
  historical_context_en: string;
  facts: string[]; // Fact ids
  source_urls: string[];
  tour_stop_id: string | null;
  floor: FloorId | null;
  spatial_reference: string;
  confidence_status: ConfidenceStatus;
  /** Extra search terms (folded, no diacritics needed). */
  keywords: string[];
}

export interface NarrationLayer {
  /** 15–30 s: where am I. */
  quick: Localized;
  /** 45–90 s: the main story. */
  main: Localized;
  /** On demand: deeper detail. */
  deep: Localized;
}

export interface TimelineItem {
  date: string;
  label: Localized;
  fact_id: string;
}

export interface MediaRef {
  id: string;
  caption: Localized;
  /** Page that hosts the archival image. We link instead of re-hosting (copyright). */
  page_url: string;
  credit: string;
}

export interface TourStop {
  id: string;
  order: number;
  title: Localized;
  floor: FloorId;
  /** Where the player should stand to trigger the stop. */
  position: Vec3;
  /** Where Minh Anh stands / points at. */
  guideSpot: Vec3;
  lookAt: Vec3;
  radius: number;
  knowledge_ids: string[];
  narration: NarrationLayer;
  timeline: TimelineItem[];
  media: MediaRef[];
  spatial_confidence: ConfidenceStatus;
  spatial_note: Localized;
}

export interface Interactable {
  id: string;
  title: Localized;
  floor: FloorId;
  position: Vec3;
  radius: number;
  knowledge_id: string;
  body: Localized;
  confidence_status: ConfidenceStatus;
}

export type LandmarkStatus = "available" | "coming_soon";

export type LandmarkKind =
  | "palace" | "cathedral" | "postoffice" | "museum" | "wharf" | "market"
  | "landmark81" | "tower" | "zoo" | "bridge";

export interface Landmark {
  /** stable id (URLs, analytics, tests) */
  id: string;
  name: Localized;
  /** short label for far zoom levels */
  short: Localized;
  blurb: Localized;
  status: LandmarkStatus;
  /** WGS84 representative point from OpenStreetMap (element id recorded for verification). */
  lat: number;
  lon: number;
  osm: string;
  /** what the model is fitted to */
  geometry: "footprint" | "boundary" | "line";
  kind: LandmarkKind;
  route?: string;
  /** reference images / official page (linked, never re-hosted) */
  ref: { url: string; label: string };
}

export interface NavNode {
  id: string;
  p: Vec3;
  floor: FloorId;
}
export type NavEdge = [string, string];
