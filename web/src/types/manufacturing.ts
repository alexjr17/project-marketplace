// Tipos de la app "Fábrica" (manufacturing). Catálogos propios + referencias.

export type MfgProcessType = 'INTERNAL' | 'EXTERNAL';
export type MfgWorkshopType = 'INTERNAL' | 'EXTERNAL';

// --- Catálogos propios ---

export type MfgComposition = 'SUPERIOR' | 'INFERIOR' | 'SET';

export interface MfgGarmentType {
  id: number;
  code: string;
  name: string;
  composition: MfgComposition;
  isActive: boolean;
  sizes?: { id: number; name: string; abbreviation: string; sortOrder: number; pivot?: { market: MfgMarket } }[];
  createdAt?: string;
  updatedAt?: string;
}

export interface MfgColor {
  id: number;
  name: string;
  hexCode: string;
  code?: string | null;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface MfgSize {
  id: number;
  name: string;
  abbreviation: string;
  market: MfgMarket;
  sortOrder: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export type MfgClassification = 'PRODUCTO' | 'SERVICIO';
export type MfgScope = 'INTERNAL' | 'EXTERNAL';

export interface MfgInputType {
  id: number;
  name: string;
  classification: MfgClassification;
  consumesByColor?: boolean;
  description?: string | null;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface MfgInput {
  id: number;
  code: string;
  name: string;
  inputTypeId?: number | null;
  unitOfMeasure: string;
  scope?: MfgScope | null;
  notes?: string | null;
  isActive: boolean;
  inputType?: { id: number; name: string; classification: MfgClassification } | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface MfgCollection {
  id: number;
  name: string;
  year?: number | null;
  semester?: string | null; // I | II
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

// --- Clientes + órdenes de pedido ---

export interface MfgClient {
  id: number;
  name: string;
  documentId?: string | null;
  documentType?: string | null; // C.C | NIT | Otro
  businessName?: string | null;
  email?: string | null;
  phone?: string | null;
  city?: string | null;
  invoiceAddress?: string | null;
  dispatchAddress?: string | null;
  creditDays?: number | null;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export type MfgPurchaseStatus = 'DRAFT' | 'APPROVED' | 'IN_PRODUCTION' | 'DELIVERED' | 'CANCELLED';

export interface MfgPurchaseOrderItem {
  id: number;
  purchaseOrderId: number;
  referenceId: number;
  colorId: number;
  sizeId: number;
  quantity: number;
  productionOrderId?: number | null;
  reference?: { id: number; code: string; name: string; imagePath?: string | null };
  color?: { id: number; name: string; hexCode: string };
  size?: { id: number; name: string; abbreviation: string; sortOrder: number };
}

export interface MfgPurchaseOrder {
  id: number;
  code: string;
  clientId: number;
  collectionId?: number | null;
  semester?: string | null;
  status: MfgPurchaseStatus;
  dispatchStartDate?: string | null;
  deliveryDate?: string | null;
  partialDates?: string[] | null;
  notes?: string | null;
  createdAt?: string;
  client?: { id: number; name: string; businessName?: string | null; city?: string | null; phone?: string | null };
  collection?: { id: number; name: string; year?: number | null; semester?: string | null };
  items: MfgPurchaseOrderItem[];
  productionOrders?: { id: number; code: string; referenceId: number; status: string; reference?: { id: number; code: string; name: string } }[];
  items_count?: number;
}

export interface MfgPurchaseOrderInput {
  clientId: number;
  collectionId?: number | null;
  semester?: string | null;
  status?: MfgPurchaseStatus;
  dispatchStartDate?: string | null;
  deliveryDate?: string | null;
  partialDates?: string[];
  notes?: string | null;
  references: { referenceId: number; items: { colorId: number; sizeId: number; quantity: number }[] }[];
}

// --- Despachos / entregas ---

export type MfgDispatchStatus = 'DRAFT' | 'CONFIRMED' | 'CANCELLED';
export type MfgDispatchType = 'VENTA' | 'CONSIGNACION' | 'TRASLADO' | 'MUESTRA';

export interface MfgDispatchItem {
  id: number;
  dispatchId: number;
  referenceId: number;
  colorId: number;
  sizeId: number;
  quantity: number;
  reference?: { id: number; code: string; name: string; imagePath?: string | null };
  color?: { id: number; name: string; hexCode: string };
  size?: { id: number; name: string; abbreviation: string; sortOrder: number };
}

export interface MfgDispatch {
  id: number;
  code: string;
  clientId?: number | null;
  purchaseOrderId?: number | null;
  warehouseId?: number | null;
  type: MfgDispatchType;
  status: MfgDispatchStatus;
  shipmentNumber?: string | null;
  invoiceNumber?: string | null;
  invoicedAt?: string | null;
  notes?: string | null;
  dispatchedAt?: string | null;
  createdAt?: string;
  client?: { id: number; name: string; city?: string | null };
  purchaseOrder?: { id: number; code: string };
  warehouse?: { id: number; name: string };
  items: MfgDispatchItem[];
  items_count?: number;
}

export interface MfgDispatchInput {
  clientId?: number | null;
  purchaseOrderId?: number | null;
  warehouseId?: number | null;
  type?: MfgDispatchType;
  notes?: string | null;
  items: { referenceId: number; colorId: number; sizeId: number; quantity: number }[];
}

export interface MfgAvailableStock {
  referenceId: number;
  refCode: string;
  refName: string;
  imagePath?: string | null;
  colorId: number;
  colorName: string;
  colorHex: string;
  sizeId: number;
  sizeAbbr: string;
  sizeSort: number;
  available: string | number;
}

export interface MfgPoPendingItem {
  referenceId: number;
  reference?: { id: number; code: string; name: string; imagePath?: string | null };
  colorId: number;
  color?: { id: number; name: string; hexCode: string };
  sizeId: number;
  size?: { id: number; name: string; abbreviation: string; sortOrder: number };
  ordered: number;
  dispatched: number;
  pending: number;
}

// --- Configuración de planta ---

export type MfgConsumptionKind = 'TYPE' | 'INPUT';

export interface MfgProcessConsumption {
  id: number;
  processId: number;
  kind: MfgConsumptionKind;
  inputTypeId?: number | null;
  inputId?: number | null;
  inputType?: { id: number; name: string; classification?: MfgClassification } | null;
  input?: { id: number; code: string; name: string } | null;
}

export interface MfgProcess {
  id: number;
  name: string;
  code?: string | null;
  sequence: number;
  type: MfgProcessType;
  isActive: boolean;
  consumptions?: MfgProcessConsumption[];
  createdAt?: string;
  updatedAt?: string;
}

export interface MfgWorkshop {
  id: number;
  name: string;
  code?: string | null;
  type: MfgWorkshopType;
  contactName?: string | null;
  phone?: string | null;
  notes?: string | null;
  isActive: boolean;
  processes?: { id: number; name: string }[];
  createdAt?: string;
  updatedAt?: string;
}

export interface MfgWarehouse {
  id: number;
  name: string;
  code?: string | null;
  address?: string | null;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

// --- Referencia + ficha técnica ---

export type MfgColorType = 'PRIMARY' | 'SECONDARY';
export type MfgMarket = 'NATIONAL' | 'EXPORT';
export type MfgComponentPosition = 'SUPERIOR' | 'INFERIOR';

export interface MfgReferenceColor {
  id: number;
  referenceId: number;
  colorId: number;
  colorType: MfgColorType;
  color?: { id: number; name: string; hexCode: string; code?: string | null };
}

export interface MfgReferenceComponent {
  id: number;
  referenceId: number;
  position: MfgComponentPosition;
  description?: string | null;
}

export interface MfgSizeGroupSurcharge {
  id: number;
  sizeGroupId: number;
  colorId: number;
  amount: string | number;
  color?: { id: number; name: string; hexCode: string; code?: string | null };
}

export interface MfgSizeGroup {
  id: number;
  referenceId: number;
  name: string;
  market: MfgMarket;
  fixedCostExtra: string | number;
  factor: string | number;
  listPrice: string | number;
  isWholesale: boolean;
  sortOrder: number;
  sizes: { id: number; sizeGroupId: number; sizeId: number; size?: { id: number; name: string; abbreviation: string; sortOrder: number } }[];
  surcharges: MfgSizeGroupSurcharge[];
}

export interface MfgReferenceSize {
  id: number;
  referenceId: number;
  sizeId: number;
  size?: { id: number; name: string; abbreviation: string; sortOrder: number };
}

export interface MfgReferenceMaterial {
  id: number;
  referenceId: number;
  inputId: number;
  colorId?: number | null;
  componentId?: number | null;
  consumption: string | number;
  unitValue: string | number;
  unitOfMeasure?: string | null;
  notes?: string | null;
  input?: { id: number; code: string; name: string; unitOfMeasure: string; inputTypeId?: number | null; scope?: MfgScope | null; inputType?: { id: number; name: string; classification: MfgClassification } | null };
  color?: { id: number; name: string; hexCode: string; code?: string | null } | null;
  component?: MfgReferenceComponent | null;
}

export interface MfgReference {
  id: number;
  code: string;
  name: string;
  garmentTypeId?: number | null;
  collectionId?: number | null;
  description?: string | null;
  isActive: boolean;
  imagePath?: string | null;
  fixedCost: string | number;
  factor: string | number;
  costVariable: string | number;
  costUnit: string | number;
  basePrice: string | number;
  garmentType?: { id: number; code: string; name: string } | null;
  collection?: { id: number; name: string; year?: number | null; semester?: string | null } | null;
  colors: MfgReferenceColor[];
  sizes: MfgReferenceSize[];
  components: MfgReferenceComponent[];
  materials: MfgReferenceMaterial[];
  sizeGroups: MfgSizeGroup[];
  createdAt?: string;
  updatedAt?: string;
}

// --- Órdenes de producción (Fase 2) ---

export type MfgOrderStatus = 'DRAFT' | 'PROGRAMMED' | 'IN_PROCESS' | 'COMPLETED' | 'CANCELLED';
export type MfgStageStatus = 'PENDING' | 'IN_PROCESS' | 'COMPLETED' | 'SKIPPED';

export interface MfgProductionOrderItem {
  id: number;
  productionOrderId: number;
  colorId: number;
  sizeId: number;
  quantity: number;
  quantityDone: number;
  color?: { id: number; name: string; hexCode: string };
  size?: { id: number; name: string; abbreviation: string; sortOrder: number };
}

export interface MfgMatrixCell { colorId: number; sizeId: number; quantity: number; }

export interface MfgProductionStageCell {
  id: number;
  stageId: number;
  colorId: number;
  sizeId: number;
  quantity: number;
}

export interface MfgProductionOrderStage {
  id: number;
  productionOrderId: number;
  processId: number;
  workshopId?: number | null;
  sequence: number;
  status: MfgStageStatus;
  quantityDone: number;
  assignee?: string | null;
  notes?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  startedByName?: string | null;
  finishedByName?: string | null;
  process?: { id: number; name: string; sequence: number; type: MfgProcessType };
  workshop?: { id: number; name: string; type: MfgWorkshopType } | null;
  cells?: MfgProductionStageCell[];
  consumptions?: MfgStageConsumption[];
  stageComponents?: MfgStageComponent[];
  // Calculados por el backend:
  programmed?: MfgMatrixCell[];
  canStart?: boolean;
}

export interface MfgStageConsumption {
  id: number;
  stageId: number;
  inputId: number;
  colorId?: number | null;
  expectedQty: string | number;
  realQty: string | number;
  unitValue: string | number;
  input?: { id: number; code: string; name: string; unitOfMeasure: string };
  color?: { id: number; name: string; hexCode: string } | null;
}

export interface MfgStageComponent {
  id: number;
  stageId: number;
  componentId: number;
  workshopId?: number | null;
  component?: { id: number; position: MfgComponentPosition; description?: string | null };
  workshop?: { id: number; name: string; type: MfgWorkshopType } | null;
}

export interface MfgWarehouseStock {
  id: number;
  warehouseId: number;
  referenceId: number;
  colorId: number;
  sizeId: number;
  quantity: number;
  warehouse?: { id: number; name: string };
  reference?: { id: number; code: string; name: string };
  color?: { id: number; name: string; hexCode: string };
  size?: { id: number; name: string; abbreviation: string; sortOrder: number };
}

export interface MfgLotItem {
  id: number;
  lotId: number;
  colorId: number;
  sizeId: number;
  quantityProduced: number;
  quantityAvailable: number;
  color?: { id: number; name: string; hexCode: string };
  size?: { id: number; name: string; abbreviation: string; sortOrder: number };
}

export interface MfgLot {
  id: number;
  code: string;
  productionOrderId: number;
  warehouseId?: number | null;
  status: string;
  warehouse?: { id: number; name: string } | null;
  items: MfgLotItem[];
}

export interface MfgProductionOrder {
  id: number;
  code: string;
  internalCode?: string | null;
  referenceId: number;
  warehouseId?: number | null;
  collectionId?: number | null;
  semester?: string | null; // I | II
  scheduledAt?: string | null;
  estimatedDeliveryAt?: string | null;
  status: MfgOrderStatus;
  notes?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  createdAt?: string;
  reference?: {
    id: number; code: string; name: string; imagePath?: string | null;
    garmentType?: { id: number; code: string; name: string } | null;
    components?: MfgReferenceComponent[];
    materials?: {
      id: number; inputId: number; colorId?: number | null; componentId?: number | null;
      consumption: string | number; unitValue: string | number;
      input?: { id: number; code: string; name: string; unitOfMeasure: string; inputTypeId?: number | null };
      color?: { id: number; name: string; hexCode: string } | null;
    }[];
  };
  warehouse?: { id: number; name: string } | null;
  collection?: { id: number; name: string; year?: number | null; semester?: string | null } | null;
  items: MfgProductionOrderItem[];
  stages: MfgProductionOrderStage[];
  lots?: MfgLot[];
  substitutions?: MfgOrderSubstitution[];
  items_count?: number;
}

export interface MfgOrderSubstitution {
  id: number;
  productionOrderId: number;
  originalInputId: number;
  substituteInputId: number;
  colorId?: number | null;
  originalInput?: { id: number; code: string; name: string };
  substituteInput?: { id: number; code: string; name: string };
  color?: { id: number; name: string; hexCode: string } | null;
}

export interface MfgOrderMaterial {
  materialId: number;
  componentId?: number | null;
  input?: { id: number; code: string; name: string; unitOfMeasure: string; inputTypeId?: number | null; inputType?: { id: number; name: string; classification: MfgClassification } | null };
  color?: { id: number; name: string; hexCode: string } | null;
  consumption: string | number;
  unitValue: string | number;
  expected: string | number;
  substitute?: { id: number; code: string; name: string } | null;
}

export interface MfgProductionOrderInput {
  referenceId: number;
  warehouseId?: number | null;
  collectionId?: number | null;
  semester?: string | null;
  internalCode?: string | null;
  scheduledAt?: string | null;
  estimatedDeliveryAt?: string | null;
  notes?: string | null;
  items: { colorId: number; sizeId: number; quantity: number }[];
}

export interface MfgStageUpdate {
  status?: MfgStageStatus;
  workshopId?: number | null;
  assignee?: string | null;
  notes?: string | null;
  warehouseId?: number | null;
  cells?: MfgMatrixCell[];
  consumptions?: { inputId: number; colorId?: number | null; realQty: number }[];
  stageComponents?: { componentId: number; workshopId?: number | null }[];
}

// Payload para crear/editar una referencia con su ficha técnica.
// El código lo genera el backend (tipo de prenda + consecutivo).
export interface MfgReferenceInput {
  name: string;
  code?: string | null;
  garmentTypeId: number;
  collectionId?: number | null;
  description?: string | null;
  isActive?: boolean;
  imagePath?: string | null;
  fixedCost?: number;
  factor?: number;
  colors: { colorId: number; type: MfgColorType }[];
  sizeIds: number[];
  components: { position: MfgComponentPosition; description?: string | null }[];
  materials: {
    inputId: number;
    colorId?: number | null;
    componentIndex?: number | null;
    consumption: number;
    unitValue: number;
    unitOfMeasure?: string | null;
    notes?: string | null;
  }[];
  sizeGroups: {
    name: string;
    market?: MfgMarket;
    fixedCostExtra?: number;
    factor?: number;
    listPrice?: number;
    isWholesale?: boolean;
    sizeIds: number[];
    surcharges: { colorId: number; amount: number }[];
  }[];
}
