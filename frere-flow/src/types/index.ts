// Domain model — mirrors the future relational database schema.
export type ID = string;

export type PermissionKey =
  | "dashboard"
  | "clients"
  | "produits"
  | "ventes"
  | "credits"
  | "paiements"
  | "caisse"
  | "stock"
  | "frigos"
  | "emballages"
  | "equipes"
  | "rapports"
  | "administration"
  | "historique"
  | "parametres"
  | "marches"
  | "lecture";

export interface Role {
  id: ID;
  name: string;
  nameAlt?: string;
  description: string;
  permissions: PermissionKey[];
}
export type SecMode = "none" | "totp" | "pin" | "email" | "device";
export interface UserDevice {
  id: string;
  name: string;
  status: "pending" | "approved";
  createdAt: string;
  lastSeen?: string;
  ip?: string;
}
export interface User {
  id: ID;
  name: string;
  email: string;
  phone: string;
  password: string;
  active: boolean;
  createdAt: string;
  roleIds: ID[];
  teamId?: ID;
  /** nom dans l'autre langue (français si le nom est en arabe, arabe sinon) */
  nameAlt?: string;
  /** mode de sécurité de la connexion, choisi par le directeur */
  secMode?: SecMode;
  /** (lecture seule, envoyé par le serveur) code PIN / Authenticator déjà configuré */
  secSetup?: boolean;
  /** (lecture seule) mot de passe initial ou donné par un autre : à changer */
  passwordInitial?: boolean;
  /** (lecture seule, administrateurs) appareils approuvés / en attente */
  devices?: UserDevice[];
}
export interface Team {
  id: ID;
  name: string;
  nameAlt?: string;
  code: string;
  description: string;
  responsable: string;
  active: boolean;
}
export interface Client {
  id: ID;
  marketId?: ID;
  code: string;
  name: string;
  nameAlt?: string;
  phone: string;
  address: string;
  email: string;
  taxId: string;
  active: boolean;
  createdAt: string;
}
export interface Product {
  id: ID;
  reference: string;
  name: string;
  nameAlt?: string;
  category: string;
  unit: string;
  salePrice: number;
  alertThreshold: number;
  active: boolean;
}
export interface Frigo {
  id: ID;
  name: string;
  nameAlt?: string;
  code: string;
  capacity: number;
  location: string;
  description: string;
  active: boolean;
}

export type StockMovementType = "ENTREE" | "SORTIE" | "TRANSFERT" | "AJUSTEMENT";
export interface StockMovement {
  id: ID;
  productId: ID;
  frigoId: ID;
  toFrigoId?: ID;
  quantity: number;
  movementType: StockMovementType;
  date: string;
  userId: ID;
  reference: string;
  notes: string;
}

export interface SaleStatus {
  id: ID;
  code: "PENDING" | "CONFIRMED" | "PAID" | "PARTIAL" | "CANCELLED";
  label: string;
}
export interface CreditStatus {
  id: ID;
  code: "ACTIVE" | "PARTIAL" | "PAID" | "OVERDUE" | "CANCELLED";
  label: string;
}

export type PaymentMethod = "ESPECES" | "CHEQUE" | "VIREMENT" | "AUTRE";

export interface Sale {
  id: ID;
  marketTripId?: ID;
  number: string;
  clientId: ID;
  teamId: ID;
  frigoId: ID;
  userId: ID;
  saleStatusId: ID;
  saleDate: string;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  paymentType: PaymentMethod;
  notes: string;
}
export interface SaleItem {
  id: ID;
  saleId: ID;
  productId: ID;
  quantity: number;
  unitPrice: number;
  total: number;
}
export interface Payment {
  id: ID;
  saleId: ID;
  clientId: ID;
  teamId: ID;
  userId: ID;
  amount: number;
  paymentDate: string;
  paymentMethod: PaymentMethod;
}
export interface Credit {
  id: ID;
  clientId: ID;
  teamId: ID;
  saleId?: ID;
  creditStatusId: ID;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  dueDate: string;
  createdAt: string;
  notes?: string;
  frigoId?: ID;
  marketId?: ID;
  reminderDays?: number;
  reminderHistory?: { date: string; userId: ID; dueDate: string }[];
  deadlineCancelled?: boolean;
}
export interface CreditPayment {
  id: ID;
  creditId: ID;
  clientId: ID;
  teamId: ID;
  userId: ID;
  amount: number;
  paymentDate: string;
  paymentMethod: PaymentMethod;
  notes: string;
}
export interface CashEntry {
  id: ID;
  teamId: ID;
  userId: ID;
  type: "ENCAISSEMENT" | "DECAISSEMENT";
  method: PaymentMethod;
  amount: number;
  reference: string;
  date: string;
  description: string;
}

