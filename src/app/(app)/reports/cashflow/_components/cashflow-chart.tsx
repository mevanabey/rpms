"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type Point = { month: string; in: number; out: number; net: number };

export function CashflowChart({ data, currency }: { data: Point[]; currency: "LKR" | "USD" }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Cashflow ({currency})</CardTitle>
        <CardDescription>Month-by-month cash in vs cash out, net.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{ fontSize: 12 }}
                formatter={(v) => (typeof v === "number" ? v.toLocaleString() : String(v))}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="in" name="In" fill="var(--color-chart-1)" />
              <Bar dataKey="out" name="Out" fill="var(--color-chart-3)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
