import { useState, useEffect, memo } from 'react';
import { useTranslation } from '../../../i18n/I18nContext';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

interface UsageData {
  today: {
    date: string;
    calls: Record<string, number>;
    totalCalls: number;
    analyses: number;
    tokens?: Record<string, number>; // Optional pour compatibilité avec anciennes données
    credits: {
      min: number;
      typical: number;
      max: number;
      dailyLimit: number;
      percentUsed: number;
      isActual: boolean;
    };
  };
  historical: Array<{
    date: string;
    totalCalls: number;
    analyses: number;
    creditsEstimate: number;
    calls?: Record<string, number>;
    tokens?: Record<string, number>;
  }>;
  status: {
    emoji: string;
    text: string;
    level: 'safe' | 'good' | 'warning' | 'critical' | 'danger';
  };
}

export const UsageBar = memo(function UsageBar() {
  const { t } = useTranslation();
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  useEffect(() => {
    fetchUsage();
    // Refresh every 30 seconds
    const interval = setInterval(fetchUsage, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchUsage = async () => {
    try {
      const response = await fetch('/api/usage');
      const data = await response.json();
      setUsage(data);
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch usage:', error);
      setLoading(false);
    }
  };

  // Ne pas afficher de skeleton pour éviter le flash au chargement
  if (loading || !usage) {
    return null;
  }

  const { today, status } = usage;

  // Determine which day to display (selected day or today)
  const displayDay = selectedDate
    ? usage.historical.find(d => d.date === selectedDate)
    : null;

  const displayData = displayDay
    ? displayDay.date === today.date
      ? today // If selected day is today, use full today data
      : {
          date: displayDay.date,
          calls: displayDay.calls || {},
          totalCalls: displayDay.totalCalls,
          analyses: displayDay.analyses,
          tokens: displayDay.tokens || {},
          credits: {
            min: displayDay.creditsEstimate,
            typical: displayDay.creditsEstimate,
            max: displayDay.creditsEstimate,
            dailyLimit: today.credits.dailyLimit,
            percentUsed: (displayDay.creditsEstimate / today.credits.dailyLimit) * 100,
            isActual: false
          }
        }
    : today;

  const percentUsed = displayData.credits.percentUsed;

  // Couleur de la barre de progression
  const getBarColor = () => {
    return 'hsl(var(--primary))';
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('fr-FR').format(num);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <div className="relative backdrop-blur-sm rounded-lg md:rounded-xl px-2 md:px-4 py-1 md:py-1.5 cursor-help transition-all hover:shadow-lg border border-border bg-card/50 shrink-0">
      {/* Layout horizontal compact - Responsive */}
      <div className="flex items-center gap-1.5 md:gap-4">
        {/* Emoji + Titre (titre masqué sur mobile) */}
        <div className="flex items-center gap-1 md:gap-2 shrink-0">
          <span className="text-xs md:text-base">{status.emoji}</span>
          <h3 className="hidden lg:block text-xs font-medium whitespace-nowrap text-foreground">
            {t('usage.title')}
          </h3>
        </div>

        {/* Barre de progression + pourcentage */}
        <div className="flex items-center gap-1 md:gap-2 min-w-0">
          <div className="min-w-[60px] sm:min-w-[80px] md:min-w-[120px]">
            <div className="h-1 md:h-1.5 rounded-full overflow-hidden bg-secondary">
              <div
                className="h-full transition-all duration-500 ease-out"
                style={{
                  width: `${Math.min(percentUsed, 100)}%`,
                  backgroundColor: getBarColor()
                }}
              ></div>
            </div>
          </div>
          <div className="text-[9px] md:text-xs font-semibold whitespace-nowrap text-foreground shrink-0">
            {percentUsed.toFixed(1)}%
          </div>
        </div>
      </div>
        </div>
      </PopoverTrigger>

      <PopoverContent className="w-96 p-4">
        <div className="space-y-3">
          {/* Total de tokens utilisés */}
          <div>
            <h4 className="text-sm font-semibold mb-2">
              {t('usage.tooltip.tokens_used')}
            </h4>
            <div className="rounded-lg p-3 bg-primary/10 border border-primary/20">
              <div className="flex justify-between items-center">
                <div className="font-medium">
                  {displayData.date === today.date ? 'Total' : displayData.date}
                </div>
                <div className="text-2xl font-bold text-primary">
                  {formatNumber(displayData.credits.typical)}
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <div className="text-xs text-muted-foreground">
                  {formatNumber(displayData.credits.dailyLimit)} limit / {percentUsed.toFixed(1)}% used
                </div>
                <div className="text-xs font-semibold text-primary">
                  {displayData.analyses} {displayData.date === today.date ? t('usage.analyses_today') : 'analyses'}
                </div>
              </div>
            </div>
          </div>

          {/* Détail par outil MCP */}
          <div>
            <h4 className="text-sm font-semibold mb-2">
              {t('usage.tooltip.mcp_tools')}
            </h4>
            <div className="space-y-1 text-xs">
              {Object.keys(displayData.calls).length > 0 ? (
                <>
                  {Object.entries(displayData.calls).map(([tool, count]) => (
                    <div key={tool} className="flex justify-between items-center gap-3 py-1">
                      <span className="font-mono text-muted-foreground text-[10px]">
                        {tool}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">
                          {count}×
                        </span>
                        <span className="font-semibold text-primary min-w-[60px] text-right">
                          {formatNumber(displayData.tokens?.[tool] || 0)} tk
                        </span>
                      </div>
                    </div>
                  ))}
                </>
              ) : (
                <div className="italic text-muted-foreground">
                  {t('usage.tooltip.no_calls')}
                </div>
              )}
            </div>
          </div>

          {/* Mini graphique 7 derniers jours */}
          <div>
            <h4 className="text-sm font-semibold mb-2">
              {t('usage.tooltip.last_days')}
            </h4>
            <div className="flex items-end justify-between gap-2 h-28">
              {(() => {
                const GRAPH_HEIGHT = 112; // h-28 = 112px
                const DAILY_LIMIT = today.credits.dailyLimit; // 1,200,000

                return usage.historical.map((day) => {
                  const heightPercent = (day.creditsEstimate / DAILY_LIMIT);
                  const heightPx = Math.max(Math.round(heightPercent * GRAPH_HEIGHT), day.creditsEstimate > 0 ? 4 : 0);
                  const isSelected = selectedDate === day.date;

                  return (
                    <div
                      key={day.date}
                      className="flex-1 group relative cursor-pointer"
                      title={`${day.date}: ${day.analyses} ${t('usage.tooltip.analyses')} - ${formatNumber(day.creditsEstimate)} tk`}
                      onClick={() => setSelectedDate(day.date === selectedDate ? null : day.date)}
                    >
                      <div
                        className={`rounded-t transition-all w-full ${
                          isSelected
                            ? 'bg-primary'
                            : 'bg-primary/70 group-hover:bg-primary/90'
                        }`}
                        style={{ height: `${heightPx}px` }}
                      ></div>
                      <div className={`text-[9px] text-center mt-1 truncate ${
                        isSelected
                          ? 'text-primary font-bold'
                          : 'text-muted-foreground'
                      }`}>
                        {day.date.slice(5)}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>

          {/* Disclaimer */}
          <div className="pt-2 border-t">
            <p className="text-xs italic text-muted-foreground">
              {t('usage.tooltip.disclaimer')}
            </p>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
})
