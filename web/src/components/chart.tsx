"use client";

import { BarChart, LineChart, ScatterChart } from "echarts/charts";
import {
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  MarkAreaComponent,
  MarkLineComponent,
  MarkPointComponent,
  TooltipComponent,
  VisualMapComponent,
} from "echarts/components";
import * as echarts from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import type { EChartsOption } from "echarts";
import ReactEChartsCore from "echarts-for-react/lib/core";

echarts.use([
  LineChart,
  BarChart,
  ScatterChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DataZoomComponent,
  MarkLineComponent,
  MarkAreaComponent,
  MarkPointComponent,
  VisualMapComponent,
  CanvasRenderer,
]);

export const COLORS = {
  gold: "#e7b75f",
  teal: "#3fe0c5",
  violet: "#8b7bff",
  rose: "#fb7185",
  sky: "#60a5fa",
  up: "#34d399",
  down: "#fb7185",
  muted: "#8d95a8",
  faint: "#5b6377",
  grid: "rgba(255,255,255,0.06)",
};

const FONT = "var(--font-geist-sans), system-ui, sans-serif";

/** Shared look for every chart: transparent canvas, quiet axes, glass tooltip. */
export function baseOption(): EChartsOption {
  return {
    backgroundColor: "transparent",
    textStyle: { fontFamily: FONT, color: COLORS.muted },
    animationDuration: 1200,
    animationEasing: "cubicOut",
    grid: { left: 8, right: 12, top: 28, bottom: 8, containLabel: true },
    tooltip: {
      trigger: "axis",
      backgroundColor: "rgba(10,14,23,0.92)",
      borderColor: "rgba(255,255,255,0.12)",
      borderWidth: 1,
      padding: [10, 12],
      textStyle: { color: "#eef0f6", fontSize: 12, fontFamily: FONT },
      extraCssText: "backdrop-filter: blur(12px); border-radius: 12px; box-shadow: 0 20px 40px rgba(0,0,0,.4);",
      axisPointer: {
        type: "line",
        lineStyle: { color: "rgba(231,183,95,0.5)", width: 1, type: "dashed" },
      },
    },
    legend: {
      top: 0,
      right: 0,
      icon: "roundRect",
      itemWidth: 10,
      itemHeight: 4,
      textStyle: { color: COLORS.muted, fontSize: 11 },
    },
  };
}

export function timeAxis(data: string[]): EChartsOption["xAxis"] {
  return {
    type: "category",
    data,
    boundaryGap: false,
    axisLine: { lineStyle: { color: COLORS.grid } },
    axisTick: { show: false },
    axisLabel: { color: COLORS.faint, fontSize: 11, hideOverlap: true },
  };
}

export function valueAxis(formatter?: (v: number) => string, extra: object = {}): EChartsOption["yAxis"] {
  return {
    type: "value",
    splitLine: { lineStyle: { color: COLORS.grid } },
    axisLabel: { color: COLORS.faint, fontSize: 11, formatter: formatter as never },
    scale: true,
    ...extra,
  };
}

export function Chart({
  option,
  height = 320,
  className,
  onEvents,
}: {
  option: EChartsOption;
  height?: number | string;
  className?: string;
  onEvents?: Record<string, (params: unknown) => void>;
}) {
  return (
    <ReactEChartsCore
      echarts={echarts}
      option={option}
      notMerge
      lazyUpdate
      style={{ height, width: "100%" }}
      className={className}
      opts={{ renderer: "canvas" }}
      onEvents={onEvents}
    />
  );
}

export { echarts };
