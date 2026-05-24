import { Router } from "express";
import { db, reservationsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import QRCode from "qrcode";
import { randomBytes } from "crypto";
import { sendTicketConfirmationEmail } from "../lib/email";
import {
  CreateReservationBody,
  CheckInReservationBody,
  CheckInReservationParams,
  GetReservationByTokenParams,
  ListReservationsQueryParams,
  UpdateReservationParams,
  UpdateReservationBody,
  DeleteReservationParams,
  DeleteReservationBody,
} from "@workspace/api-zod";
import { maxTickets } from "@workspace/config";

const router = Router();

const ADMIN_KEY = process.env["ADMIN_KEY"];

function formatReservation(r: typeof reservationsTable.$inferSelect) {
  return {
    id: r.id,
    name: r.name,
    email: r.email,
    ticketCount: r.ticketCount,
    specialNeeds: r.specialNeeds,
    token: r.token,
    checkedIn: r.checkedIn,
    checkedInAt: r.checkedInAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
  };
}

router.post("/reservations", async (req, res) => {
  const reservationCount = await db
    .select()
    .from(reservationsTable)
    .then((rows) => rows.reduce((sum, r) => sum + r.ticketCount, 0));
  
  if((reservationCount + (req.body.ticketCount) || 1) > maxTickets){
    res.status(406).json({error: "Leider sind nicht mehr genügend Tickets verfügbar, um Ihre Reservierung zu erfüllen. Bitte reduzieren Sie die Anzahl der Tickets oder kontaktieren Sie uns direkt."});
    return;
  }

  if(reservationCount >= maxTickets){
    res.status(403).json({error: "Alle verfügbaren Tickets wurden bereits reserviert."});
    return;
  }
  const parsed = CreateReservationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Ungültige Eingabedaten. Bitte alle Felder korrekt ausfüllen." });
    return;
  }

  const { name, ticketCount, email, specialNeeds } = parsed.data;

  const existing = await db
    .select()
    .from(reservationsTable)
    .where(eq(reservationsTable.email, email))
    .limit(1);

  if (existing.length > 0) {
    res.status(409).json({ error: "Diese E-Mail-Adresse hat bereits eine Reservierung." });
    return;
  }

  const token = randomBytes(16).toString("hex");

  const [reservation] = await db
    .insert(reservationsTable)
    .values({ name, email, ticketCount, specialNeeds: specialNeeds ?? null, token })
    .returning();

  let qrCodeDataUrl = "";
  try {
    qrCodeDataUrl = await QRCode.toDataURL(token, {
      width: 300,
      margin: 2,
      color: { dark: "#1a0a1a", light: "#ffffff" },
    });
  } catch (err) {
    req.log.error({ err }, "QR code generation failed");
  }

  try {
    await sendTicketConfirmationEmail({ to: email, name, ticketCount, specialNeeds, token, qrCodeDataUrl });
  } catch (err) {
    req.log.error({ err }, "Email send failed — reservation still created");
  }

  res.status(201).json(formatReservation(reservation));
});

router.get("/reservations/:token", async (req, res) => {
  const parsed = GetReservationByTokenParams.safeParse({ token: req.params["token"] });
  if (!parsed.success) {
    res.status(400).json({ error: "Ungültiger Token." });
    return;
  }

  const [reservation] = await db
    .select()
    .from(reservationsTable)
    .where(eq(reservationsTable.token, parsed.data.token))
    .limit(1);

  if (!reservation) {
    res.status(404).json({ error: "Ticket nicht gefunden." });
    return;
  }

  res.json(formatReservation(reservation));
});

router.patch("/reservations/:token/check-in", async (req, res) => {
  const paramsParsed = CheckInReservationParams.safeParse({ token: req.params["token"] });
  if (!paramsParsed.success) {
    res.status(400).json({ error: "Ungültiger Token." });
    return;
  }

  const bodyParsed = CheckInReservationBody.safeParse(req.body);
  if (!bodyParsed.success) {
    res.status(400).json({ error: "Admin-Key erforderlich." });
    return;
  }

  if (bodyParsed.data.adminKey !== ADMIN_KEY) {
    res.status(401).json({ error: "Ungültiger Admin-Key." });
    return;
  }

  const [existing] = await db
    .select()
    .from(reservationsTable)
    .where(eq(reservationsTable.token, paramsParsed.data.token))
    .limit(1);

  if (!existing) {
    res.status(404).json({ error: "Ticket nicht gefunden." });
    return;
  }

  if (existing.checkedIn) {
    res.status(400).json({ error: "Dieses Ticket wurde bereits eingecheckt." });
    return;
  }

  const [updated] = await db
    .update(reservationsTable)
    .set({ checkedIn: true, checkedInAt: new Date() })
    .where(eq(reservationsTable.token, paramsParsed.data.token))
    .returning();

  res.json(formatReservation(updated));
});

