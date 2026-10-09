"use client";

import "maplibre-gl/dist/maplibre-gl.css";

import { MapboxOverlay, type MapboxOverlayProps } from "@deck.gl/mapbox";
import { ColumnLayer, GeoJsonLayer } from "@deck.gl/layers";
import type { PickingInfo } from "@deck.gl/core";
import { setWorkerUrl } from "maplibre-gl";
import { useReducedMotion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import MapGL, { NavigationControl, useControl, type MapRef, type ViewState } from "react-map-gl/maplibre";

import { BASE_PATH, useJson } from "@/lib/client-data";
import { areaTitle } from "@/lib/format";
import { makeScale, type Metric } from "@/lib/metrics";
import type { Area } from "@/lib/types";

// MapLibre's tile worker is copied to public/ by the predev/prebuild scripts; bundlers can't
// resolve it from inside the package.
setWorkerUrl(`${BASE_PATH}/maplibre-gl-worker.mjs`);

// Free, keyless basemaps from CARTO (OpenStreetMap data). Attribution is shown on the map.
const STYLE_LABELS = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";
const STYLE_PLAIN = "https://basemaps.cartocdn.com/gl/dark-matter-nolabels-gl-style/style.json";

type Shape = GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon, { area_name: string; slug: string | null }>;
type Shapes = GeoJSON.FeatureCollection<Shape["geometry"], Shape["properties"]>;

function DeckOverlay(props: MapboxOverlayProps) {
  const overlay = useControl<MapboxOverlay>(() => new MapboxOverlay(props));
  overlay.setProps(props);
  return null;
}

export const DUBAI_VIEW: ViewState = {
  longitude: 55.2,
  latitude: 25.12,
  zoom: 10.2,
  pitch: 50,
  bearing: -18,
  padding: { top: 0, bottom: 0, left: 0, right: 0 },
};

export interface HoverInfo {
  area: Area;
  x: number;
  y: number;
}

export function AreaMap({
  areas,
  metric,
  extruded = true,
  labels = true,
  autoRotate = false,
  interactive = true,
  selected,
  onSelect,
  onHover,
  initialView,
  focusRight = false,
  className,
}: {
  areas: Area[];
  metric: Metric;
  extruded?: boolean;
  labels?: boolean;
  autoRotate?: boolean;
  interactive?: boolean;
  selected?: string | null;
  onSelect?: (area: Area | null) => void;
  onHover?: (info: HoverInfo | null) => void;
  initialView?: Partial<ViewState>;
  /** Shift the city to the right half on wide screens (leaves room for a headline). */
  focusRight?: boolean;
  className?: string;
}) {
  const { data: shapes } = useJson<Shapes>("areas.geojson");
  const mapRef = useRef<MapRef>(null);
  // The map only renders in the browser (dynamic import, ssr: false), so window is available.
  const [view, setView] = useState<ViewState>(() => {
    const view = { ...DUBAI_VIEW, ...initialView };
    if (focusRight && window.innerWidth >= 1024) {
      view.padding = { top: 60, bottom: 120, left: Math.round(window.innerWidth * 0.42), right: 0 };
    }
    return view;
  });
  const [dragging, setDragging] = useState(false);
  // deck.gl attaches to the map as a control; adding it before the style loads throws.
  const [loaded, setLoaded] = useState(false);
  const reduced = useReducedMotion();
  // Flatten the camera for the 2D view, tilt it back for 3D.
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    mapRef.current?.easeTo({ pitch: extruded ? 50 : 0, duration: 800 });
  }, [extruded]);

  // Slow orbit for the hero; pauses while the user is interacting.
  useEffect(() => {
    if (!autoRotate || dragging || reduced) return;
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      setView((v) => ({ ...v, bearing: (v.bearing + dt * 0.004) % 360 }));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [autoRotate, dragging, reduced]);

  const bySlug = useMemo(() => new Map(areas.map((a) => [a.slug, a])), [areas]);
  const scale = useMemo(() => makeScale(metric, areas), [metric, areas]);
  const covered = useMemo(
    () => new Set((shapes?.features ?? []).map((f) => f.properties.slug).filter(Boolean)),
    [shapes],
  );
  const points = useMemo(
    () => areas.filter((a) => !covered.has(a.slug) && a.lat != null && a.lng != null),
    [areas, covered],
  );

  const elevation = (a: Area | undefined) => {
    if (!a) return 0;
    const t = scale.t(metric.get(a));
    return t == null ? 20 : 40 + t * 1500;
  };

  const layers = [
    new GeoJsonLayer<Shape["properties"]>({
      id: "areas",
      data: (shapes?.features ?? []) as never,
      pickable: interactive,
      stroked: true,
      filled: true,
      extruded,
      wireframe: false,
      getFillColor: (f) => {
        const a = bySlug.get(f.properties.slug ?? "");
        if (!a) return [40, 46, 62, extruded ? 0 : 40];
        return scale.color(metric.get(a), f.properties.slug === selected ? 255 : 215);
      },
      getLineColor: (f) =>
        f.properties.slug && f.properties.slug === selected ? [255, 236, 190, 255] : [255, 255, 255, 28],
      getLineWidth: (f) => (f.properties.slug === selected ? 3 : 1),
      lineWidthUnits: "pixels",
      getElevation: (f) => elevation(bySlug.get(f.properties.slug ?? "")),
      material: { ambient: 0.55, diffuse: 0.6, shininess: 40, specularColor: [255, 230, 190] },
      transitions: { getElevation: 900, getFillColor: 600 },
      updateTriggers: {
        getFillColor: [metric.key, selected, areas],
        getElevation: [metric.key, areas],
        getLineColor: [selected],
        getLineWidth: [selected],
      },
      autoHighlight: interactive,
      highlightColor: [255, 255, 255, 60],
    }),
    new ColumnLayer<Area>({
      id: "points",
      data: points,
      diskResolution: 6,
      radius: 320,
      extruded,
      pickable: interactive,
      getPosition: (a) => [a.lng ?? 0, a.lat ?? 0],
      getFillColor: (a) => scale.color(metric.get(a), a.slug === selected ? 255 : 230),
      getElevation: (a) => elevation(a),
      material: { ambient: 0.6, diffuse: 0.6, shininess: 40, specularColor: [255, 230, 190] },
      transitions: { getElevation: 900, getFillColor: 600 },
      updateTriggers: { getFillColor: [metric.key, selected, areas], getElevation: [metric.key, areas] },
    }),
  ];

  const pick = (info: PickingInfo): Area | null => {
    const obj = info.object as Shape | Area | undefined;
    if (!obj) return null;
    if ("properties" in obj) return bySlug.get(obj.properties.slug ?? "") ?? null;
    return obj as Area;
  };

  return (
    <div className={className} onPointerDown={() => setDragging(true)} onPointerUp={() => setDragging(false)}>
      <MapGL
        ref={mapRef}
        {...view}
        onMove={(e) => setView(e.viewState)}
        onLoad={() => setLoaded(true)}
        mapStyle={labels ? STYLE_LABELS : STYLE_PLAIN}
        interactive={interactive}
        maxPitch={70}
        minZoom={8.5}
        maxZoom={15}
        dragRotate
        attributionControl={{ compact: true }}
        style={{ width: "100%", height: "100%" }}
      >
        {loaded && (
        <DeckOverlay
          layers={layers}
          onHover={(info) => {
            const area = pick(info);
            onHover?.(area ? { area, x: info.x, y: info.y } : null);
          }}
          onClick={(info) => onSelect?.(pick(info))}
          getCursor={({ isHovering }) => (isHovering ? "pointer" : "grab")}
        />
        )}
        {interactive && <NavigationControl position="bottom-right" visualizePitch />}
      </MapGL>
    </div>
  );
}

