"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.changePinSchema = exports.userAccessUpdateSchema = exports.userRoleUpdateSchema = exports.userCreateSchema = exports.notificationSchema = exports.cbeVerifySchema = exports.paymentSchema = exports.jobSearchSchema = exports.jobSchema = exports.jobItemSchema = exports.proformaSearchSchema = exports.proformaCreateSchema = exports.proformaItemSchema = exports.unitSchema = exports.categorySchema = exports.itemUpdateSchema = exports.itemSchema = exports.supplierItemPriceSchema = exports.supplierUpdateSchema = exports.supplierSchema = exports.customerUpdateSchema = exports.customerSchema = exports.userLoginSchema = exports.rolePermissionsSchema = void 0;
const zod_1 = require("zod");
exports.rolePermissionsSchema = zod_1.z.record(zod_1.z.string(), zod_1.z.boolean());
exports.userLoginSchema = zod_1.z.object({
    username: zod_1.z.string().min(1),
    pin: zod_1.z.string().length(4),
});
exports.customerSchema = zod_1.z.object({
    customerId: zod_1.z.string().min(1),
    name: zod_1.z.string().min(1),
    company: zod_1.z.string().optional(),
    phone: zod_1.z.string().optional(),
    email: zod_1.z.string().email().optional(),
    tin: zod_1.z.string().optional(),
    addressRegion: zod_1.z.string().optional(),
    addressCity: zod_1.z.string().optional(),
    addressSubcity: zod_1.z.string().optional(),
    addressWoreda: zod_1.z.string().optional(),
    addressHouse: zod_1.z.string().optional(),
    creditLimit: zod_1.z.number().nonnegative().optional(),
    outstandingBalance: zod_1.z.number().nonnegative().optional(),
    standing: zod_1.z.enum(["Good", "Warning", "Suspended"]).optional(),
});
exports.customerUpdateSchema = exports.customerSchema.partial();
exports.supplierSchema = zod_1.z.object({
    supplierId: zod_1.z.string().min(1),
    companyName: zod_1.z.string().min(1),
    contactPerson: zod_1.z.string().optional(),
    phone: zod_1.z.string().optional(),
    email: zod_1.z.string().email().optional(),
    address: zod_1.z.string().optional(),
});
exports.supplierUpdateSchema = exports.supplierSchema.partial();
exports.supplierItemPriceSchema = zod_1.z.object({
    itemId: zod_1.z.number().int().optional(),
    name: zod_1.z.string().min(1),
    price: zod_1.z.number().nonnegative(),
});
exports.itemSchema = zod_1.z.object({
    name: zod_1.z.string().min(1),
    categoryId: zod_1.z.number().int().optional(),
    measurementUnitId: zod_1.z.number().int().optional(),
    unit: zod_1.z.string().optional(),
    basePrice: zod_1.z.number().nonnegative().optional(),
    purchasePrice: zod_1.z.number().nonnegative().optional(),
    sellingPrice: zod_1.z.number().nonnegative().optional(),
    notes: zod_1.z.string().optional(),
    customerPrices: zod_1.z
        .array(zod_1.z.object({
        customerId: zod_1.z.number().int(),
        price: zod_1.z.number().nonnegative(),
    }))
        .optional(),
    supplierPrices: zod_1.z
        .array(zod_1.z.object({
        supplierId: zod_1.z.number().int(),
        price: zod_1.z.number().nonnegative(),
    }))
        .optional(),
});
exports.itemUpdateSchema = exports.itemSchema.partial();
exports.categorySchema = zod_1.z.object({ name: zod_1.z.string().min(1) });
exports.unitSchema = zod_1.z.object({ unitName: zod_1.z.string().min(1) });
exports.proformaItemSchema = zod_1.z.object({
    itemId: zod_1.z.number().int().optional(),
    name: zod_1.z.string().min(1),
    description: zod_1.z.string().optional(),
    quantity: zod_1.z.number().positive(),
    unit: zod_1.z.string().optional(),
    sellingPrice: zod_1.z.number().nonnegative(),
    discount: zod_1.z.number().nonnegative().optional(),
    vatPercent: zod_1.z.number().nonnegative().optional(),
});
const customerSnapshotSchemaBase = zod_1.z.object({
    name: zod_1.z.string().min(1),
    company: zod_1.z.string().optional(),
    phones: zod_1.z.array(zod_1.z.string()).optional(),
    email: zod_1.z.string().email().optional(),
    tin: zod_1.z.string().optional(),
    address: zod_1.z
        .object({
        region: zod_1.z.string().optional(),
        city: zod_1.z.string().optional(),
        subcity: zod_1.z.string().optional(),
        woreda: zod_1.z.string().optional(),
        house: zod_1.z.string().optional(),
    })
        .partial()
        .optional(),
});
exports.proformaCreateSchema = zod_1.z.object({
    customerId: zod_1.z.number().int().optional(),
    customerNew: customerSnapshotSchemaBase.optional(),
    validity: zod_1.z.number().int().optional(),
    notes: zod_1.z.string().optional(),
    terms: zod_1.z.string().optional(),
    signaturePath: zod_1.z.string().optional(),
    stampPath: zod_1.z.string().optional(),
    bankInfoSnapshot: zod_1.z.any().optional(),
    items: zod_1.z.array(exports.proformaItemSchema).min(1),
});
exports.proformaSearchSchema = zod_1.z.object({
    q: zod_1.z.string().optional(),
    status: zod_1.z.enum(["draft", "approved", "converted", "expired"]).optional(),
    preparedBy: zod_1.z.string().optional(),
    itemName: zod_1.z.string().optional(),
    amountMin: zod_1.z.string().optional(),
    amountMax: zod_1.z.string().optional(),
    startDate: zod_1.z.string().optional(),
    endDate: zod_1.z.string().optional(),
    page: zod_1.z.string().optional(),
    pageSize: zod_1.z.string().optional(),
});
exports.jobItemSchema = zod_1.z.object({
    itemId: zod_1.z.number().int().optional(),
    name: zod_1.z.string().min(1),
    description: zod_1.z.string().optional(),
    quantity: zod_1.z.number().positive(),
    unit: zod_1.z.string().optional(),
    price: zod_1.z.number().nonnegative(),
});
exports.jobSchema = zod_1.z.object({
    customerId: zod_1.z.number().int().optional(),
    customerNew: customerSnapshotSchemaBase.optional(),
    proformaNumber: zod_1.z.string().optional(),
    jobType: zod_1.z.string().optional(),
    description: zod_1.z.string().optional(),
    deadline: zod_1.z.string().optional(),
    priority: zod_1.z.enum(["high", "normal", "low"]).optional(),
    advancePayment: zod_1.z.number().nonnegative().optional(),
    artworkPath: zod_1.z.string().optional(),
    adminNotes: zod_1.z.string().optional(),
    jobItems: zod_1.z.array(zod_1.z.object({
        itemId: zod_1.z.number().int().optional(),
        name: zod_1.z.string().min(1),
        description: zod_1.z.string().optional(),
        quantity: zod_1.z.number().positive(),
        unit: zod_1.z.string().optional(),
        price: zod_1.z.number().nonnegative(),
    })),
});
exports.jobSearchSchema = zod_1.z.object({
    q: zod_1.z.string().optional(),
    status: zod_1.z.string().optional(),
    priority: zod_1.z.string().optional(),
    customer: zod_1.z.string().optional(),
    itemName: zod_1.z.string().optional(),
    startDate: zod_1.z.string().optional(),
    endDate: zod_1.z.string().optional(),
    amountMin: zod_1.z.string().optional(),
    amountMax: zod_1.z.string().optional(),
    createdBy: zod_1.z.string().optional(),
    proforma: zod_1.z.string().optional(),
    page: zod_1.z.string().optional(),
    pageSize: zod_1.z.string().optional(),
});
exports.paymentSchema = zod_1.z.object({
    jobId: zod_1.z.number().int(),
    amount: zod_1.z.number().nonnegative(),
    method: zod_1.z.enum(["Cash", "Bank"]),
    transactionNumber: zod_1.z.string().optional(),
    referencePath: zod_1.z.string().optional(),
}).refine((data) => {
    if (data.method === "Bank") {
        return !!data.transactionNumber && data.transactionNumber.trim().length > 0;
    }
    return true;
}, { message: "Transaction number required for bank transfers", path: ["transactionNumber"] });
exports.cbeVerifySchema = zod_1.z.object({
    transactionNumber: zod_1.z.string().min(5),
    expectedAmount: zod_1.z.number().nonnegative(),
});
exports.notificationSchema = zod_1.z.object({
    message: zod_1.z.string().min(1),
    type: zod_1.z.string().default("Generic"),
});
exports.userCreateSchema = zod_1.z.object({
    username: zod_1.z.string().min(3),
    pin: zod_1.z.string().length(4),
    roleId: zod_1.z.number().int(),
    accessRoleIds: zod_1.z.array(zod_1.z.number().int()).optional(),
});
exports.userRoleUpdateSchema = zod_1.z.object({
    roleId: zod_1.z.number().int(),
});
exports.userAccessUpdateSchema = zod_1.z.object({
    accessRoleIds: zod_1.z.array(zod_1.z.number().int()).optional(),
});
exports.changePinSchema = zod_1.z.object({
    currentPin: zod_1.z.string().length(4),
    newPin: zod_1.z.string().length(4),
});
