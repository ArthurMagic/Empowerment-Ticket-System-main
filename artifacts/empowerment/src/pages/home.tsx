import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useGetStats, getGetStatsQueryKey, useCreateReservation} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { maxTickets } from "@workspace/config";


const formSchema = z.object({
  firstName: z.string().min(1, { message: "Vorname erforderlich" }),
  lastName: z.string().min(1, { message: "Nachname erforderlich" }),
  email: z.string().email({ message: "Ungültige E-Mail-Adresse" }),
  ticketCount: z.coerce.number().min(1).max(10),
  specialNeeds: z.string().optional(),
  dsgvo: z.boolean().refine((val) => val === true, {
    message: "Sie müssen der DSGVO zustimmen, um fortzufahren",
  }),
});
  
export default function Home() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const createReservation = useCreateReservation();

   const { data: stats, isLoading: statsLoading } = useGetStats({
    query: { queryKey: getGetStatsQueryKey() },
  });
console.log("Max Tickets:", maxTickets);
  console.log("Aktuelle Stats:", stats, "Loading:", statsLoading);
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      ticketCount: 1,
      specialNeeds: "",
      dsgvo: false,
    },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    createReservation.mutate(
      {
        data: {
          name: `${values.firstName.trim()} ${values.lastName.trim()}`,
          email: values.email,
          ticketCount: values.ticketCount,
          specialNeeds: values.specialNeeds || undefined,
        },
      },
      {
        onSuccess: (data) => {
          toast({ title: "Reservierung erfolgreich!", description: "Sie werden nun weitergeleitet." });
          setLocation(`/success/${data.token}`);
        },
        onError: (err: { status?: number }) => {
          if (err?.status === 409) {
            toast({
              title: "E-Mail bereits registriert",
              description: "Mit dieser E-Mail-Adresse existiert bereits eine Reservierung.",
              variant: "destructive",
            });
          } else if(err?.status === 403){
            toast({
              title: "Fehler",
              description: "Alle verfügbaren Tickets wurden bereits reserviert.",
              variant: "destructive",
            })
          }
          else if(err?.status === 406){
            toast({
              title: "Fehler",
              description: "Leider sind nicht mehr genügend Tickets verfügbar, um Ihre Reservierung zu erfüllen. Bitte reduzieren Sie die Anzahl der Tickets oder kontaktieren Sie uns direkt.",
              variant: "destructive",
            })
          }
          else {
            toast({
              title: "Fehler",
              description: "Ihre Reservierung konnte nicht verarbeitet werden. Bitte versuchen Sie es erneut.",
              variant: "destructive",
            });
          }
        },
      }
    );
  };

  return (
    <div className="min-h-[100dvh] w-full flex flex-col bg-background text-foreground selection:bg-primary selection:text-white">
      {/* Hero Section */}
      <section className="relative w-full py-24 md:py-32 flex flex-col items-center justify-center overflow-hidden border-b border-border">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/20 via-background to-background pointer-events-none" />

        <div className="z-10 text-center px-4 w-full max-w-5xl mx-auto space-y-6">
          <h2 className="text-primary font-bold tracking-widest uppercase text-sm md:text-base">Ein mutiges Theatererlebnis</h2>
          {/* fluid font-size prevents overflow on any screen width */}
          <h1
            className="font-black uppercase tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-white to-white/70 drop-shadow-[0_0_15px_rgba(255,0,128,0.5)] leading-none w-full"
            style={{ fontSize: "clamp(1.5rem, 8vw, 6rem)" }}
          >
            EMPOWERMENT
          </h1>
          <p className="text-xl md:text-3xl font-light text-muted-foreground tracking-wide uppercase">
            Barbie · Ken · Power
          </p>
        </div>
      </section>

      {/* Details & Form Section */}
      <section className="w-full max-w-6xl mx-auto px-4 py-16 grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-24">

        {/* Event Details */}
        <div className="space-y-10">
          <div>
            <h3 className="text-3xl font-bold text-white mb-6 uppercase tracking-wider border-b border-primary/30 pb-4">Die Inszenierung</h3>
            <p className="text-lg text-muted-foreground leading-relaxed">
              Ein fesselndes Jugendtheaterstück, das tief in die Ikonographie von Barbie und Ken eintaucht, um Fragen von Macht, Identität und Geschlechterrollen zu erforschen. Seien Sie bereit für einen Abend voller Provokation und Energie.
            </p>
          </div>

          <div className="space-y-6 bg-card border border-primary/20 p-8 rounded-xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
            <div className="grid grid-cols-1 gap-6">
              <div>
                <p className="text-sm text-primary uppercase tracking-widest font-semibold">Wann</p>
                <p className="text-xl text-white font-medium">30. Juni 2026, 19:00 Uhr</p>
              </div>
              <div>
                <p className="text-sm text-primary uppercase tracking-widest font-semibold">Wo</p>
                <p className="text-xl text-white font-medium">Haus der Jugend Charlottenburg</p>
                <p className="text-muted-foreground">Zillestr. 54, 10585 Berlin</p>
              </div>
              <div>
                <p className="text-sm text-primary uppercase tracking-widest font-semibold">Eintritt</p>
                <p className="text-xl text-white font-medium">Kostenlos</p>
                <p className="text-muted-foreground">Reservierung erforderlich</p>
              </div>
            </div>
          </div>

          <div className="space-y-4 text-sm text-muted-foreground/80">
            <p><strong className="text-white">Veranstalter:</strong> Jugendamt Charlottenburg-Wilmersdorf, Jugendclubring Berlin e.V. & Kinder- und Jugendparlament Charlottenburg-Wilmersdorf</p>
            <p><strong className="text-white">Schirmherrschaft:</strong> Bezirksstadtrat Simon Hertel</p>
            <p><strong className="text-white">In Anwesenheit von:</strong> Bezirksbürgermeisterin Kerstin Bauch & Bürgermeister Francesco Ianeselli (Trento)</p>
            <p><strong className="text-white">Kontext:</strong> 60-jährige Städtepartnerschaft Charlottenburg-Wilmersdorf ↔ Trento</p>
            <p className="pt-4 border-t border-border mt-4">
              Fragen? Kontaktieren Sie uns: <a href="tel:030902912775" className="text-primary hover:underline">030 902912775</a> oder <a href="mailto:projekt@zille54.de" className="text-primary hover:underline">projekt@zille54.de</a>
            </p>
          </div>
        </div>

        {/* Reservation Form */}
        <div id="tickets">
          <Card className="border-primary/20 bg-background/50 backdrop-blur-sm relative z-10 shadow-[0_0_50px_rgba(255,0,128,0.05)]">
            <CardContent className="p-8">
              <h3 className="text-2xl font-bold text-white mb-8 uppercase tracking-wider">Tickets Reservieren</h3>
              {statsLoading ? (
                <p className="text-muted-foreground">Lädt...</p>
              ) : stats?.totalTickets !== undefined && stats.totalTickets >= maxTickets ? (
                <div className="space-y-4">
                  <p className="text-xl text-white font-medium">Leider wurden bereits alle verfügbaren Tickets reserverviert.</p>
                  <p className="text-xl text-white font-medium">Kontaktieren Sie uns gerne per <a href="mailto:projekt@zille54.de" className="text-primary hover:underline">projekt@zille54.de</a> oder <a href="tel:03090291775" className="text-primary hover:underline">030 90291775</a> und wir probieren Ihrem Wunsch nachzukommen.</p>
                </div>
              ):(
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

                  {/* Vorname + Nachname nebeneinander */}
                  <div className="grid grid-cols-2 gap-3">
                    <FormField
                      control={form.control}
                      name="firstName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-white uppercase tracking-wider text-xs">Vorname</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Max"
                              className="bg-background/50 border-primary/30 focus-visible:ring-primary h-12"
                              data-testid="input-first-name"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="lastName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-white uppercase tracking-wider text-xs">Nachname</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Mustermann"
                              className="bg-background/50 border-primary/30 focus-visible:ring-primary h-12"
                              data-testid="input-last-name"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-white uppercase tracking-wider text-xs">E-Mail-Adresse</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="mail@beispiel.de" className="bg-background/50 border-primary/30 focus-visible:ring-primary h-12" data-testid="input-email" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="ticketCount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-white uppercase tracking-wider text-xs">Anzahl Tickets</FormLabel>
                        <Select onValueChange={(val) => field.onChange(parseInt(val))} defaultValue={field.value.toString()}>
                          <FormControl>
                            <SelectTrigger className="bg-background/50 border-primary/30 focus:ring-primary h-12" data-testid="select-ticket-count">
                              <SelectValue placeholder="Wählen Sie die Anzahl" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                              <SelectItem key={num} value={num.toString()}>
                                {num} {num === 1 ? "Ticket" : "Tickets"}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="specialNeeds"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-white uppercase tracking-wider text-xs">Besondere Anforderungen (Optional)</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Rollstuhlplatz, Hörgeräte, etc."
                            className="bg-background/50 border-primary/30 focus-visible:ring-primary min-h-[100px] resize-none"
                            data-testid="textarea-special-needs"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="dsgvo"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border border-primary/20 p-4 bg-primary/5">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            className="border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground mt-1"
                            data-testid="checkbox-dsgvo"
                          />
                        </FormControl>
                        <div className="space-y-1 leading-relaxed">
                          <FormLabel className="text-sm font-normal text-muted-foreground">
                            Ich stimme der Verarbeitung meiner Daten zur Verwaltung meiner Reservierung gemäß der DSGVO zu. Meine Daten werden nach der Veranstaltung gelöscht.
                          </FormLabel>
                          <FormMessage />
                        </div>
                      </FormItem>
                    )}
                  />

                  <Button
                    type="submit"
                    className="w-full h-14 text-lg font-bold uppercase tracking-widest bg-primary hover:bg-primary/90 text-white shadow-[0_0_20px_rgba(255,0,128,0.4)] transition-all duration-300"
                    disabled={createReservation.isPending}
                    data-testid="button-submit"
                  >
                    {createReservation.isPending ? "Wird reserviert..." : "Ticket reservieren"}
                  </Button>
                </form>
              </Form>
              )}
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
