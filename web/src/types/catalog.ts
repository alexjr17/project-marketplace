export interface Size {
  id: string;
  name: string;
  abbreviation: string;
  order: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Color {
  id: string;
  name: string;
  hexCode: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductType {
  id: string;
  name: string;
  description?: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Category {
  id: string;
  name: string;
  description?: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}
