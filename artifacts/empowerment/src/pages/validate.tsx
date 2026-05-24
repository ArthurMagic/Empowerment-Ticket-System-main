import { useState } from "react";
import { useParams } from "wouter";
import {
  useGetReservationByToken,
  getGetReservationByTokenQueryKey,
  useCheckInReservation,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

export default function Validate() {
  const params = useParams();
  const token = params.token || "";
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [adminKey, setAdminKey] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authError, setAuthError] = useState(false);

  const { data: reservation, isLoading, isError } = useGetReservationByToken(token, {
    query: {
      enabled: isAuthenticated && !!token,
      queryKey: getGetReservationByTokenQueryKey(token),
      retry: false,
    },
  });

  const checkIn = useCheckInReservation();

  const handleAuth = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminKey.trim()) {
      setAuthError(false);
      setIsAuthenticated(true);
    }
  };

  const handleCheckIn = () => {
    checkIn.mutate(
      { token, data: { adminKey } },
      {
        onSuccess: (updated) => {
          queryClient.setQueryData(getGetReservationByTokenQueryKey(token), updated);
          toast({ title: "Eingecheckt", description: `${updated.name} wurde erfolgreich entwertet.` });
        },
        onError: (err: { status?: number }) => {
          if (err?.status === 401) {
            setAuthError(true);
            setIsAuthenticated(false);
            setAdminKey("");
            toast({ title: "Ungültiger Admin-Schlüssel", variant: "destructive" });
          } else {
            toast({ title: "Fehler", description: "Ticket bereits entwertet oder nicht gefunden.", variant: "destructive" });
          }
        },
      }
    );
  };

  // Login gate — nothing visible without admin key
  if (!isAuthenticated) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center p-6 bg-background">
        <div className="w-full max-w-sm space-y-8">
          <div className="text-center space-y-2">
            <p className="text-xs font-bold text-primary uppercase tracking-widest">Ticketkontrolle</p>
            <h1 className="text-3xl font-black text-white uppercase tracking-wider">Zugang</h1>
            <p className="text-sm text-muted-foreground">Admin-Schlüssel erforderlich</p>
          </div>
          <Card className="border-primary/20">
            <CardContent className="p-6">
              <form onSubmit={handleAuth} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="key" className="text-xs uppercase tracking-wider text-muted-foreground">Admin-Schlüssel</Label>
                  <Input
                    id="key"
                    type="password"
                    placeholder="Schlüssel eingeben"
                    value={adminKey}
                    onChange={(e) => setAdminKey(e.target.value)}
                    className="h-14 text-center text-lg"
                    autoFocus
                    data-testid="input-admin-key"
                  />
                  {authError && <p className="text-destructive text-sm text-center">Ungültiger Schlüssel</p>}
                </div>
                <Button
                  type="submit"
                  className="w-full h-12 bg-primary text-white font-bold uppercase tracking-widest"
                  data-testid="button-auth-submit"
                >
                  Anmelden
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center p-6 bg-background">
        <Card className="w-full max-w-sm">
          <CardContent className="p-8 space-y-6">
            <Skeleton className="w-full h-12" />
            <Skeleton className="w-full h-8" />
            <Skeleton className="w-full h-16" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isError || !reservation) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center p-6 bg-background">
        <Card className="w-full max-w-sm border-destructive">
          <CardContent className="p-8 text-center space-y-4">
            <div className="w-16 h-16 bg-destructive/20 text-destructive rounded-full flex items-center justify-center mx-auto mb-4 text-3xl font-bold">!</div>
            <h2 className="text-2xl font-bold text-destructive uppercase">Ticket Ungültig</h2>
            <p className="text-muted-foreground">Dieses Ticket existiert nicht.</p>
            <Button variant="outline" onClick={() => setIsAuthenticated(false)} className="w-full">
              Zurück
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isCheckedIn = reservation.checkedIn;

  return (
    <div className={`min-h-[100dvh] flex flex-col items-center justify-center p-6 transition-colors duration-500 ${isCheckedIn ? "bg-green-950/30" : "bg-background"}`}>
      <Card className={`w-full max-w-sm overflow-hidden border-2 ${isCheckedIn ? "border-green-500/50" : "border-primary/50"}`}>
        <div className={`h-3 w-full ${isCheckedIn ? "bg-green-500" : "bg-primary"}`} />
        <CardContent className="p-8 space-y-8 text-center">

          <div>
            <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-1">Ticket Inhaber</h2>
            <p className="text-3xl font-black text-white" data-testid="text-name">{reservation.name}</p>
          </div>

          <div className="bg-muted/30 py-4 rounded-xl border border-border">
            <p className="text-sm text-muted-foreground uppercase tracking-wider mb-1">Anzahl Tickets</p>
            <p className="text-5xl font-black text-white" data-testid="text-ticket-count">{reservation.ticketCount}</p>
          </div>

          {isCheckedIn ? (
            <div className="space-y-3">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-green-500/20 text-green-500 rounded-full mb-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-green-500 uppercase">Bereits Entwertet</h3>
              <p className="text-sm text-muted-foreground">
                {reservation.checkedInAt ? new Date(reservation.checkedInAt).toLocaleString("de-DE") : ""}
              </p>
            </div>
          ) : (
            <Button
              onClick={handleCheckIn}
              disabled={checkIn.isPending}
              className="w-full h-16 text-xl font-bold uppercase tracking-widest bg-primary hover:bg-primary/90 text-white"
              data-testid="button-check-in"
            >
              {checkIn.isPending ? "Wird entwertet..." : "Ticket Einchecken"}
            </Button>
          )}

          {reservation.specialNeeds && (
            <div className="mt-4 p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg text-left">
              <h4 className="text-amber-500 font-bold uppercase text-xs tracking-wider mb-2">Besondere Anforderungen</h4>
              <p className="text-amber-100 text-sm">{reservation.specialNeeds}</p>
            </div>
          )}

        </CardContent>
      </Card>

      <button
        onClick={() => { setIsAuthenticated(false); setAdminKey(""); }}
        className="mt-6 text-xs text-muted-foreground hover:text-primary transition-colors uppercase tracking-wider"
        data-testid="button-logout"
      >
        Abmelden
      </button>
    </div>
  );
}
