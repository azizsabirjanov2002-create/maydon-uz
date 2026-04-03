export type CoverageType = 'GRASS' | 'ARTIFICIAL' | 'PARQUET' | 'CONCRETE' | 'SAND' | 'OTHER';

export interface ISlot {
  startTime: string; // HH:MM
  durationMinutes: number;
  isAvailable: boolean;
  reason?: string;
  priceAmount: number;
}

export interface IField {
  id: number;
  name: string;
  pricePerHour: number;
  bufferMinutes: number;
  coverageType: CoverageType | null;
  hasLighting: boolean;
  hasLockerRoom: boolean;
  hasShower: boolean;
  hasParking: boolean;
  freeSlots?: ISlot[];
  earliestSlot?: string;
}

export interface IVenue {
  id: number;
  name: string;
  address: string;
  district: string | null;
  lat: number;
  lng: number;
  photos: string[];
}

export interface ISearchResult {
  venue: IVenue;
  distanceKm: number;
  estimatedTravelTimeMinutes: number;
  fields: IField[];
}

export interface ISearchResponse {
  date: string;
  sportId: number;
  totalResults: number;
  results: ISearchResult[];
}

export interface IFieldSlotsResponse {
  date: string;
  fieldId: number;
  isClosed: boolean;
  slots: ISlot[];
}

export interface ISportCategory {
  id: number;
  nameRu: string;
  nameUz: string;
  icon: string | null;
}
