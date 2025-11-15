import Image from 'next/image';
import Link from 'next/link';
import { Actress } from '@/types/product';
import { providerMeta } from '@/lib/mockData';

interface Props {
  actress: Actress;
  compact?: boolean;
}

export default function ActressCard({ actress, compact = false }: Props) {
  return (
    <div className="bg-gray-900 text-white rounded-2xl overflow-hidden shadow-xl ring-1 ring-white/10">
      <div className="relative">
        <Image
          src={actress.heroImage}
          alt={actress.name}
          width={800}
          height={1000}
          className="w-full h-80 object-cover opacity-90"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-gray-950 to-transparent" />
        <div className="absolute bottom-4 left-4">
          <p className="text-sm uppercase tracking-widest text-gray-300">
            {actress.catchcopy}
          </p>
          <h3 className="text-3xl font-semibold">{actress.name}</h3>
        </div>
      </div>

      <div className="p-6 space-y-4">
        <p className="text-sm text-gray-300 line-clamp-3">{actress.description}</p>

        <div className="flex flex-wrap gap-2">
          {actress.tags.map((tag) => (
            <span
              key={tag}
              className="text-xs uppercase tracking-wide bg-white/10 text-gray-200 px-3 py-1 rounded-full"
            >
              {tag}
            </span>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-4 text-center">
          <Stat label="出演数" value={`${actress.metrics.releaseCount}本`} />
          <Stat label="トレンド" value={actress.metrics.trendingScore} />
          <Stat label="支持率" value={`${actress.metrics.fanScore}%`} />
        </div>

        {!compact && (
          <>
            <div className="flex flex-wrap gap-2">
              {actress.services.map((service) => {
                const meta = providerMeta[service];
                return (
                  <span
                    key={service}
                    className={`text-xs font-semibold px-3 py-1 rounded-full bg-gradient-to-r ${meta.accentClass}`}
                  >
                    {meta.label}
                  </span>
                );
              })}
            </div>

            <Link
              href={`/actress/${actress.id}`}
              className="inline-flex items-center justify-center w-full rounded-xl bg-white/10 hover:bg-white/20 transition-colors py-3 text-sm font-semibold"
            >
              プロフィールと出演作を見る →
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white/5 rounded-xl py-3">
      <div className="text-xs text-gray-400">{label}</div>
      <div className="text-lg font-semibold text-white">{value}</div>
    </div>
  );
}

