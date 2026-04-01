"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export interface GrowthDataPoint {
  month: string;
  count: number;
}

interface SocietyGrowthChartProps {
  data: GrowthDataPoint[];
  isLoading: boolean;
}

export function SocietyGrowthChart({ data, isLoading }: SocietyGrowthChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Society Growth</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-[300px] w-full" />
        ) : !data.length ? (
          <p className="text-muted-foreground py-8 text-center text-sm">No data available</p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" fontSize={12} />
              <YAxis fontSize={12} />
              <Tooltip />
              <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
