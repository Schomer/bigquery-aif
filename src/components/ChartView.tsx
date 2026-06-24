'use client';

import type { QueryResult } from '@/lib/types';

// Recharts-based renderers
import {
  LineChartRenderer,
  BarChartRenderer,
  ColumnChartRenderer,
  AreaChartRenderer,
  ScatterChartRenderer,
  PieChartRenderer,
  DonutChartRenderer,
  HistogramRenderer,
  SparklineRenderer,
  RadarChartRenderer,
  FunnelChartRenderer,
  TreemapRenderer,
  SankeyRenderer,
  ComposedChartRenderer,
} from './charts/recharts-charts';

// Custom SVG renderers
import {
  GaugeRenderer,
  HeatmapRenderer,
  BoxplotRenderer,
  CandlestickRenderer,
  ViolinRenderer,
  DensityPlotRenderer,
  RidgelineRenderer,
  NetworkGraphRenderer,
  TileMapRenderer,
} from './charts/custom-charts';

// Map renderers
import {
  GeoPointMapRenderer,
  USAMapRenderer,
  WorldMapRenderer,
} from './charts/map-charts';

type ChartType =
  | 'LINE_CHART' | 'BAR_CHART' | 'AREA_CHART' | 'SCATTER' | 'PIE_CHART'
  | 'DONUT_CHART' | 'COLUMN_CHART' | 'HISTOGRAM' | 'SPARKLINE'
  | 'RADAR' | 'FUNNEL' | 'TREEMAP' | 'SANKEY' | 'COMPOSED_CHART'
  | 'GAUGE' | 'HEATMAP' | 'BOXPLOT' | 'CANDLESTICK'
  | 'VIOLIN' | 'DENSITY_PLOT' | 'RIDGELINE' | 'NETWORK_GRAPH' | 'TILE_MAP'
  | 'GEO_POINT_MAP' | 'USA_MAP' | 'WORLD_MAP';

interface Props {
  result: QueryResult;
  chartType: ChartType;
  onSendMessage: (msg: string) => void;
}

const RENDERERS: Record<ChartType, React.ComponentType<{ result: QueryResult; onSendMessage: (msg: string) => void }>> = {
  // Recharts native
  LINE_CHART: LineChartRenderer,
  BAR_CHART: BarChartRenderer,
  COLUMN_CHART: ColumnChartRenderer,
  AREA_CHART: AreaChartRenderer,
  SCATTER: ScatterChartRenderer,
  PIE_CHART: PieChartRenderer,
  DONUT_CHART: DonutChartRenderer,
  HISTOGRAM: HistogramRenderer,
  SPARKLINE: SparklineRenderer,
  RADAR: RadarChartRenderer,
  FUNNEL: FunnelChartRenderer,
  TREEMAP: TreemapRenderer,
  SANKEY: SankeyRenderer,
  COMPOSED_CHART: ComposedChartRenderer,
  // Custom SVG
  GAUGE: GaugeRenderer,
  HEATMAP: HeatmapRenderer,
  BOXPLOT: BoxplotRenderer,
  CANDLESTICK: CandlestickRenderer,
  VIOLIN: ViolinRenderer,
  DENSITY_PLOT: DensityPlotRenderer,
  RIDGELINE: RidgelineRenderer,
  NETWORK_GRAPH: NetworkGraphRenderer,
  TILE_MAP: TileMapRenderer,
  // Maps
  GEO_POINT_MAP: GeoPointMapRenderer,
  USA_MAP: USAMapRenderer,
  WORLD_MAP: WorldMapRenderer,
};

export function ChartView({ result, chartType, onSendMessage }: Props) {
  const Renderer = RENDERERS[chartType];

  if (!Renderer) {
    return (
      <div style={{ padding: 16, color: 'var(--text-muted)', fontSize: 13 }}>
        Unsupported chart type: {chartType}
      </div>
    );
  }

  return <Renderer result={result} onSendMessage={onSendMessage} />;
}
