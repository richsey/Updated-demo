import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";
import { useQuery } from "@tanstack/react-query";
import { fetchAdminStats } from "@/lib/api/admin";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  Brain, AlertTriangle, TrendingDown, Eye, Video, BookX, BrainCircuit, Loader2,
} from "lucide-react";

type TelemetryStat = { id: string; label: string; count: number };

async function fetchTelemetryStats() {
  const { data } = await supabase
    .from("telemetry")
    .select("event_type, entity_id")
    .in("event_type", ["video_replay", "quiz_failure", "lesson_abandoned"]);

  const replays: Record<string, number> = {};
  const failures: Record<string, number> = {};
  const abandoned: Record<string, number> = {};

  for (const row of data ?? []) {
    if (row.event_type === "video_replay") replays[row.entity_id] = (replays[row.entity_id] ?? 0) + 1;
    if (row.event_type === "quiz_failure") failures[row.entity_id] = (failures[row.entity_id] ?? 0) + 1;
    if (row.event_type === "lesson_abandoned") abandoned[row.entity_id] = (abandoned[row.entity_id] ?? 0) + 1;
  }

  const toArr = (map: Record<string, number>): TelemetryStat[] =>
    Object.entries(map).map(([id, count]) => ({ id, label: id.slice(0, 8), count }))
      .sort((a, b) => b.count - a.count);

  return { replays: toArr(replays), failures: toArr(failures), abandoned: toArr(abandoned) };
}

export default function StudentAnalytics() {
  const { data: telemetry, isLoading: loadingTelemetry } = useQuery({
    queryKey: ["admin-telemetry"],
    queryFn: fetchTelemetryStats,
  });

  const { data: adminStats, isLoading: loadingStats } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: fetchAdminStats,
  });

  const sumCounts = (arr: TelemetryStat[] = []) => arr.reduce((acc, curr) => acc + curr.count, 0);
  const totalAlerts = sumCounts(telemetry?.replays) + sumCounts(telemetry?.failures) + sumCounts(telemetry?.abandoned);

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-10">
      <div>
        <h1 className="text-3xl font-bold font-display">Student Analytics</h1>
        <p className="text-muted-foreground mt-2">AI-powered insights into student performance and telemetry</p>
      </div>

      {/* SECTION 1: LIVE TELEMETRY */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold font-display flex items-center gap-2">
          <ActivityIcon /> Live Telemetry Alerts
        </h2>

        {loadingTelemetry ? (
          <div className="flex justify-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-3">
              <Card className="border-l-4 border-l-blue-500">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Video Replays</CardTitle>
                  <Video className="h-4 w-4 text-blue-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{sumCounts(telemetry?.replays)}</div>
                  <p className="text-xs text-muted-foreground">Videos requiring multiple views</p>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-red-500">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Quiz Failures</CardTitle>
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{sumCounts(telemetry?.failures)}</div>
                  <p className="text-xs text-muted-foreground">Topics requiring intervention</p>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-orange-500">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Abandoned Lessons</CardTitle>
                  <BookX className="h-4 w-4 text-orange-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{sumCounts(telemetry?.abandoned)}</div>
                  <p className="text-xs text-muted-foreground">Lessons exited early</p>
                </CardContent>
              </Card>
            </div>

            {totalAlerts > 0 && (
              <div className="grid gap-6 md:grid-cols-2 mt-4">
                {(telemetry?.failures?.length ?? 0) > 0 && (
                  <Card>
                    <CardHeader><CardTitle className="text-sm">High-Risk Quizzes</CardTitle></CardHeader>
                    <CardContent className="space-y-3">
                      {telemetry!.failures.map((stat) => (
                        <div key={stat.id}
                          className="flex items-center justify-between p-2 bg-red-500/10 rounded-lg border border-red-500/20">
                          <span className="font-medium text-red-700 dark:text-red-400 text-sm">ID: {stat.label}…</span>
                          <Badge variant="destructive">Failed {stat.count}x</Badge>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {(telemetry?.abandoned?.length ?? 0) > 0 && (
                  <Card>
                    <CardHeader><CardTitle className="text-sm">Abandoned Content</CardTitle></CardHeader>
                    <CardContent className="space-y-3">
                      {telemetry!.abandoned.map((stat) => (
                        <div key={stat.id}
                          className="flex items-center justify-between p-2 bg-orange-500/10 rounded-lg border border-orange-500/20">
                          <span className="font-medium text-orange-700 dark:text-orange-400 text-sm">ID: {stat.label}…</span>
                          <Badge className="bg-orange-500">Abandoned {stat.count}x</Badge>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* SECTION 2: AI INSIGHTS */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold font-display flex items-center gap-2">
          <BrainCircuit className="h-5 w-5 text-primary" /> AI Pattern Analysis
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-warning/40 bg-warning/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-4 w-4 text-warning" />
                <span className="text-sm font-semibold">Quiz Guessing Detected</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Students completing quizzes in under 30 seconds are flagged as potential guessers.
              </p>
            </CardContent>
          </Card>
          <Card className="border-destructive/40 bg-destructive/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingDown className="h-4 w-4 text-destructive" />
                <span className="text-sm font-semibold">Declining Performance</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Students with downward score trends are automatically recommended foundational content.
              </p>
            </CardContent>
          </Card>
          <Card className="border-info/40 bg-info/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Eye className="h-4 w-4 text-info" />
                <span className="text-sm font-semibold">Video Confusion</span>
              </div>
              <p className="text-xs text-muted-foreground">
                High video replay rates signal content that may need revision or supplementary material.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* SECTION 3: QUIZ PERFORMANCE CHART */}
      <Card>
        <CardHeader>
          <CardTitle className="font-display">Course Performance Overview</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingStats ? (
            <div className="flex justify-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : (adminStats?.quizPerformance?.length ?? 0) > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={adminStats!.quizPerformance}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="course" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                <Bar dataKey="avgScore" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Average Score" />
                <Bar dataKey="attempts" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} name="Attempts" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground text-sm gap-2">
              <span className="text-3xl">🎯</span><span>No quiz attempts yet</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* SECTION 4: HOW AI WORKS */}
      <Card className="border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-display">
            <Brain className="h-5 w-5 text-primary" /> How the Adaptive AI Works
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div>
            <h4 className="font-semibold">Why students fail despite recommendations</h4>
            <p className="text-muted-foreground">Superficial engagement, content format mismatch, missing prerequisites, and human factors like fatigue.</p>
          </div>
          <div>
            <h4 className="font-semibold">How the system detects downward trends</h4>
            <p className="text-muted-foreground">Compares quiz scores over time per topic. If score decreases, the material's weight is reduced.</p>
          </div>
          <div>
            <h4 className="font-semibold">How recommendations self-correct</h4>
            <p className="text-muted-foreground">Combines telemetry signals (rewind rate, tutorial skip time), quiz performance, and quiz failure frequency to re-rank content.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ActivityIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
    </svg>
  );
}
