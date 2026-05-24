import { useEffect, useState } from "react";
import { useParams, Link } from "wouter";
import QRCode from "qrcode";
import { useGetReservationByToken, getGetReservationByTokenQueryKey } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function Success() {
  const params = useParams();
  const token = params.token || "";
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");

  const { data: reservation, isLoading, isError } = useGetReservationByToken(token, {
    query: {
      enabled: !!token,
      queryKey: getGetReservationByTokenQueryKey(token),
    },
  });

  useEffect(() => {
    if (token) {
      // QR code encodes the raw token only — scanning requires the admin tool
      QRCode.toDataURL(token, {
        color: { dark: "#000000", light: "#ffffff" },
        margin: 2,
        width: 300,
      })
        .then((url) => setQrCodeUrl(url))
        .catch((err) => console.error("QR Code generation failed", err));
    }
  }, [token]);

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-primary/20 bg-background/80 backdrop-blur">
          <CardContent className="p-8 flex flex-col items-center space-y-6">
            <Skeleton className="w-16 h-16 rounded-full" />
            <Skeleton className="w-3/4 h-8" />
            <Skeleton className="w-64 h-64 rounded-xl" />
            <Skeleton className="w-full h-12" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isError || !reservation) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-destructive/50 bg-destructive/10">
          <CardContent className="p-8 text-center space-y-4">
            <h2 className="text-2xl font-bold text-destructive uppercase">Fehler</h2>
            <p className="text-muted-foreground">Reservierung konnte nicht gefunden werden.</p>
            <Link href="/" className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors bg-primary text-primary-foreground shadow hover:bg-primary/90 h-10 px-8 py-2 w-full mt-4">
              Zurück zur Startseite
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center p-4 bg-background relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="z-10 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white uppercase tracking-widest mb-2">Reservierung Bestätigt</h1>
          <p className="text-primary text-lg">Wir freuen uns auf Sie!</p>
        </div>

        <Card className="border-primary/30 bg-card/80 backdrop-blur shadow-[0_0_30px_rgba(255,0,128,0.15)] overflow-hidden">
          <div className="h-2 w-full bg-primary" />
          <CardContent className="p-8 flex flex-col items-center">

            {qrCodeUrl ? (
              <div className="bg-white p-4 rounded-xl shadow-lg mb-8">
                <img src={qrCodeUrl} alt="Ticket QR Code" className="w-64 h-64 object-contain" data-testid="img-qr-code" />
              </div>
            ) : (
              <Skeleton className="w-64 h-64 rounded-xl mb-8" />
            )}

            <div className="w-full space-y-4 border-t border-border pt-6">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground text-sm uppercase tracking-wider">Name</span>
                <span className="text-white font-medium" data-testid="text-name">{reservation.name}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground text-sm uppercase tracking-wider">Tickets</span>
                <span className="text-white font-medium bg-primary/20 text-primary px-3 py-1 rounded-md" data-testid="text-ticket-count">{reservation.ticketCount}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground text-sm uppercase tracking-wider">Datum</span>
                <span className="text-white font-medium">30. Juni 2026, 19:00</span>
              </div>
            </div>

            <div className="w-full mt-8 p-4 bg-muted/50 rounded-lg text-center text-sm text-muted-foreground">
              Bitte zeigen Sie diesen QR-Code am Einlass vor. Eine Bestätigungsmail wurde an Ihre E-Mail-Adresse versendet.
            </div>
          </CardContent>
        </Card>

        <div className="mt-8 text-center">
          <Link href="/" className="text-muted-foreground hover:text-primary transition-colors text-sm uppercase tracking-wider">
            Zurück zur Startseite
          </Link>
        </div>
      </div>
    </div>
  );
}
