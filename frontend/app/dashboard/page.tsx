"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Activity, BarChart3, CloudSun, Droplets, FileText, Leaf, MapPinned, Package, Sprout, Users } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import {
  ExternalSeedAnalysis,
  ExternalSeedLot,
  Plot,
  Producer,
  fetchAgentRuntimeContext,
  fetchExternalSeedAnalyses,
  fetchExternalSeedLots,
  fetchPlots,
  fetchProducers,
} from "@/lib/api";

type LoadState = "loading" | "ready" | "partial";

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatArea(totalM2: number) {
  if (!totalM2) return "0 ha";
  return `${(totalM2 / 10000).toFixed(1)} ha`;
}

function formatPercent(value: number) {
  return `${Math.round(value)}%`;
}

function getContextItems(context: Record<string, unknown>, key: string): any[] {
  const value = context[key];
  return Array.isArray(value) ? value : [];
}

export default function DashboardOverviewPage() {
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [producers, setProducers] = useState<Producer[]>([]);
  const [plots, setPlots] = useState<Plot[]>([]);
  const [seedLots, setSeedLots] = useState<ExternalSeedLot[]>([]);
  const [seedAnalyses, setSeedAnalyses] = useState<ExternalSeedAnalysis[]>([]);
  const [context, setContext] = useState<Record<string, unknown>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = window.localStorage.getItem("nexo-token") ?? undefined;

    async function loadDashboardData() {
      setLoadState("loading");
      setError(null);
      const results = await Promise.allSettled([
        fetchProducers(token),
        fetchPlots(token),
        fetchExternalSeedLots(token),
        fetchExternalSeedAnalyses(token),
        fetchAgentRuntimeContext(token),
      ]);

      const [producerResult, plotResult, lotResult, analysisResult, contextResult] = results;

      if (producerResult.status === "fulfilled") setProducers(producerResult.value);
      if (plotResult.status === "fulfilled") setPlots(plotResult.value);
      if (lotResult.status === "fulfilled") setSeedLots(lotResult.value);
      if (analysisResult.status === "fulfilled") setSeedAnalyses(analysisResult.value);
      if (contextResult.status === "fulfilled") setContext(contextResult.value);

      const failed = results.filter((result) => result.status === "rejected").length;
      if (failed) {
        setLoadState("partial");
        setError("Algunos datos no respondieron, se muestra el resumen disponible.");
      } else {
        setLoadState("ready");
      }
    }

    void loadDashboardData();
  }, []);

  const weatherSnapshots = getContextItems(context, "weather_snapshots");
  const irrigationContext = getContextItems(context, "irrigation_fao56_context");
  const externalSeedContext = getContextItems(context, "seed_verifier_external_contexts");

  const metrics = useMemo(() => {
    const totalAreaM2 = plots.reduce((sum, plot) => sum + toNumber(plot.area_m2, toNumber(plot.area_ha, 0) * 10000), 0);
    const avgConfidence = seedAnalyses.length
      ? seedAnalyses.reduce((sum, analysis) => sum + toNumber(analysis.probability, 0), 0) / seedAnalyses.length * 100
      : toNumber((externalSeedContext[0] as any)?.latest_seed_analysis?.confidence_percent, 0);
    const recommendedM3 = irrigationContext.reduce((sum, item: any) => sum + toNumber(item?.fao56_estimate?.recommended_m3_today, 0), 0);

    return {
      totalAreaM2,
      avgConfidence,
      recommendedM3,
      recentAnalyses: seedAnalyses.length || ((externalSeedContext[0] as any)?.recent_samples?.length ?? 0),
    };
  }, [externalSeedContext, irrigationContext, plots, seedAnalyses]);

  const recentPlots = plots.slice(0, 4);
  const recentLots = seedLots.slice(0, 4);

  return (
    <AppShell title="Panel principal" eyebrow="Resumen NEXO">
      <section className="overviewHero">
        <span className="overviewHeroIcon"><Sprout size={42} /></span>
        <div>
          <p className="eyebrow">Bienvenido al sistema</p>
          <h2>Control operativo de semillas, parcelas y riego.</h2>
          <p>Vista general con los datos registrados en NEXO y el contexto disponible para decisiones FAO-56.</p>
        </div>
        <div className={loadState === "ready" ? "overviewStatus ready" : "overviewStatus"}>
          {loadState === "loading" ? "Cargando datos" : loadState === "partial" ? "Resumen parcial" : "Datos actualizados"}
        </div>
      </section>

      {error ? <div className="inlineError">{error}</div> : null}

      <section className="overviewMetricGrid">
        <MetricCard tone="blue" icon={<Activity />} label="Total analisis" value={String(seedAnalyses.length)} helper={`${metrics.recentAnalyses} recientes`} />
        <MetricCard tone="green" icon={<BarChart3 />} label="Calidad promedio" value={formatPercent(metrics.avgConfidence)} helper="Segun analisis disponibles" />
        <MetricCard tone="purple" icon={<MapPinned />} label="Parcelas registradas" value={String(plots.length)} helper={formatArea(metrics.totalAreaM2)} />
        <MetricCard tone="amber" icon={<Package />} label="Lotes de semillas" value={String(seedLots.length)} helper="Lotes consultados" />
        <MetricCard tone="cyan" icon={<CloudSun />} label="Clima guardado" value={String(weatherSnapshots.length)} helper="Snapshots recientes" />
        <MetricCard tone="emerald" icon={<Droplets />} label="Riego estimado" value={`${metrics.recommendedM3.toFixed(1)} m3`} helper="Recomendado hoy" />
      </section>

      <section className="overviewContentGrid">
        <article className="overviewPanel">
          <div className="overviewPanelHeader">
            <div>
              <p className="eyebrow">Parcelas</p>
              <h3>Ultimas zonas registradas</h3>
            </div>
            <Link href="/irrigation">Ver mapa</Link>
          </div>
          <div className="overviewList">
            {recentPlots.length ? recentPlots.map((plot) => (
              <div key={plot.id} className="overviewListItem">
                <span><Leaf size={18} /></span>
                <div>
                  <strong>{plot.name}</strong>
                  <small>{plot.code || "Sin codigo"} · {formatArea(toNumber(plot.area_m2, toNumber(plot.area_ha, 0) * 10000))}</small>
                </div>
              </div>
            )) : <EmptyState text="Aun no hay parcelas registradas." />}
          </div>
        </article>

        <article className="overviewPanel">
          <div className="overviewPanelHeader">
            <div>
              <p className="eyebrow">Semillas</p>
              <h3>Lotes recientes</h3>
            </div>
            <Link href="/upload">Verificar</Link>
          </div>
          <div className="overviewList">
            {recentLots.length ? recentLots.map((lot) => (
              <div key={lot.lot_id} className="overviewListItem">
                <span><Package size={18} /></span>
                <div>
                  <strong>{lot.variety || lot.species || "Lote de semilla"}</strong>
                  <small>{lot.producer || lot.created_by || "Productor sin nombre"} · {lot.category || "Sin categoria"}</small>
                </div>
              </div>
            )) : <EmptyState text="Aun no hay lotes disponibles." />}
          </div>
        </article>

        <article className="overviewPanel wide">
          <div className="overviewPanelHeader">
            <div>
              <p className="eyebrow">Actividad</p>
              <h3>Resumen del sistema</h3>
            </div>
          </div>
          <div className="overviewActivityGrid">
            <SmallFact icon={<Users />} label="Productores" value={producers.length} />
            <SmallFact icon={<FileText />} label="Contextos FAO" value={irrigationContext.length} />
            <SmallFact icon={<CloudSun />} label="Clima" value={weatherSnapshots.length} />
            <SmallFact icon={<Sprout />} label="Analisis semilla" value={seedAnalyses.length} />
          </div>
        </article>
      </section>
    </AppShell>
  );
}

function MetricCard({ icon, label, value, helper, tone }: { icon: React.ReactNode; label: string; value: string; helper: string; tone: string }) {
  return (
    <article className={`overviewMetric ${tone}`}>
      <span>{icon}</span>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        <small>{helper}</small>
      </div>
    </article>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p className="overviewEmpty">{text}</p>;
}

function SmallFact({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="overviewFact">
      <span>{icon}</span>
      <small>{label}</small>
      <strong>{value}</strong>
    </div>
  );
}
