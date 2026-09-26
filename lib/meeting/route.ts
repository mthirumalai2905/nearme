import { calculateDistance, maxPairwiseDistance } from "@/lib/distance/haversine";
import { shortestPath, type GraphNode } from "@/lib/meeting/astar";
import { travelMinutes } from "@/lib/meeting/fairness";
import { queryOverpass } from "@/lib/meeting/overpass";

export type RoutePerson = {
  name: string;
  latitude: number;
  longitude: number;
};

export type MeetPath = {
  name: string;
  minutes: number;
  meters: number;
  line: Array<[number, number]>;
};

type Edge = { id: string; meters: number };

type Geom = { lat: number; lon: number };

function thin(line: Array<[number, number]>, max = 160) {
  if (line.length <= max) return line;
  const step = Math.ceil(line.length / max);
  const next = line.filter((_, index) => index % step === 0);
  const last = line[line.length - 1];
  if (next[next.length - 1][0] !== last[0] || next[next.length - 1][1] !== last[1]) next.push(last);
  return next;
}

function lengthOf(line: Array<[number, number]>) {
  let meters = 0;
  for (let index = 1; index < line.length; index += 1) {
    meters += calculateDistance(line[index - 1][0], line[index - 1][1], line[index][0], line[index][1]);
  }
  return meters;
}

function addEdge(neighbors: Map<string, Edge[]>, from: string, to: string, meters: number) {
  if (from === to || meters <= 0) return;
  const left = neighbors.get(from) ?? [];
  if (!left.some((edge) => edge.id === to)) left.push({ id: to, meters });
  neighbors.set(from, left);
  const right = neighbors.get(to) ?? [];
  if (!right.some((edge) => edge.id === from)) right.push({ id: from, meters });
  neighbors.set(to, right);
}

async function roadGraph(points: Array<{ latitude: number; longitude: number }>) {
  const latitudes = points.map((point) => point.latitude);
  const longitudes = points.map((point) => point.longitude);
  const south = Math.min(...latitudes) - 0.008;
  const north = Math.max(...latitudes) + 0.008;
  const west = Math.min(...longitudes) - 0.008;
  const east = Math.max(...longitudes) + 0.008;
  const query = `[out:json][timeout:15];way["highway"~"^(footway|path|pedestrian|steps|living_street|residential|service|unclassified|tertiary)$"](${south},${west},${north},${east});out geom;`;
  const body = await queryOverpass(query);
  const nodes = new Map<string, GraphNode>();
  const neighbors = new Map<string, Edge[]>();
  for (const element of body.elements ?? []) {
    const geometry = (element as { geometry?: Geom[] }).geometry;
    if (!geometry || geometry.length < 2) continue;
    for (let index = 1; index < geometry.length; index += 1) {
      const previous = geometry[index - 1];
      const current = geometry[index];
      const from = `${previous.lat.toFixed(5)},${previous.lon.toFixed(5)}`;
      const to = `${current.lat.toFixed(5)},${current.lon.toFixed(5)}`;
      nodes.set(from, { id: from, latitude: previous.lat, longitude: previous.lon });
      nodes.set(to, { id: to, latitude: current.lat, longitude: current.lon });
      addEdge(neighbors, from, to, calculateDistance(previous.lat, previous.lon, current.lat, current.lon));
    }
  }
  return { nodes, neighbors };
}

function nearest(nodes: Map<string, GraphNode>, latitude: number, longitude: number) {
  let best: GraphNode | null = null;
  let bestMeters = 220;
  for (const node of nodes.values()) {
    const meters = calculateDistance(latitude, longitude, node.latitude, node.longitude);
    if (meters < bestMeters) {
      best = node;
      bestMeters = meters;
    }
  }
  return best;
}

function walkAstar(
  graph: { nodes: Map<string, GraphNode>; neighbors: Map<string, Edge[]> },
  person: RoutePerson,
  place: { latitude: number; longitude: number },
) {
  const startNode = nearest(graph.nodes, person.latitude, person.longitude);
  const goalNode = nearest(graph.nodes, place.latitude, place.longitude);
  if (!startNode || !goalNode) return null;
  const nodes = new Map(graph.nodes);
  const neighbors = new Map<string, Edge[]>();
  for (const [id, edges] of graph.neighbors) neighbors.set(id, edges.map((edge) => ({ ...edge })));
  const start = `start:${person.name}`;
  const goal = "goal";
  nodes.set(start, { id: start, latitude: person.latitude, longitude: person.longitude });
  nodes.set(goal, { id: goal, latitude: place.latitude, longitude: place.longitude });
  addEdge(neighbors, start, startNode.id, calculateDistance(person.latitude, person.longitude, startNode.latitude, startNode.longitude));
  addEdge(neighbors, goal, goalNode.id, calculateDistance(place.latitude, place.longitude, goalNode.latitude, goalNode.longitude));
  const ids = shortestPath(nodes, neighbors, start, goal);
  if (!ids || ids.length < 2) return null;
  return thin(ids.map((id) => [nodes.get(id)!.latitude, nodes.get(id)!.longitude] as [number, number]));
}

async function walkOsrm(person: RoutePerson, place: { latitude: number; longitude: number }) {
  const url = `https://router.project-osrm.org/route/v1/foot/${person.longitude},${person.latitude};${place.longitude},${place.latitude}?overview=simplified&geometries=geojson`;
  const response = await fetch(url, {
    signal: AbortSignal.timeout(8000),
    headers: { "User-Agent": "NearMe/0.1" },
  });
  if (!response.ok) return null;
  const body = (await response.json()) as {
    routes?: Array<{ geometry?: { coordinates?: Array<[number, number]> } }>;
  };
  const coordinates = body.routes?.[0]?.geometry?.coordinates;
  if (!coordinates || coordinates.length < 2) return null;
  return thin(coordinates.map(([longitude, latitude]) => [latitude, longitude] as [number, number]));
}

export async function routeToPlace(people: RoutePerson[], place: { latitude: number; longitude: number }) {
  const spread = maxPairwiseDistance([...people, place]);
  let graph: { nodes: Map<string, GraphNode>; neighbors: Map<string, Edge[]> } | null = null;
  if (spread < 6000) {
    try {
      graph = await roadGraph([...people, place]);
      if (graph.nodes.size < 8 || graph.nodes.size > 8000) graph = null;
    } catch {
      graph = null;
    }
  }

  const paths: MeetPath[] = [];
  for (const person of people) {
    let line = graph ? walkAstar(graph, person, place) : null;
    if (!line) {
      try {
        line = await walkOsrm(person, place);
      } catch {
        line = null;
      }
    }
    if (!line) {
      line = [
        [person.latitude, person.longitude],
        [place.latitude, place.longitude],
      ];
    }
    const meters = Math.round(lengthOf(line));
    paths.push({
      name: person.name,
      meters,
      minutes: travelMinutes(meters, spread),
      line,
    });
  }
  return paths;
}