/** clientOwned: caisses appartenant au client (il les amène, on les lui rend plus tard) — RETOUR = reçues du client, SORTIE = rendues au client */
export interface PackagingType {
  id: ID;
  name: string;
  nameAlt?: string;
  color: string;
  hex: string;
  description: string;
  totalAvailable: number;
  active: boolean;
  clientOwned?: boolean;
}
export interface PackagingMovement {
  id: ID;
  clientId: ID;
  packagingTypeId: ID;
  teamId: ID;
  saleId?: ID;
  type: "SORTIE" | "RETOUR";
  quantity: number;
  date: string;
  userId: ID;
  notes: string;
}

export interface Market {
  id: ID;
  name: string;
  nameAlt?: string;
  city: string;
  active: boolean;
}
export interface MarketLoad {
  productId: ID;
  frigoId: ID;
  quantity: number;
}
export interface MarketClosing {
  returns: { productId: ID; frigoId: ID; quantity: number }[];
  boxesReturned: { typeId: ID; quantity: number }[];
  cashCounted: number;
  chequesCounted: number;
  expectedCash: number;
  expectedCheques: number;
  goodsGap: number;
  boxesGap: number;
  cashGap: number;
  notes: string;
  closedAt: string;
  closedBy: ID;
}
export interface MarketTrip {
  id: ID;
  number: string;
  marketId: ID;
  teamId: ID;
  date: string;
  userId: ID;
  status: "OPEN" | "CLOSED";
  loads: MarketLoad[];
  boxes: { typeId: ID; quantity: number }[];
  notes: string;
  closing?: MarketClosing;
}

export interface AuditLog {
  id: ID;
  userId: ID;
  action: string;
  entity: string;
  entityId?: ID;
  details: string;
  date: string;
}

/** Facture : une par vente, créée automatiquement avec la vente */
export type InvoiceStatus = "VALIDEE" | "A_VOIR" | "ANNULEE";
export interface Invoice {
  id: ID;
  number: string;
  saleId: ID;
  clientId: ID;
  teamId: ID;
  amount: number;
  status: InvoiceStatus;
  date: string;
  /** motif « à voir » (ce qu'il faut modifier) ou d'annulation */
  notes: string;
  updatedAt?: string;
}

export interface AppState {
  seq: number;
  sessionUserId: ID | null;
  roles: Role[];
  users: User[];
  teams: Team[];
  clients: Client[];
  products: Product[];
  frigos: Frigo[];
  stockMovements: StockMovement[];
  saleStatuses: SaleStatus[];
  creditStatuses: CreditStatus[];
  sales: Sale[];
  saleItems: SaleItem[];
  payments: Payment[];
  credits: Credit[];
  creditPayments: CreditPayment[];
  cash: CashEntry[];
  packagingTypes: PackagingType[];
  packagingMovements: PackagingMovement[];
  auditLogs: AuditLog[];
  markets: Market[];
  marketTrips: MarketTrip[];
  invoices: Invoice[];
  settings: {
    companyName: string;
    currency: string;
    defaultDueDays: number;
    packagingAlert: number;
    /** seuil d'alerte « crédit élevé » d'un client (TND) */
    creditAlert?: number;
  };
}
