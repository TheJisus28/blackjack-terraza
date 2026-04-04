import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-[100dvh] flex flex-col bg-gradient-to-b from-gray-950 via-emerald-950 to-gray-950 text-white">
      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Juega gratis con amigos
          </div>

          <h1 className="text-5xl sm:text-7xl font-extrabold tracking-tight mb-4">
            Blackjack
            <br />
            <span className="bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">
              Terraza
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-gray-400 max-w-md mx-auto leading-relaxed">
            Blackjack multijugador en tiempo real. Crea mesas, invita amigos y
            juega como en un casino de verdad.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <Link
            href="/play"
            className="px-8 py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-base
              shadow-lg shadow-emerald-500/25 transition-all active:scale-95"
          >
            Jugar Ahora
          </Link>
          <button
            disabled
            className="px-8 py-3.5 rounded-xl bg-white/5 border border-white/10 text-white/60 font-medium text-base
              cursor-not-allowed"
          >
            Multijugador (pronto)
          </button>
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-20 max-w-3xl w-full">
          <FeatureCard
            title="Reglas Reales"
            description="Split, double down, surrender. Blackjack paga 3:2."
            icon="&#127183;"
          />
          <FeatureCard
            title="Mesas Privadas"
            description="Crea una mesa y comparte el link con tus amigos."
            icon="&#128279;"
          />
          <FeatureCard
            title="Tiempo Real"
            description="Juega en vivo con otros jugadores sin retrasos."
            icon="&#9889;"
          />
        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 text-center text-sm text-gray-600">
        Blackjack Terraza &mdash; Proyecto universitario
      </footer>
    </div>
  );
}

function FeatureCard({
  title,
  description,
  icon,
}: {
  title: string;
  description: string;
  icon: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2 p-6 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] transition-colors">
      <span className="text-3xl mb-1" dangerouslySetInnerHTML={{ __html: icon }} />
      <h3 className="font-semibold text-white">{title}</h3>
      <p className="text-sm text-gray-400 leading-relaxed">{description}</p>
    </div>
  );
}