router.get("/admin/reservations", async (req, res) => {
  const parsed = ListReservationsQueryParams.safeParse(req.query);
  if (!parsed.success || !parsed.data.adminKey) {
    res.status(401).json({ error: "Admin-Key erforderlich." });
    return;
  }

  if (parsed.data.adminKey !== ADMIN_KEY) {
    res.status(401).json({ error: "Ungültiger Admin-Key." });
    return;
  }

  const reservations = await db
    .select()
    .from(reservationsTable)
    .orderBy(reservationsTable.createdAt);

  res.json(reservations.map(formatReservation));
});

router.patch("/admin/reservations/:id", async (req, res) => {
  const paramsParsed = UpdateReservationParams.safeParse({ id: Number(req.params["id"]) });
  if (!paramsParsed.success) {
    res.status(400).json({ error: "Ungültige ID." });
    return;
  }

  const bodyParsed = UpdateReservationBody.safeParse(req.body);
  if (!bodyParsed.success) {
    res.status(400).json({ error: "Ungültige Eingabedaten." });
    return;
  }

  const { adminKey, name, email, ticketCount, specialNeeds, checkedIn } = bodyParsed.data;

  if (adminKey !== ADMIN_KEY) {
    res.status(401).json({ error: "Ungültiger Admin-Key." });
    return;
  }

  const [existing] = await db
    .select()
    .from(reservationsTable)
    .where(eq(reservationsTable.id, paramsParsed.data.id))
    .limit(1);

  if (!existing) {
    res.status(404).json({ error: "Reservierung nicht gefunden." });
    return;
  }

  if (email && email !== existing.email) {
    const emailConflict = await db
      .select()
      .from(reservationsTable)
      .where(eq(reservationsTable.email, email))
      .limit(1);
    if (emailConflict.length > 0) {
      res.status(409).json({ error: "Diese E-Mail-Adresse wird bereits verwendet." });
      return;
    }
  }

  const updates: Partial<typeof existing> = {};
  if (name !== undefined) updates.name = name;
  if (email !== undefined) updates.email = email;
  if (ticketCount !== undefined) updates.ticketCount = ticketCount;
  if (specialNeeds !== undefined) updates.specialNeeds = specialNeeds;
  if (checkedIn !== undefined) {
    updates.checkedIn = checkedIn;
    updates.checkedInAt = checkedIn ? (existing.checkedInAt ?? new Date()) : null;
  }

  const [updated] = await db
    .update(reservationsTable)
    .set(updates)
    .where(eq(reservationsTable.id, paramsParsed.data.id))
    .returning();

  res.json(formatReservation(updated));
});

router.delete("/admin/reservations/:id", async (req, res) => {
  const paramsParsed = UpdateReservationParams.safeParse({ id: Number(req.params["id"]) });
  if (!paramsParsed.success) {
    res.status(400).json({ error: "Ungültige ID." });
    return;
  }

  const bodyParsed = DeleteReservationBody.safeParse(req.body);
  if (!bodyParsed.success || bodyParsed.data.adminKey !== ADMIN_KEY) {
    res.status(401).json({ error: "Ungültiger Admin-Key." });
    return;
  }

  const [existing] = await db
    .select()
    .from(reservationsTable)
    .where(eq(reservationsTable.id, paramsParsed.data.id))
    .limit(1);

  if (!existing) {
    res.status(404).json({ error: "Reservierung nicht gefunden." });
    return;
  }

  await db.delete(reservationsTable).where(eq(reservationsTable.id, paramsParsed.data.id));

  res.status(204).send();
});

router.get("/stats", async (_req, res) => {
  const reservations = await db.select().from(reservationsTable);
  const totalReservations = reservations.length;
  const totalTickets = reservations.reduce((sum, r) => sum + r.ticketCount, 0);
  const totalCheckedIn = reservations.filter((r) => r.checkedIn).length;
  res.json({ totalReservations, totalTickets, totalCheckedIn });
});

export default router;
