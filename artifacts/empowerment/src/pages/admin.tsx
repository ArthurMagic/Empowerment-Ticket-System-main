import { useState, useRef, useCallback } from "react";
import {
  useListReservations,
  getListReservationsQueryKey,
  useGetStats,
  getGetStatsQueryKey,
  useCheckInReservation,
  useGetReservationByToken,
  getGetReservationByTokenQueryKey,
  useUpdateReservation,
  useDeleteReservation,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { QrCameraScanner } from "@/components/QrCameraScanner";
import type { Reservation } from "@workspace/api-client-react";

// ─── Check-in Confirmation Dialog ─────────────────────────────────────────────

interface CheckInConfirmProps {
  reservation: Reservation;
  onConfirm: (actualCount: number) => void;
  onCancel: () => void;
  isPending: boolean;
}

function CheckInConfirm({ reservation, onConfirm, onCancel, isPending }: CheckInConfirmProps) {
  const [count, setCount] = useState(reservation.ticketCount);

  return (
    <div className="p-4 rounded-lg border border-primary/40 bg-primary/5 space-y-4 animate-in fade-in slide-in-from-bottom-2">
      <div className="text-center space-y-1">
        <p className="text-xs uppercase tracking-widest text-primary font-semibold">Eincheck bestätigen</p>
        <p className="text-white font-bold text-xl">{reservation.name}</p>
        <p className="text-muted-foreground text-sm">
          Reserviert: {reservation.ticketCount} {reservation.ticketCount === 1 ? "Person" : "Personen"}
        </p>
        {reservation.specialNeeds && (
          <p className="text-amber-400 text-xs border border-amber-500/30 rounded px-2 py-1 inline-block">
            {reservation.specialNeeds}
          </p>
        )}
      </div>

      <div className="space-y-1">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">Tatsächlich erschienen</Label>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-10 w-10 text-lg font-bold"
            onClick={() => setCount((c) => Math.max(1, c - 1))}
            disabled={count <= 1}
          >
            –
          </Button>
          <Input
            type="number"
            min={1}
            max={reservation.ticketCount}
            value={count}
            onChange={(e) => setCount(Math.min(reservation.ticketCount, Math.max(1, Number(e.target.value))))}
            className="h-10 text-center font-bold text-lg flex-1"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-10 w-10 text-lg font-bold"
            onClick={() => setCount((c) => Math.min(reservation.ticketCount, c + 1))}
            disabled={count >= reservation.ticketCount}
          >
            +
          </Button>
        </div>
      </div>

      <div className="flex gap-2">
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1 h-10" disabled={isPending}>
          Abbrechen
        </Button>
        <Button
          type="button"
          onClick={() => onConfirm(count)}
          disabled={isPending}
          className="flex-1 h-10 bg-primary text-white font-bold uppercase tracking-wider"
        >
          {isPending ? "..." : "Einchecken"}
        </Button>
      </div>
    </div>
  );
}

// ─── Scanner Section ──────────────────────────────────────────────────────────

type ScanMode = "checkin" | "lookup";
type InputMode = "manual" | "camera";

type ScanResult =
  | { status: "ok"; name: string; ticketCount: number; actualCount: number }
  | { status: "already"; checkedInAt?: string | null }
  | { status: "info"; name: string; ticketCount: number; checkedIn: boolean; checkedInAt?: string | null; specialNeeds?: string | null }
  | { status: "notfound" }
  | { status: "error" };

function ScannerSection({ adminKey }: { adminKey: string }) {
  const [tokenInput, setTokenInput] = useState("");
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [scanMode, setScanMode] = useState<ScanMode>("checkin");
  const [inputMode, setInputMode] = useState<InputMode>("manual");
  const [pendingCheckIn, setPendingCheckIn] = useState<Reservation | null>(null);
  const [scannerLocked, setScannerLocked] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const scannerRef = useRef<{ scannedRef?: { current?: boolean } } | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const checkIn = useCheckInReservation();
  const updateReservation = useUpdateReservation();

  const refocusInput = () => setTimeout(() => inputRef.current?.focus(), 150);

  // Unlock scanner and reset UI
  const unlockScanner = () => {
    setScannerLocked(false);
  };

  const resetScan = () => {
    setTokenInput("");
    setPendingCheckIn(null);
    unlockScanner();
    if (inputMode === "manual") refocusInput();
  };

  // ── Perform check-in after confirmation ──────────────────────────────────
  const confirmCheckIn = useCallback(
    (reservation: Reservation, actualCount: number) => {
      const doCheckIn = () => {
        checkIn.mutate(
          { token: reservation.token, data: { adminKey } },
          {
            onSuccess: (res) => {
              setScanResult({ status: "ok", name: res.name, ticketCount: reservation.ticketCount, actualCount });
              queryClient.invalidateQueries({ queryKey: getListReservationsQueryKey({ adminKey }) });
              queryClient.invalidateQueries({ queryKey: getGetStatsQueryKey() });
              setPendingCheckIn(null);
              resetScan();
            },
            onError: (err: { status?: number }) => {
              if (err?.status === 400) setScanResult({ status: "already" });
              else if (err?.status === 401) toast({ title: "Ungültiger Admin-Schlüssel", variant: "destructive" });
              else setScanResult({ status: "error" });
              setPendingCheckIn(null);
              resetScan();
            },
          }
        );
      };

      // If actual count differs from reserved, update ticketCount first, then check in
      if (actualCount !== reservation.ticketCount) {
        updateReservation.mutate(
          { id: reservation.id, data: { adminKey, ticketCount: actualCount } },
          {
            onSuccess: doCheckIn,
            onError: () => {
              toast({ title: "Fehler beim Aktualisieren der Personenzahl", variant: "destructive" });
              setPendingCheckIn(null);
              resetScan();
            },
          }
        );
      } else {
        doCheckIn();
      }
    },
    [adminKey, checkIn, updateReservation, queryClient, toast]
  );

  // ── Lookup query (lazy) ──────────────────────────────────────────────────
  const [lookupToken, setLookupToken] = useState("");
  const { data: lookupData, isFetching: lookupFetching, isError: lookupError } = useGetReservationByToken(
    lookupToken,
    {
      query: {
        enabled: !!lookupToken,
        queryKey: getGetReservationByTokenQueryKey(lookupToken),
        retry: false,
        staleTime: 0,
      },
    }
  );

  // ── Lookup pre-check-in fetch ────────────────────────────────────────────
  const [preCheckToken, setPreCheckToken] = useState("");
  const { data: preCheckData, isFetching: preCheckFetching, isError: preCheckError } = useGetReservationByToken(
    preCheckToken,
    {
      query: {
        enabled: !!preCheckToken,
        queryKey: getGetReservationByTokenQueryKey(preCheckToken),
        retry: false,
        staleTime: 0,
      },
    }
  );

  // React to pre-check result
  const prevPreCheckToken = useRef("");
  if (preCheckToken && preCheckToken !== prevPreCheckToken.current && !preCheckFetching) {
    prevPreCheckToken.current = preCheckToken;
    if (preCheckData) {
      if (preCheckData.checkedIn) {
        setScanResult({ status: "already", checkedInAt: preCheckData.checkedInAt });
        setPreCheckToken("");
        resetScan();
      } else {
        setPendingCheckIn(preCheckData);
        setPreCheckToken("");
      }
    } else if (preCheckError) {
      setScanResult({ status: "notfound" });
      setPreCheckToken("");
      resetScan();
    }
  }

  // React to lookup result
  const prevLookupToken = useRef("");
  if (lookupToken && lookupToken !== prevLookupToken.current) {
    prevLookupToken.current = lookupToken;
  }
  if (lookupData && lookupToken && !lookupFetching) {
    const r = lookupData;
    const next: ScanResult = {
      status: "info",
      name: r.name,
      ticketCount: r.ticketCount,
      checkedIn: r.checkedIn,
      checkedInAt: r.checkedInAt,
      specialNeeds: r.specialNeeds,
    };
    if (JSON.stringify(scanResult) !== JSON.stringify(next)) setScanResult(next);
  }
  if (lookupError && lookupToken && !lookupFetching) {
    if (JSON.stringify(scanResult) !== JSON.stringify({ status: "notfound" })) {
      setScanResult({ status: "notfound" });
    }
  }

  const doLookup = useCallback(
    (token: string) => {
      setScanResult(null);
      setLookupToken("");
      setTimeout(() => setLookupToken(token), 10);
      setTokenInput("");
      if (inputMode === "manual") refocusInput();
    },
    [inputMode]
  );

  const doInitiateCheckIn = useCallback(
    (token: string) => {
      setScanResult(null);
      setPendingCheckIn(null);
      setPreCheckToken("");
      setTimeout(() => setPreCheckToken(token), 10);
      setTokenInput("");
    },
    []
  );

  const handleCameraScan = useCallback(
    (token: string) => {
      setScannerLocked(true);
      if (scanMode === "checkin") doInitiateCheckIn(token);
      else doLookup(token);
    },
    [scanMode, doInitiateCheckIn, doLookup]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const t = tokenInput.trim();
    if (!t) return;
    setScannerLocked(true);
    if (scanMode === "checkin") doInitiateCheckIn(t);
    else doLookup(t);
  };

  const isBusy = checkIn.isPending || updateReservation.isPending || lookupFetching || preCheckFetching;

  return (
    <Card className="border-primary/30 bg-card">
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
          <div>
            <CardTitle className="uppercase tracking-wider text-sm text-primary">Einlass-Scanner</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              {scanMode === "checkin"
                ? "QR-Code scannen — Bestätigung vor Eincheck"
                : "QR-Code scannen — nur Anzeige, kein Eincheck"}
            </p>
          </div>
          <Tabs value={scanMode} onValueChange={(v) => { setScanMode(v as ScanMode); setScanResult(null); setPendingCheckIn(null); unlockScanner(); }}>
            <TabsList className="bg-muted/50 border border-border">
              <TabsTrigger value="checkin" className="text-xs uppercase tracking-wider data-[state=active]:bg-primary data-[state=active]:text-white">
                Einchecken
              </TabsTrigger>
              <TabsTrigger value="lookup" className="text-xs uppercase tracking-wider data-[state=active]:bg-muted data-[state=active]:text-white">
                Kontrollieren
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant={inputMode === "manual" ? "default" : "outline"}
            onClick={() => { setInputMode("manual"); setScanResult(null); setPendingCheckIn(null); unlockScanner(); }}
            className="text-xs uppercase tracking-wider"
          >
            Manuell
          </Button>
          <Button
            type="button"
            size="sm"
            variant={inputMode === "camera" ? "default" : "outline"}
            onClick={() => { setInputMode("camera"); setScanResult(null); setPendingCheckIn(null); unlockScanner(); }}
            className="text-xs uppercase tracking-wider"
          >
            Kamera
          </Button>
        </div>

        <QrCameraScanner active={inputMode === "camera"} onScan={handleCameraScan} locked={scannerLocked} />

        {inputMode === "manual" && !pendingCheckIn && (
          <form onSubmit={handleSubmit} className="flex gap-3">
            <Input
              ref={inputRef}
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              placeholder="Token eingeben oder USB-Scanner..."
              className="h-12 font-mono text-sm flex-1"
              autoFocus
              autoComplete="off"
            />
            <Button
              type="submit"
              disabled={isBusy || !tokenInput.trim()}
              className={`h-12 px-6 font-bold uppercase tracking-wider whitespace-nowrap ${
                scanMode === "checkin" ? "bg-primary text-white" : "bg-muted text-white"
              }`}
            >
              {isBusy ? "..." : scanMode === "checkin" ? "Suchen" : "Kontrollieren"}
            </Button>
          </form>
        )}

        {/* Loading indicator for pre-check */}
        {preCheckFetching && (
          <div className="text-center py-2 text-muted-foreground text-sm animate-pulse">Ticket wird gesucht...</div>
        )}

        {/* Confirmation dialog for check-in */}
        {pendingCheckIn && !preCheckFetching && (
          <CheckInConfirm
            reservation={pendingCheckIn}
            isPending={isBusy}
            onConfirm={(actualCount) => confirmCheckIn(pendingCheckIn, actualCount)}
            onCancel={() => { setPendingCheckIn(null); setScanResult(null); unlockScanner(); if (inputMode === "manual") refocusInput(); }}
          />
        )}

        {/* Scan result (shown after confirmation or for lookup) */}
        {scanResult && !pendingCheckIn && (
          <div
            className={`p-4 rounded-lg border text-center animate-in fade-in slide-in-from-bottom-2 ${
              scanResult.status === "ok"
                ? "bg-green-500/10 border-green-500/40"
                : scanResult.status === "info"
                ? scanResult.checkedIn
                  ? "bg-amber-500/10 border-amber-500/40"
                  : "bg-blue-500/10 border-blue-500/40"
                : scanResult.status === "already"
                ? "bg-amber-500/10 border-amber-500/40"
                : "bg-destructive/10 border-destructive/40"
            }`}
          >
            {scanResult.status === "ok" && (
              <>
                <p className="text-2xl font-black text-green-400 uppercase">Eingecheckt</p>
                <p className="text-white mt-1 font-medium">{scanResult.name}</p>
                <p className="text-green-400 text-sm">
                  {scanResult.actualCount} von {scanResult.ticketCount} {scanResult.ticketCount === 1 ? "Person" : "Personen"}
                </p>
                <Button
                  type="button"
                  onClick={() => { setScanResult(null); unlockScanner(); if (inputMode === "manual") refocusInput(); }}
                  className="w-full mt-4 h-10 bg-primary text-white font-bold uppercase tracking-wider"
                >
                  Weiter
                </Button>
              </>
            )}
            {scanResult.status === "already" && (
              <>
                <p className="text-xl font-bold text-amber-400 uppercase">Bereits Entwertet</p>
                {scanResult.checkedInAt && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(scanResult.checkedInAt).toLocaleString("de-DE")}
                  </p>
                )}
                <Button
                  type="button"
                  onClick={() => { setScanResult(null); unlockScanner(); if (inputMode === "manual") refocusInput(); }}
                  className="w-full mt-4 h-10 bg-muted text-white font-bold uppercase tracking-wider"
                >
                  Weiter
                </Button>
              </>
            )}
            {scanResult.status === "info" && (
              <>
                <p className={`text-xl font-bold uppercase ${scanResult.checkedIn ? "text-amber-400" : "text-blue-400"}`}>
                  {scanResult.checkedIn ? "Bereits Entwertet" : "Gültiges Ticket"}
                </p>
                <p className="text-white mt-2 font-semibold text-lg">{scanResult.name}</p>
                <p className={`text-sm ${scanResult.checkedIn ? "text-amber-400" : "text-blue-400"}`}>
                  {scanResult.ticketCount} {scanResult.ticketCount === 1 ? "Person" : "Personen"}
                </p>
                {scanResult.checkedIn && scanResult.checkedInAt && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Entwertet: {new Date(scanResult.checkedInAt).toLocaleString("de-DE")}
                  </p>
                )}
                {scanResult.specialNeeds && (
                  <p className="text-xs text-amber-300 mt-2 border-t border-amber-500/30 pt-2">
                    Besond. Anf.: {scanResult.specialNeeds}
                  </p>
                )}
              </>
            )}
            {scanResult.status === "notfound" && (
              <>
                <p className="text-xl font-bold text-destructive uppercase">Ungültig</p>
                <p className="text-muted-foreground text-sm mt-1">Ticket nicht gefunden.</p>
              </>
            )}
            {scanResult.status === "error" && (
              <>
                <p className="text-xl font-bold text-destructive uppercase">Fehler</p>
                <p className="text-muted-foreground text-sm mt-1">Unbekannter Fehler. Bitte erneut versuchen.</p>
              </>
            )}
            {/* Next button for lookup mode */}
            {scanMode === "lookup" && ["info", "notfound", "error"].includes(scanResult.status) && (
              <Button
                type="button"
                onClick={() => { setScanResult(null); setLookupToken(""); unlockScanner(); if (inputMode === "manual") refocusInput(); }}
                className="w-full mt-4 h-10 bg-muted text-white font-bold uppercase tracking-wider"
              >
                Weiter
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Edit Dialog ──────────────────────────────────────────────────────────────

function EditDialog({
  reservation,
  adminKey,
  open,
  onClose,
}: {
  reservation: Reservation;
  adminKey: string;
  open: boolean;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const updateReservation = useUpdateReservation();
  const deleteReservation = useDeleteReservation();

  const [name, setName] = useState(reservation.name);
  const [email, setEmail] = useState(reservation.email);
  const [ticketCount, setTicketCount] = useState(reservation.ticketCount);
  const [specialNeeds, setSpecialNeeds] = useState(reservation.specialNeeds ?? "");
  const [checkedIn, setCheckedIn] = useState(reservation.checkedIn);
  const [confirmKey, setConfirmKey] = useState("");
  const [keyError, setKeyError] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getListReservationsQueryKey({ adminKey }) });
    queryClient.invalidateQueries({ queryKey: getGetStatsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetReservationByTokenQueryKey(reservation.token) });
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setKeyError(false);
    if (!confirmKey.trim()) { setKeyError(true); return; }

    updateReservation.mutate(
      { id: reservation.id, data: { adminKey: confirmKey, name, email, ticketCount, specialNeeds: specialNeeds || null, checkedIn } },
      {
        onSuccess: () => {
          toast({ title: "Gespeichert", description: `Reservierung für ${name} wurde aktualisiert.` });
          invalidate();
          onClose();
        },
        onError: (err: { status?: number }) => {
          if (err?.status === 401) { setKeyError(true); toast({ title: "Ungültiges Passwort", variant: "destructive" }); }
          else if (err?.status === 409) toast({ title: "E-Mail bereits vergeben", variant: "destructive" });
          else toast({ title: "Fehler beim Speichern", variant: "destructive" });
        },
      }
    );
  };

  const handleDelete = () => {
    if (!confirmKey.trim()) { setKeyError(true); return; }

    deleteReservation.mutate(
      { id: reservation.id, data: { adminKey: confirmKey } },
      {
        onSuccess: () => {
          toast({ title: "Gelöscht", description: `Reservierung von ${reservation.name} wurde gelöscht.` });
          invalidate();
          onClose();
        },
        onError: (err: { status?: number }) => {
          if (err?.status === 401) { setKeyError(true); toast({ title: "Ungültiges Passwort", variant: "destructive" }); }
          else toast({ title: "Fehler beim Löschen", variant: "destructive" });
        },
      }
    );
  };

  const isPending = updateReservation.isPending || deleteReservation.isPending;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="bg-card border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="uppercase tracking-wider text-white">Reservierung bearbeiten</DialogTitle>
        </DialogHeader>

        {showDeleteConfirm ? (
          <div className="space-y-4 mt-2">
            <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/40 text-center space-y-2">
              <p className="text-destructive font-bold uppercase tracking-wider">Wirklich löschen?</p>
              <p className="text-sm text-muted-foreground">
                Reservierung von <strong className="text-white">{reservation.name}</strong> wird dauerhaft entfernt.
              </p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs uppercase tracking-wider text-primary">Admin-Schlüssel zur Bestätigung</Label>
              <Input
                type="password"
                value={confirmKey}
                onChange={(e) => { setConfirmKey(e.target.value); setKeyError(false); }}
                placeholder="Admin-Schlüssel"
                className={keyError ? "border-destructive" : ""}
                autoFocus
              />
              {keyError && <p className="text-destructive text-xs">Ungültiger Schlüssel</p>}
            </div>
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setShowDeleteConfirm(false)} disabled={isPending}>
                Abbrechen
              </Button>
              <Button
                type="button"
                onClick={handleDelete}
                disabled={isPending}
                className="bg-destructive text-white font-bold hover:bg-destructive/90"
              >
                {isPending ? "Lösche..." : "Endgültig löschen"}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-4 mt-2">
            <div className="space-y-1">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">E-Mail</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Anzahl Tickets</Label>
              <Input type="number" min={1} max={10} value={ticketCount} onChange={(e) => setTicketCount(Number(e.target.value))} required />
            </div>
            <div className="space-y-1">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Besondere Anforderungen</Label>
              <Input value={specialNeeds} onChange={(e) => setSpecialNeeds(e.target.value)} placeholder="Optional" />
            </div>

            {/* Status toggle */}
            <div className="space-y-1">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Status</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={!checkedIn ? "default" : "outline"}
                  onClick={() => setCheckedIn(false)}
                  className={!checkedIn ? "bg-muted text-white" : ""}
                >
                  Offen
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={checkedIn ? "default" : "outline"}
                  onClick={() => setCheckedIn(true)}
                  className={checkedIn ? "bg-green-600 text-white hover:bg-green-600/90" : ""}
                >
                  Eingecheckt
                </Button>
              </div>
            </div>

            <div className="pt-3 border-t border-border space-y-1">
              <Label className="text-xs uppercase tracking-wider text-primary">Admin-Schlüssel zur Bestätigung</Label>
              <Input
                type="password"
                value={confirmKey}
                onChange={(e) => { setConfirmKey(e.target.value); setKeyError(false); }}
                placeholder="Admin-Schlüssel"
                className={keyError ? "border-destructive" : ""}
                required
              />
              {keyError && <p className="text-destructive text-xs">Ungültiger Schlüssel</p>}
            </div>

            <DialogFooter className="gap-2 pt-2 flex-wrap">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowDeleteConfirm(true)}
                className="text-destructive border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
                disabled={isPending}
              >
                Löschen
              </Button>
              <div className="flex gap-2 ml-auto">
                <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>Abbrechen</Button>
                <Button type="submit" disabled={isPending} className="bg-primary text-white font-bold">
                  {isPending ? "Speichere..." : "Speichern"}
                </Button>
              </div>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Admin() {
  const [adminKey, setAdminKey] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [editingReservation, setEditingReservation] = useState<Reservation | null>(null);

  const { data: stats, isLoading: statsLoading } = useGetStats({
    query: { queryKey: getGetStatsQueryKey() },
  });

  const {
    data: reservations,
    isLoading: reservationsLoading,
    isError,
  } = useListReservations(
    { adminKey },
    {
      query: {
        enabled: isAuthenticated && !!adminKey,
        queryKey: getListReservationsQueryKey({ adminKey }),
        retry: false,
      },
    }
  );

  const handleAuth = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminKey) setIsAuthenticated(true);
  };

  // ── Login screen ─────────────────────────────────────────────────────────
  if (!isAuthenticated) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center p-6 bg-background">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold uppercase tracking-widest text-white">Admin Login</h1>
            <p className="text-muted-foreground">Reservierungsverwaltung für EMPOWERMENT</p>
          </div>
          <Card className="border-primary/20">
            <CardContent className="p-8">
              <form onSubmit={handleAuth} className="space-y-6">
                <Input
                  type="password"
                  placeholder="Admin-Schlüssel eingeben"
                  value={adminKey}
                  onChange={(e) => setAdminKey(e.target.value)}
                  className="h-12 text-center text-lg"
                  autoFocus
                />
                <Button type="submit" className="w-full h-12 bg-primary text-white font-bold tracking-widest uppercase">
                  Anmelden
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // ── Verifying (loading after submit, before first response) ──────────────
  if (reservationsLoading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground text-sm uppercase tracking-widest">Wird geladen...</p>
        </div>
      </div>
    );
  }

  // ── Wrong key ────────────────────────────────────────────────────────────
  if (isError) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center p-6 bg-background">
        <Card className="w-full max-w-md border-destructive">
          <CardContent className="p-8 text-center space-y-6">
            <h2 className="text-2xl font-bold text-destructive uppercase">Zugriff verweigert</h2>
            <p className="text-muted-foreground">Der eingegebene Admin-Schlüssel ist ungültig.</p>
            <Button onClick={() => { setIsAuthenticated(false); setAdminKey(""); }} variant="outline" className="w-full">
              Erneut versuchen
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Dashboard ────────────────────────────────────────────────────────────
  return (
    <div className="min-h-[100dvh] bg-background p-6 md:p-12">
      <div className="max-w-6xl mx-auto space-y-8">

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold uppercase tracking-widest text-white">Dashboard</h1>
            <p className="text-primary mt-1">EMPOWERMENT Theater Ticket System</p>
          </div>
          <Button variant="outline" onClick={() => { setIsAuthenticated(false); setAdminKey(""); }}>
            Abmelden
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="bg-card border-primary/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Reservierungen</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-black text-white">{statsLoading ? "..." : stats?.totalReservations ?? 0}</div>
            </CardContent>
          </Card>
          <Card className="bg-card border-primary/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Vergebene Tickets</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-black text-white">{statsLoading ? "..." : stats?.totalTickets ?? 0}</div>
            </CardContent>
          </Card>
          <Card className="bg-card border-primary/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Eingecheckt</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-black text-primary">{statsLoading ? "..." : stats?.totalCheckedIn ?? 0}</div>
            </CardContent>
          </Card>
        </div>

        {/* Scanner */}
        <ScannerSection adminKey={adminKey} />

        {/* Table */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="uppercase tracking-wider">Alle Reservierungen</CardTitle>
          </CardHeader>
          <CardContent>
            {!reservations || reservations.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">Keine Reservierungen gefunden.</div>
            ) : (
              <div className="rounded-md border border-border overflow-hidden overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead className="w-[180px]">Name</TableHead>
                      <TableHead>E-Mail</TableHead>
                      <TableHead className="text-center w-20">Tickets</TableHead>
                      <TableHead>Besondere Anforderungen</TableHead>
                      <TableHead className="text-center w-28">Status</TableHead>
                      <TableHead className="text-right w-24">Aktion</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reservations.map((res) => (
                      <TableRow key={res.id}>
                        <TableCell className="font-medium text-white">{res.name}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{res.email}</TableCell>
                        <TableCell className="text-center font-bold text-white">{res.ticketCount}</TableCell>
                        <TableCell className="text-muted-foreground text-sm max-w-[180px] truncate" title={res.specialNeeds ?? ""}>
                          {res.specialNeeds || "–"}
                        </TableCell>
                        <TableCell className="text-center">
                          {res.checkedIn ? (
                            <Badge className="bg-green-500/20 text-green-500 border-none hover:bg-green-500/30 text-xs">Eingecheckt</Badge>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground border-muted-foreground/30 text-xs">Offen</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingReservation(res)}
                            className="text-xs text-muted-foreground hover:text-white"
                          >
                            Bearbeiten
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

      </div>

      {editingReservation && (
        <EditDialog
          reservation={editingReservation}
          adminKey={adminKey}
          open={!!editingReservation}
          onClose={() => setEditingReservation(null)}
        />
      )}
    </div>
  );
}
