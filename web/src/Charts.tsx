import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type NumericPoint = { name: string; value: number };
export type LandscapePoint = {
  x: number;
  y: number;
  name: string;
  code: string;
};

export function EstimateBarChart({ data }: { data: NumericPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart
        data={data}
        margin={{ top: 12, right: 20, left: 0, bottom: 52 }}
      >
        <CartesianGrid
          strokeDasharray="3 3"
          vertical={false}
          stroke="var(--line)"
        />
        <XAxis
          dataKey="name"
          interval={0}
          angle={-35}
          textAnchor="end"
          height={70}
          tick={{ fill: "var(--muted)", fontSize: 10 }}
        />
        <YAxis tick={{ fill: "var(--muted)", fontSize: 10 }} />
        <Tooltip
          contentStyle={{
            background: "var(--panel)",
            border: "1px solid var(--line)",
            borderRadius: 4,
            color: "var(--text)",
          }}
        />
        <Bar dataKey="value" fill="var(--accent)" radius={[2, 2, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function LandscapeScatter({
  data,
  onSelect,
}: {
  data: LandscapePoint[];
  onSelect: (point: LandscapePoint) => void;
}) {
  return (
    <ResponsiveContainer width="100%" height={420}>
      <ScatterChart margin={{ top: 24, right: 24, bottom: 28, left: 18 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
        <XAxis
          type="number"
          dataKey="x"
          name="estimate"
          tick={{ fill: "var(--muted)", fontSize: 10 }}
          label={{
            value: "Estimate",
            position: "insideBottom",
            offset: -12,
            fill: "var(--muted)",
          }}
        />
        <YAxis
          type="number"
          dataKey="y"
          name="standard error"
          tick={{ fill: "var(--muted)", fontSize: 10 }}
          label={{
            value: "Standard error",
            angle: -90,
            position: "insideLeft",
            fill: "var(--muted)",
          }}
        />
        <Tooltip
          cursor={{ strokeDasharray: "3 3" }}
          content={({ active, payload }) =>
            active && payload?.[0] ? (
              <div className="chart-tooltip">
                <b>{payload[0].payload.name}</b>
                <span>Estimate: {payload[0].payload.x}</span>
                <span>Standard error: {payload[0].payload.y}</span>
              </div>
            ) : null
          }
        />
        <Scatter
          data={data}
          fill="var(--accent)"
          fillOpacity={0.65}
          onClick={(point) => onSelect(point.payload as LandscapePoint)}
        >
          {data.map((point, index) => (
            <Cell
              key={point.code}
              fill={
                ["#80d6cb", "#e5b269", "#95a7eb", "#d78ca2", "#9bb7a2"][
                  index % 5
                ]
              }
            />
          ))}
        </Scatter>
      </ScatterChart>
    </ResponsiveContainer>
  );
}
