export type DemoArea = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  stationQuery: string;
};

export const DEMO_AREAS: Record<"nagoya" | "tokyo", DemoArea> = {
  nagoya: {
    id: "area:nagoya-station",
    name: "名古屋駅周辺",
    lat: 35.170915,
    lng: 136.881537,
    stationQuery: "名古屋駅",
  },
  tokyo: {
    id: "area:tokyo-station",
    name: "東京駅周辺",
    lat: 35.681236,
    lng: 139.767125,
    stationQuery: "東京駅",
  },
};

export function areaFromId(areaId: string | null | undefined): DemoArea {
  if (areaId === DEMO_AREAS.tokyo.id) return DEMO_AREAS.tokyo;
  return DEMO_AREAS.nagoya;
}
