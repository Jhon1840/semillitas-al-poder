import { ArrowRight, BarChart3, Camera, CheckCircle2, Leaf, Map, ShieldCheck, Sprout } from "lucide-react";
import Link from "next/link";

export function PublicLanding() {
  return (
    <main className="publicPage">
      <header className="publicNav">
        <Link className="brand" href="/" aria-label="NEXO inicio">
          <span>NX</span>
          <strong>NEXO</strong>
        </Link>
        <nav className="publicNavLinks" aria-label="Navegacion principal">
          <a href="#producto">Producto</a>
          <a href="#flujo">Flujo</a>
          <Link href="/login">Ingresar</Link>
          <Link className="navCta" href="/register">Crear cuenta</Link>
        </nav>
      </header>

      <section className="landingHero">
        <div className="landingHeroText">
          <p className="eyebrow">Inteligencia agricola para decisiones tempranas</p>
          <h1>NEXO analiza semillas y conecta el resultado con tu parcela.</h1>
          <p>
            Una plataforma para productores y tecnicos que necesitan evaluar imagenes de semillas,
            delimitar parcelas y preparar mejores decisiones antes de sembrar.
          </p>
          <div className="heroActions">
            <Link className="primaryLink" href="/register">
              Crear cuenta
              <ArrowRight size={18} />
            </Link>
            <Link className="secondaryLink" href="/login">Ingresar</Link>
          </div>
        </div>

        <div className="landingVisual" aria-label="Vista previa del analisis de semillas">
          <div className="analysisMock">
            <div className="analysisTopbar">
              <span />
              <span />
              <span />
            </div>
            <div className="seedGrid">
              {Array.from({ length: 36 }).map((_, index) => (
                <i
                  key={index}
                  style={{ "--r": `${(index * 19) % 32}deg`, "--s": `${16 + (index % 5) * 2}px` } as React.CSSProperties}
                />
              ))}
            </div>
            <div className="analysisMetric">
              <CheckCircle2 size={18} />
              Calidad estimada: alta
            </div>
            <div className="scanLine" />
          </div>
        </div>
      </section>

      <section className="section" id="producto">
        <div className="sectionHeader">
          <p className="eyebrow">Que resuelve</p>
          <h2>Del dato visual a una decision agronomica mas clara.</h2>
          <p>
            NEXO une imagenes, ubicacion, clima y trazabilidad para que el primer diagnostico
            de una campana no dependa de papeles dispersos.
          </p>
        </div>
        <div className="featureGrid">
          <Feature icon={<Camera />} title="Imagenes de semillas" text="Sube fotos y envialas al servicio externo de analisis sin exponer claves en el navegador." />
          <Feature icon={<Map />} title="Parcelas en mapa" text="Dibuja el perimetro de la parcela, calcula area aproximada y registra el centro geografico." />
          <Feature icon={<BarChart3 />} title="Contexto operativo" text="Relaciona muestras, clima, riego y energia para construir recomendaciones futuras." />
        </div>
      </section>

      <section className="landingFlow" id="flujo">
        <div>
          <p className="eyebrow">Flujo inicial</p>
          <h2>Simple para validar, preparado para crecer.</h2>
        </div>
        <ol className="flowSteps">
          <li><strong>1</strong><span>Crear cuenta o iniciar sesion.</span></li>
          <li><strong>2</strong><span>Delimitar la parcela en el dashboard.</span></li>
          <li><strong>3</strong><span>Subir imagenes de semillas para analizarlas.</span></li>
        </ol>
      </section>

      <section className="landingCta">
        <Leaf size={30} />
        <div>
          <h2>Empieza con el usuario demo o crea una cuenta nueva.</h2>
          <p>El producto ya esta conectado al backend local para probar el flujo completo.</p>
        </div>
        <Link className="primaryLink" href="/login">
          Entrar a NEXO
          <Sprout size={18} />
        </Link>
      </section>

      <footer className="publicFooter">
        <span>NEXO</span>
        <span>Analisis de semillas con inteligencia agricola.</span>
        <ShieldCheck size={18} />
      </footer>
    </main>
  );
}

function Feature({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <article className="feature">
      <span>{icon}</span>
      <h3>{title}</h3>
      <p>{text}</p>
    </article>
  );
}
