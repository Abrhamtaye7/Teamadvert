import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import { requestLogger } from "./utils/logger";
import authRoutes from "./routes/auth";
import customerRoutes from "./routes/customers";
import supplierRoutes from "./routes/suppliers";
import itemRoutes from "./routes/items";
import proformaRoutes from "./routes/proformas";
import jobRoutes from "./routes/jobs";
import paymentRoutes from "./routes/payments";
import reportRoutes from "./routes/reports";
import userRoutes from "./routes/users";
import searchRoutes from "./routes/search";
import notificationRoutes from "./routes/notifications";
import backupRoutes from "./routes/backups";
import { errorHandler } from "./middleware/errorHandler";
import { notFound } from "./middleware/notFound";
import { ensureSeedData } from "./services/bootstrap";

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(cookieParser());
app.use(requestLogger);

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/auth", authRoutes);
app.use("/customers", customerRoutes);
app.use("/suppliers", supplierRoutes);
app.use("/items", itemRoutes);
app.use("/proformas", proformaRoutes);
app.use("/jobs", jobRoutes);
app.use("/payments", paymentRoutes);
app.use("/reports", reportRoutes);
app.use("/users", userRoutes);
app.use("/search", searchRoutes);
app.use("/notifications", notificationRoutes);
app.use("/backups", backupRoutes);

app.use(notFound);
app.use(errorHandler);

ensureSeedData();

export default app;
