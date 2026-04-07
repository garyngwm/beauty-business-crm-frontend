import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export default function SalesPerformanceChart({
  data,
}: {
  data: { date: string; revenue: number }[];
}) {
  return (
    <div className="h-72 w-full rounded-lg border bg-white p-4">
      <div className="mb-3 text-sm font-semibold text-gray-800">
        Sales trend
      </div>

      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <XAxis dataKey="date" />
          <YAxis />
          <Tooltip />
          <Line type="monotone" dataKey="revenue" strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
