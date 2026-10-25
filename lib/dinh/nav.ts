import type { NavEdge, NavNode, Vec3 } from "@/types";

export class NavGraph {
  readonly nodes: NavNode[];
  private adj = new Map<string, { id: string; w: number }[]>();
  private byId = new Map<string, NavNode>();

  constructor(nodes: NavNode[], edges: NavEdge[]) {
    this.nodes = nodes;
    for (const n of nodes) {
      this.byId.set(n.id, n);
      this.adj.set(n.id, []);
    }
    for (const [a, b] of edges) {
      const na = this.byId.get(a), nb = this.byId.get(b);
      if (!na || !nb) throw new Error(`nav edge ${a}-${b} references a missing node`);
      const w = dist(na.p, nb.p);
      this.adj.get(a)!.push({ id: b, w });
      this.adj.get(b)!.push({ id: a, w });
    }
  }

  get(id: string) {
    return this.byId.get(id);
  }

  /** Nearest nodes by 3D distance (vertical distance weighted so floors don't mix). */
  nearest(p: Vec3, accept?: (n: NavNode) => boolean, k = 6): NavNode[] {
    return this.nodes
      .filter((n) => !accept || accept(n))
      .map((n) => ({ n, d: Math.hypot(n.p[0] - p[0], (n.p[1] - p[1]) * 4, n.p[2] - p[2]) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, k)
      .map((x) => x.n);
  }

  /** A* shortest path between node ids. */
  path(from: string, to: string): NavNode[] | null {
    if (from === to) return [this.byId.get(from)!];
    const goal = this.byId.get(to)!;
    const open = new Set([from]);
    const came = new Map<string, string>();
    const g = new Map<string, number>([[from, 0]]);
    const f = new Map<string, number>([[from, dist(this.byId.get(from)!.p, goal.p)]]);
    while (open.size) {
      let cur = "";
      let best = Infinity;
      for (const id of open) {
        const v = f.get(id) ?? Infinity;
        if (v < best) { best = v; cur = id; }
      }
      if (cur === to) {
        const out = [this.byId.get(cur)!];
        while (came.has(cur)) {
          cur = came.get(cur)!;
          out.unshift(this.byId.get(cur)!);
        }
        return out;
      }
      open.delete(cur);
      for (const { id, w } of this.adj.get(cur)!) {
        const t = (g.get(cur) ?? Infinity) + w;
        if (t < (g.get(id) ?? Infinity)) {
          came.set(id, cur);
          g.set(id, t);
          f.set(id, t + dist(this.byId.get(id)!.p, goal.p));
          open.add(id);
        }
      }
    }
    return null;
  }
}

export const dist = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
