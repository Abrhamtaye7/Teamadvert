import { z } from "zod";

export const rolePermissionsSchema = z.record(z.string(), z.boolean());

export const userLoginSchema = z.object({
  username: z.string().min(1),
  pin: z.string().length(4),
});

export const customerSchema = z.object({
  customerId: z.string().min(1),
  name: z.string().min(1),
  company: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  tin: z.string().optional(),
  addressRegion: z.string().optional(),
  addressCity: z.string().optional(),
  addressSubcity: z.string().optional(),
  addressWoreda: z.string().optional(),
  addressHouse: z.string().optional(),
  creditLimit: z.number().nonnegative().optional(),
  outstandingBalance: z.number().nonnegative().optional(),
  standing: z.enum(["Good", "Warning", "Suspended"]).optional(),
});

export const customerUpdateSchema = customerSchema.partial();

export const supplierSchema = z.object({
  supplierId: z.string().min(1),
  companyName: z.string().min(1),
  contactPerson: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  address: z.string().optional(),
});
export const supplierUpdateSchema = supplierSchema.partial();

export const supplierItemPriceSchema = z.object({
  itemId: z.number().int().optional(),
  name: z.string().min(1),
  price: z.number().nonnegative(),
});

export const itemSchema = z.object({
  name: z.string().min(1),
  categoryId: z.number().int().optional(),
  measurementUnitId: z.number().int().optional(),
  unit: z.string().optional(),
  basePrice: z.number().nonnegative().optional(),
  purchasePrice: z.number().nonnegative().optional(),
  sellingPrice: z.number().nonnegative().optional(),
  notes: z.string().optional(),
  customerPrices: z
    .array(
      z.object({
        customerId: z.number().int(),
        price: z.number().nonnegative(),
      })
    )
    .optional(),
  supplierPrices: z
    .array(
      z.object({
        supplierId: z.number().int(),
        price: z.number().nonnegative(),
      })
    )
    .optional(),
});
export const itemUpdateSchema = itemSchema.partial();

export const categorySchema = z.object({ name: z.string().min(1) });
export const unitSchema = z.object({ unitName: z.string().min(1) });

export const proformaItemSchema = z.object({
  itemId: z.number().int().optional(),
  name: z.string().min(1),
  description: z.string().optional(),
  quantity: z.number().positive(),
  unit: z.string().optional(),
  sellingPrice: z.number().nonnegative(),
  discount: z.number().nonnegative().optional(),
  vatPercent: z.number().nonnegative().optional(),
});

const customerSnapshotSchemaBase = z.object({
  name: z.string().min(1),
  company: z.string().optional(),
  phones: z.array(z.string()).optional(),
  email: z.string().email().optional(),
  tin: z.string().optional(),
  address: z
    .object({
      region: z.string().optional(),
      city: z.string().optional(),
      subcity: z.string().optional(),
      woreda: z.string().optional(),
      house: z.string().optional(),
    })
    .partial()
    .optional(),
});

export const proformaCreateSchema = z.object({
  customerId: z.number().int().optional(),
  customerNew: customerSnapshotSchemaBase.optional(),
  validity: z.number().int().optional(),
  notes: z.string().optional(),
  terms: z.string().optional(),
  signaturePath: z.string().optional(),
  stampPath: z.string().optional(),
  bankInfoSnapshot: z.any().optional(),
  items: z.array(proformaItemSchema).min(1),
});

export const proformaSearchSchema = z.object({
  q: z.string().optional(),
  status: z.enum(["draft", "approved", "converted", "expired"]).optional(),
  preparedBy: z.string().optional(),
  itemName: z.string().optional(),
  amountMin: z.string().optional(),
  amountMax: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  page: z.string().optional(),
  pageSize: z.string().optional(),
});

export const jobItemSchema = z.object({
  itemId: z.number().int().optional(),
  name: z.string().min(1),
  description: z.string().optional(),
  quantity: z.number().positive(),
  unit: z.string().optional(),
  price: z.number().nonnegative(),
});

export const jobSchema = z.object({
  customerId: z.number().int().optional(),
  customerNew: customerSnapshotSchemaBase.optional(),
  proformaNumber: z.string().optional(),
  jobType: z.string().optional(),
  description: z.string().optional(),
  deadline: z.string().optional(),
  priority: z.enum(["high", "normal", "low"]).optional(),
  advancePayment: z.number().nonnegative().optional(),
  artworkPath: z.string().optional(),
  adminNotes: z.string().optional(),
  jobItems: z.array(
    z.object({
      itemId: z.number().int().optional(),
      name: z.string().min(1),
      description: z.string().optional(),
      quantity: z.number().positive(),
      unit: z.string().optional(),
      price: z.number().nonnegative(),
    })
  ),
});

export const jobSearchSchema = z.object({
  q: z.string().optional(),
  status: z.string().optional(),
  priority: z.string().optional(),
  customer: z.string().optional(),
  itemName: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  amountMin: z.string().optional(),
  amountMax: z.string().optional(),
  createdBy: z.string().optional(),
  proforma: z.string().optional(),
  page: z.string().optional(),
  pageSize: z.string().optional(),
});

export const paymentSchema = z.object({
  jobId: z.number().int(),
  amount: z.number().nonnegative(),
  method: z.enum(["Cash", "Bank"]),
  transactionNumber: z.string().optional(),
  referencePath: z.string().optional(),
}).refine(
  (data) => {
    if (data.method === "Bank") {
      return !!data.transactionNumber && data.transactionNumber.trim().length > 0;
    }
    return true;
  },
  { message: "Transaction number required for bank transfers", path: ["transactionNumber"] }
);

export const cbeVerifySchema = z.object({
  transactionNumber: z.string().min(5),
  expectedAmount: z.number().nonnegative(),
});

export const notificationSchema = z.object({
  message: z.string().min(1),
  type: z.string().default("Generic"),
});

export const userCreateSchema = z.object({
  username: z.string().min(3),
  pin: z.string().length(4),
  roleId: z.number().int(),
  accessRoleIds: z.array(z.number().int()).optional(),
});

export const userRoleUpdateSchema = z.object({
  roleId: z.number().int(),
});

export const userAccessUpdateSchema = z.object({
  accessRoleIds: z.array(z.number().int()).optional(),
});

export const changePinSchema = z.object({
  currentPin: z.string().length(4),
  newPin: z.string().length(4),
});

export type LoginInput = z.infer<typeof userLoginSchema>;
export type CustomerInput = z.infer<typeof customerSchema>;
export type SupplierInput = z.infer<typeof supplierSchema>;
export type ItemInput = z.infer<typeof itemSchema>;
export type ProformaCreateInput = z.infer<typeof proformaCreateSchema>;
export type JobInput = z.infer<typeof jobSchema>;
export type JobSearchInput = z.infer<typeof jobSearchSchema>;
export type PaymentInput = z.infer<typeof paymentSchema>;
export type CbeVerifyInput = z.infer<typeof cbeVerifySchema>;
export type UserCreateInput = z.infer<typeof userCreateSchema>;
export type SupplierItemPriceInput = z.infer<typeof supplierItemPriceSchema>;