export function MapTooltip({ hover, metric }: { hover: HoverInfo | null; metric: Metric }) {
  if (!hover) return null;
  const { area, x, y } = hover;
  return (
    <div
      className="pointer-events-none absolute z-20 min-w-48 rounded-xl border border-line-strong bg-elevated/90 px-3.5 py-3 text-xs shadow-2xl backdrop-blur-xl"
      style={{ left: x + 14, top: y + 14 }}
    >
      <div className="text-sm font-medium text-ink">{areaTitle(area)}</div>
      {area.knownAs && <div className="text-[11px] text-faint">{area.name}</div>}
      <div className="mt-2 flex items-baseline justify-between gap-6">
        <span className="text-muted">{metric.label}</span>
        <span className="tabular font-semibold text-gold">{metric.format(metric.get(area))}</span>
      </div>
      {metric.key !== "ppsf" && (
        <div className="mt-1 flex justify-between gap-6 text-muted">
          <span>AED/sqft</span>
          <span className="tabular text-ink">{area.ppsf?.toLocaleString("en-US") ?? "—"}</span>
        </div>
      )}
    </div>
  );
}

export function Legend({ metric, areas }: { metric: Metric; areas: Area[] }) {
  const scale = makeScale(metric, areas);
  const stops = Array.from({ length: 24 }, (_, i) => scale.cssColor(i / 23));
  const lo = metric.scale === "diverging" ? scale.min : scale.quantile(0.02);
  const hi = metric.scale === "diverging" ? scale.max : scale.quantile(0.98);
  return (
    <div>
      <div
        className="h-2 w-full rounded-full"
        style={{ background: `linear-gradient(90deg, ${stops.join(",")})` }}
      />
      <div className="mt-1.5 flex justify-between text-[11px] text-faint tabular">
        <span>{metric.format(lo ?? null)}</span>
        <span>{metric.format(hi ?? null)}</span>
      </div>
    </div>
  );
}
