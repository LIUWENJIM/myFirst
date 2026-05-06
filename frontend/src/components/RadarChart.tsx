import {useMemo} from 'react';
import {
    PolarAngleAxis,
    PolarGrid,
    PolarRadiusAxis,
    Radar,
    RadarChart as RechartsRadarChart,
    ResponsiveContainer,
    Tooltip
} from 'recharts';
import {normalizeScore} from '../utils/score';

interface RadarChartProps {
  data: Array<{
    subject: string;
    score: number;
    fullMark: number;
  }>;
  height?: number;
  className?: string;
}

export default function RadarChart({ data, height = 320, className = '' }: RadarChartProps) {
  const normalizedData = useMemo(() => {
    if (!data || data.length === 0) return [];

    const maxFullMark = Math.max(...data.map(item => item.fullMark));

    const normalizedScores = data.map(item =>
      normalizeScore(item.score, item.fullMark, maxFullMark)
    );
    const maxNormalizedScore = Math.max(...normalizedScores, maxFullMark);

    const chartMax = Math.max(maxFullMark, maxNormalizedScore);

    return data.map(item => ({
      subject: item.subject,
      score: normalizeScore(item.score, item.fullMark, maxFullMark),
      fullMark: chartMax,
      originalScore: item.score,
      originalFullMark: item.fullMark
    }));
  }, [data]);

  return (
    <div className={className} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RechartsRadarChart data={normalizedData}>
          <PolarGrid stroke="var(--color-hairline)" />
          <PolarAngleAxis
            dataKey="subject"
            tick={{fill: 'var(--color-muted)', fontSize: 12, fontWeight: 500}}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, normalizedData.length > 0 ? normalizedData[0].fullMark : 40]}
            tick={{fill: 'var(--color-muted-soft)', fontSize: 10}}
            tickFormatter={(value) => value.toString()}
          />
          <Radar
            name="得分"
            dataKey="score"
            stroke="var(--color-primary)"
            fill="var(--color-primary)"
            fillOpacity={0.3}
            strokeWidth={2}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'var(--color-surface-card)',
              border: '1px solid var(--color-hairline)',
              borderRadius: '12px',
              color: 'var(--color-ink)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
            }}
            formatter={(_value: number | undefined, _name: string | undefined, props: any) => {
              const originalScore = props?.payload?.originalScore ?? 0;
              const originalFullMark = props?.payload?.originalFullMark ?? 40;
              const percentage = originalFullMark > 0
                  ? Math.round((originalScore / originalFullMark) * 100)
              : 0;
              return [`${originalScore}/${originalFullMark} (${percentage}%)`, '得分'];
            }}
          />
        </RechartsRadarChart>
      </ResponsiveContainer>
    </div>
  );
}
