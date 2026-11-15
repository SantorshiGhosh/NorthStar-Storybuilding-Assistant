/**
 * Graph layout algorithms for Story Architect
 * Supports: Force-Directed, Hierarchical, Circular, Grid, Family-Tree, Manual
 */

export function computeLayout(nodes, edges, layoutType) {
  if (!nodes || nodes.length === 0) return [];
  const count = nodes.length;

  if (layoutType === 'grid') {
    const cols = Math.max(2, Math.ceil(Math.sqrt(count * 1.5)));
    return nodes.map((node, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      return {
        ...node,
        position: { x: col * 280 + 80, y: row * 180 + 80 },
      };
    });
  }

  if (layoutType === 'circular') {
    const radius = Math.max(240, count * 35);
    const centerX = radius + 120;
    const centerY = radius + 100;
    return nodes.map((node, i) => {
      const angle = (i / count) * 2 * Math.PI;
      return {
        ...node,
        position: {
          x: Math.round(centerX + radius * Math.cos(angle)),
          y: Math.round(centerY + radius * Math.sin(angle)),
        },
      };
    });
  }

  if (layoutType === 'hierarchical' || layoutType === 'family_tree') {
    const levels = new Map();
    nodes.forEach((n, idx) => {
      const gen = n.data?.custom_properties?.generation ?? n.data?.generation ?? (idx % 3);
      if (!levels.has(gen)) levels.set(gen, []);
      levels.get(gen).push(n);
    });
    const sortedLevels = Array.from(levels.keys()).sort((a, b) => Number(a) - Number(b));
    const result = [];
    sortedLevels.forEach((lvl, rowIdx) => {
      const rowNodes = levels.get(lvl);
      const totalWidth = rowNodes.length * 280;
      const startX = Math.max(80, (1100 - totalWidth) / 2);
      rowNodes.forEach((node, colIdx) => {
        result.push({
          ...node,
          position: {
            x: Math.round(startX + colIdx * 280),
            y: Math.round(rowIdx * 200 + 80),
          },
        });
      });
    });
    return result;
  }

  if (layoutType === 'force_directed') {
    const positions = nodes.map((n, i) => ({
      id: n.id,
      x: n.position?.x ?? (i % 4) * 280 + 80,
      y: n.position?.y ?? Math.floor(i / 4) * 180 + 80,
      vx: 0,
      vy: 0,
    }));
    const k = 220;
    for (let iter = 0; iter < 30; iter++) {
      for (let i = 0; i < positions.length; i++) {
        for (let j = i + 1; j < positions.length; j++) {
          const dx = positions[j].x - positions[i].x || 1;
          const dy = positions[j].y - positions[i].y || 1;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const repulse = (k * k) / dist;
          const fx = (dx / dist) * repulse * 0.04;
          const fy = (dy / dist) * repulse * 0.04;
          positions[i].x -= fx;
          positions[i].y -= fy;
          positions[j].x += fx;
          positions[j].y += fy;
        }
      }
      (edges || []).forEach((e) => {
        const p1 = positions.find((p) => p.id === e.source);
        const p2 = positions.find((p) => p.id === e.target);
        if (p1 && p2) {
          const dx = p2.x - p1.x;
          const dy = p2.y - p1.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const attract = (dist * dist) / k;
          const fx = (dx / dist) * attract * 0.02;
          const fy = (dy / dist) * attract * 0.02;
          p1.x += fx;
          p1.y += fy;
          p2.x -= fx;
          p2.y -= fy;
        }
      });
    }
    const posMap = new Map(positions.map((p) => [p.id, { x: Math.max(50, Math.round(p.x)), y: Math.max(50, Math.round(p.y)) }]));
    return nodes.map((n) => ({
      ...n,
      position: posMap.get(n.id) || n.position,
    }));
  }

  return nodes;
}
