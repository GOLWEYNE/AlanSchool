import { ReactNode } from "react";

type HeroStat = {
  label: string;
  value: string | number;
};

const PageHero = ({
  title,
  subtitle,
  emoji,
  stats,
  action,
}: {
  title: string;
  subtitle: string;
  emoji: string;
  stats: HeroStat[];
  action?: ReactNode;
}) => {
  return (
    <div className="page-top-banner p-5 md:p-6 mb-4 shine-hover">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            <span className="mr-2">{emoji}</span>
            {title}
          </h1>
          <p className="text-blue-50 mt-2 text-sm md:text-base max-w-xl">
            {subtitle}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="rounded-full bg-white/90 text-blue-900 px-3 py-1.5 text-xs font-semibold"
              >
                {stat.label}: {stat.value}
              </div>
            ))}
          </div>
        </div>
        {action ? <div className="self-start">{action}</div> : null}
      </div>
    </div>
  );
};

export default PageHero;
