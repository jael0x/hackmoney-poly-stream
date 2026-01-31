'use client';

import { LineChart, Line, ResponsiveContainer, YAxis } from 'recharts';

interface ProbabilityChartProps {
  data?: Array<{ time: number; probability: number }>;
  currentPrice: number;
}

export function ProbabilityChart({ data, currentPrice }: ProbabilityChartProps) {
  const chartData = data || generateMockData(currentPrice);

  return (
    <div className="h-20 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
          <YAxis domain={[0, 100]} hide />
          <Line
            type="monotone"
            dataKey="probability"
            stroke="#a855f7"
            strokeWidth={2}
            dot={false}
            animationDuration={300}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function generateMockData(currentPrice: number): Array<{ time: number; probability: number }> {
  const points = 20;
  const data = [];
  let price = 50;

  for (let i = 0; i < points; i++) {
    const randomChange = (Math.random() - 0.5) * 10;
    price = Math.max(20, Math.min(80, price + randomChange));

    if (i === points - 1) {
      price = currentPrice;
    }

    data.push({
      time: i,
      probability: price,
    });
  }

  return data;
}
