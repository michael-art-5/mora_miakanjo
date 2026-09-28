import { useSiteData } from '../site/SiteData'

export default function About() {
  const { about } = useSiteData()
  const paragraphs = about.text.split(/\n\s*\n/).filter(Boolean)

  return (
    <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <p className="text-sm uppercase tracking-[0.2em] text-earth">Notre histoire</p>
      <h1 className="mt-4 font-display text-4xl sm:text-5xl">{about.title}</h1>
      <div className="mt-8 space-y-5 leading-relaxed text-ink/80">
        {paragraphs.map((p, i) => (
          <p key={i} className="whitespace-pre-line">
            {p}
          </p>
        ))}
      </div>

      <div className="mt-12 grid gap-6 sm:grid-cols-3">
        {[
          ['Qualité', 'Des matières agréables qui tiennent dans le temps.'],
          ['Prix justes', 'Une mode accessible à tous les budgets.'],
          ['Conseil', 'Une équipe à votre écoute en boutique.'],
        ].map(([title, text]) => (
          <div key={title} className="rounded-xl bg-sand p-6">
            <p className="font-display text-xl">{title}</p>
            <p className="mt-2 text-sm text-ink/70">{text}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
