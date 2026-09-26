import { calculateDistance } from "../distance/haversine.ts";

export type GraphNode = {
  id: string;
  latitude: number;
  longitude: number;
};

type Edge = {
  id: string;
  meters: number;
};

class Heap {
  private data: Array<{ id: string; f: number }> = [];

  get size() {
    return this.data.length;
  }

  push(item: { id: string; f: number }) {
    this.data.push(item);
    this.up(this.data.length - 1);
  }

  pop() {
    if (this.data.length === 0) return undefined;
    const top = this.data[0];
    const last = this.data.pop();
    if (last && this.data.length > 0) {
      this.data[0] = last;
      this.down(0);
    }
    return top;
  }

  private up(index: number) {
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (this.data[parent].f <= this.data[index].f) return;
      [this.data[parent], this.data[index]] = [this.data[index], this.data[parent]];
      index = parent;
    }
  }

  private down(index: number) {
    for (;;) {
      const left = index * 2 + 1;
      const right = left + 1;
      let smallest = index;
      if (left < this.data.length && this.data[left].f < this.data[smallest].f) smallest = left;
      if (right < this.data.length && this.data[right].f < this.data[smallest].f) smallest = right;
      if (smallest === index) return;
      [this.data[smallest], this.data[index]] = [this.data[index], this.data[smallest]];
      index = smallest;
    }
  }
}

export function shortestPath(
  nodes: Map<string, GraphNode>,
  neighbors: Map<string, Edge[]>,
  start: string,
  goal: string,
) {
  if (!nodes.has(start) || !nodes.has(goal)) return null;
  const goalNode = nodes.get(goal)!;
  const open = new Heap();
  const cost = new Map<string, number>([[start, 0]]);
  const came = new Map<string, string>();
  const closed = new Set<string>();
  open.push({ id: start, f: calculateDistance(nodes.get(start)!.latitude, nodes.get(start)!.longitude, goalNode.latitude, goalNode.longitude) });

  let expanded = 0;
  while (open.size > 0 && expanded < 20000) {
    const current = open.pop();
    if (!current || closed.has(current.id)) continue;
    closed.add(current.id);
    expanded += 1;
    if (current.id === goal) {
      const path = [goal];
      let cursor = goal;
      while (came.has(cursor)) {
        cursor = came.get(cursor)!;
        path.push(cursor);
      }
      path.reverse();
      return path;
    }
    const soFar = cost.get(current.id) ?? Number.POSITIVE_INFINITY;
    for (const edge of neighbors.get(current.id) ?? []) {
      const next = soFar + edge.meters;
      if (next >= (cost.get(edge.id) ?? Number.POSITIVE_INFINITY)) continue;
      cost.set(edge.id, next);
      came.set(edge.id, current.id);
      const node = nodes.get(edge.id);
      const heuristic = node
        ? calculateDistance(node.latitude, node.longitude, goalNode.latitude, goalNode.longitude)
        : 0;
      open.push({ id: edge.id, f: next + heuristic });
    }
  }
  return null;
}
