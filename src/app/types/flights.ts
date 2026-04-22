export type TripType = "oneway" | "roundtrip";
export type CabinClass = "Economy" | "Premium Economy" | "Business" | "First Class";

export interface Airport {
  code: string;
  city: string;
  name: string;
  country: string;
}

export interface PassengerCounts {
  adults: number;
  children: number;
  infants: number;
}
