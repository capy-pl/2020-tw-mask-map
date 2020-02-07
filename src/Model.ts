export type PharmacyAjaxResponse = {
  type: string;
  features: Pharmacy[];
};

export type Pharmacy = {
  type: string;
  properties: PharmacyProps;
  geometry: Geometry;
};

export type PharmacyProps = {
  id: number;
  name: string;
  phone: string;
  address: string;
  mask_adult: number;
  mask_child: number;
  updated?: string;
  available: string;
  mark_adult: number;
  mark_child: number;
};

export type Geometry = {
  type: string;
  coordinates: number[];
};
