"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Bot, DatabaseZap, Loader2, Send, Sparkles } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { AgentChatMessage, fetchAgentRuntimeContext, sendAgentChatMessage } from "@/lib/api";

const starterPrompts = [
  "Que salio en las pruebas de semillas del productor KF001?",
  "Resume los riesgos de calidad del lote de KF001.",
  "Resume el estado actual de mis parcelas.",
  "Que datos faltan para calcular mejor el riego?",
  "Explicame el ahorro de agua con FAO-56.",
];

function countItems(context: Record<string, unknown> | null, key: string) {
  const value = context?.[key];
  return Array.isArray(value) ? value.length : 0;
}

export default function AssistantPage() {
  const [messages, setMessages] = useState<AgentChatMessage[]>([
    {
      role: "assistant",
      content: "Hola, soy el asistente de NEXO. Puedo ayudarte a interpretar parcelas, clima, semillas y decisiones de riego.",
    },
  ]);
  const [input, setInput] = useState("");
  const [context, setContext] = useState<Record<string, unknown> | null>(null);
  const [contextError, setContextError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const contextStats = useMemo(
    () => [
      { label: "Productores", value: countItems(context, "producers") },
      { label: "Parcelas", value: countItems(context, "plots") },
      { label: "Campanas", value: countItems(context, "campaigns") },
      { label: "Clima", value: countItems(context, "weather_snapshots") },
      { label: "Semillas", value: countItems(context, "seed_analysis_results") },
      { label: "SeedDSS", value: countItems(context, "seed_verifier_external_contexts") },
      { label: "Riego", value: countItems(context, "irrigation_recommendations") },
    ],
    [context]
  );

  useEffect(() => {
    const token = window.localStorage.getItem("nexo-token") ?? undefined;
    fetchAgentRuntimeContext(token)
      .then(setContext)
      .catch((caught) => setContextError(caught instanceof Error ? caught.message : "No se pudo cargar el contexto."));
  }, []);

  async function sendMessage(nextMessage?: string) {
    const content = (nextMessage ?? input).trim();
    if (!content || busy) return;

    const token = window.localStorage.getItem("nexo-token") ?? undefined;
    const nextMessages: AgentChatMessage[] = [...messages, { role: "user", content }];
    setMessages(nextMessages);
    setInput("");
    setBusy(true);
    setError(null);

    try {
      const response = await sendAgentChatMessage(content, nextMessages.slice(0, -1), context ?? undefined, token);
      setMessages([...nextMessages, { role: "assistant", content: response.answer }]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo consultar el asistente.");
      setMessages(nextMessages);
    } finally {
      setBusy(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendMessage();
  }

  return (
    <AppShell title="Asistente IA" eyebrow="Gemini para NEXO">
      <section className="assistantScreen">
        <div className="assistantContextPanel">
          <div className="assistantHero">
            <span>
              <Sparkles size={22} />
            </span>
            <div>
              <p className="eyebrow">Agente preparado</p>
              <h2>Chat tecnico con datos del sistema</h2>
              <p>
                Esta pantalla ya carga un contexto operativo desde la API para que Gemini pueda responder sobre parcelas,
                clima, semillas y riego cuando esos datos existan.
              </p>
            </div>
          </div>

          <div className="assistantContextCard">
            <div>
              <DatabaseZap size={20} />
              <strong>Contexto conectado</strong>
            </div>
            {contextError ? <p className="inlineError">{contextError}</p> : null}
            <div className="assistantStatsGrid">
              {contextStats.map((item) => (
                <article key={item.label}>
                  <strong>{item.value}</strong>
                  <span>{item.label}</span>
                </article>
              ))}
            </div>
          </div>

          <div className="assistantPromptList">
            <p>Prueba rapida</p>
            {starterPrompts.map((prompt) => (
              <button key={prompt} type="button" onClick={() => void sendMessage(prompt)} disabled={busy}>
                {prompt}
              </button>
            ))}
          </div>
        </div>

        <aside className="assistantChatPanel" aria-label="Chat con Gemini">
          <header>
            <span>
              <Bot size={22} />
            </span>
            <div>
              <strong>Chat NEXO</strong>
              <small>Gemini AI Studio</small>
            </div>
          </header>

          <div className="assistantMessages">
            {messages.map((message, index) => (
              <article key={`${message.role}-${index}`} className={message.role === "user" ? "chatBubble user" : "chatBubble assistant"}>
                <span>{message.role === "user" ? "Tu" : "NEXO"}</span>
                <p>{message.content}</p>
              </article>
            ))}
            {busy ? (
              <article className="chatBubble assistant">
                <span>NEXO</span>
                <p className="typingState"><Loader2 size={16} /> Pensando con Gemini...</p>
              </article>
            ) : null}
          </div>

          {error ? <div className="assistantError">{error}</div> : null}

          <form className="assistantComposer" onSubmit={handleSubmit}>
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Pregunta sobre riego, semillas, clima o una parcela..."
              rows={3}
            />
            <button type="submit" disabled={busy || !input.trim()} aria-label="Enviar mensaje">
              {busy ? <Loader2 size={18} /> : <Send size={18} />}
            </button>
          </form>
        </aside>
      </section>
    </AppShell>
  );
}
