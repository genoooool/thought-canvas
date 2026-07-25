export const NODE_W = 308;
export const NODE_MIN_H = 170;
export const NODE_MAX_H = 224;
export const COLUMN_GAP = 430;
export const NODE_GAP = 38;
export const GROUP_GAP = 88;

const numberOrZero = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const stringValue = value => String(value || '');
const defaultHeight = node => Math.max(1, numberOrZero(node?.height) || NODE_MIN_H);

export function stableLayoutComparator(a, b) {
  return numberOrZero(a?.layoutOrder) - numberOrZero(b?.layoutOrder)
    || numberOrZero(a?.sectionOrder) - numberOrZero(b?.sectionOrder)
    || stringValue(a?.createdAt).localeCompare(stringValue(b?.createdAt))
    || stringValue(a?.id).localeCompare(stringValue(b?.id));
}

export function isVerticalDecompositionGroup(nodes) {
  if (!Array.isArray(nodes) || nodes.length < 2) return false;
  const groupId = stringValue(nodes[0]?.groupId);
  return groupId.startsWith('decomposition:')
    && nodes.every(node => stringValue(node?.groupId) === groupId);
}

export function siblingLayoutGap(previous, current, { nodeGap = NODE_GAP, groupGap = GROUP_GAP } = {}) {
  if (!previous || !current) return nodeGap;
  return previous.groupId && previous.groupId === current.groupId ? nodeGap : groupGap;
}

function buildChildrenMap(nodes) {
  const byId = new Map(nodes.map(node => [node.id, node]));
  const children = new Map(nodes.map(node => [node.id, []]));
  nodes.forEach(node => {
    if (node.parentId && byId.has(node.parentId)) children.get(node.parentId).push(node);
  });
  children.forEach(items => items.sort(stableLayoutComparator));
  return { byId, children };
}

function shiftedContourValue(contour, depth, shift) {
  const value = contour.get(depth);
  return value === undefined ? undefined : value + shift;
}

function layoutLocalSubtree(nodeId, context, visiting = new Set()) {
  if (visiting.has(nodeId)) throw new Error(`Layout cycle detected at ${nodeId}`);
  const node = context.byId.get(nodeId);
  if (!node) throw new Error(`Missing layout node ${nodeId}`);
  const nextVisiting = new Set(visiting).add(nodeId);
  const height = context.getHeight(node);
  const positions = new Map([[nodeId, { depth: 0, centerY: 0 }]]);
  const upperContour = new Map([[0, -height / 2]]);
  const lowerContour = new Map([[0, height / 2]]);
  const children = context.children.get(nodeId) || [];
  if (!children.length) return { rootId: nodeId, positions, upperContour, lowerContour };

  const accumulatedUpper = new Map();
  const accumulatedLower = new Map();
  const placements = [];
  let previousRoot = null;
  for (const child of children) {
    const childLayout = layoutLocalSubtree(child.id, context, nextVisiting);
    let shift = 0;
    if (placements.length) {
      for (const [childDepth, childUpper] of childLayout.upperContour) {
        const depth = childDepth + 1;
        const placedLower = accumulatedLower.get(depth);
        if (placedLower === undefined) continue;
        const gap = depth === 1
          ? siblingLayoutGap(previousRoot, child, context)
          : context.nodeGap;
        shift = Math.max(shift, placedLower + gap - childUpper);
      }
    }
    placements.push({ child, layout: childLayout, shift });
    for (const [childDepth, childUpper] of childLayout.upperContour) {
      const depth = childDepth + 1;
      const upper = childUpper + shift;
      const lower = childLayout.lowerContour.get(childDepth) + shift;
      accumulatedUpper.set(depth, Math.min(accumulatedUpper.get(depth) ?? Infinity, upper));
      accumulatedLower.set(depth, Math.max(accumulatedLower.get(depth) ?? -Infinity, lower));
    }
    previousRoot = child;
  }

  const firstCenter = placements[0].shift;
  const lastCenter = placements.at(-1).shift;
  const groupOffset = -(firstCenter + lastCenter) / 2;
  for (const placement of placements) {
    const shift = placement.shift + groupOffset;
    for (const [id, local] of placement.layout.positions) {
      positions.set(id, { depth: local.depth + 1, centerY: local.centerY + shift });
    }
  }
  for (const depth of accumulatedUpper.keys()) {
    upperContour.set(depth, shiftedContourValue(accumulatedUpper, depth, groupOffset));
    lowerContour.set(depth, shiftedContourValue(accumulatedLower, depth, groupOffset));
  }
  return { rootId: nodeId, positions, upperContour, lowerContour };
}

export function layoutTree(nodes, {
  rootId,
  rootX = 180,
  rootCenterY = 350,
  columnGap = COLUMN_GAP,
  nodeGap = NODE_GAP,
  groupGap = GROUP_GAP,
  getHeight = defaultHeight
} = {}) {
  const active = (nodes || []).filter(node => node && node.status !== 'archived');
  const { byId, children } = buildChildrenMap(active);
  if (!rootId || !byId.has(rootId)) throw new Error(`Missing layout root ${rootId || ''}`);
  const local = layoutLocalSubtree(rootId, { byId, children, getHeight, nodeGap, groupGap });
  const positions = new Map();
  for (const [id, item] of local.positions) {
    const node = byId.get(id);
    const centerY = rootCenterY + item.centerY;
    positions.set(id, {
      x: rootX + item.depth * columnGap,
      y: centerY - getHeight(node) / 2,
      centerY,
      depth: item.depth
    });
  }
  return {
    rootId,
    nodeIds: [...positions.keys()],
    positions,
    bounds: computeBounds(active.filter(node => positions.has(node.id)), positions, { getHeight })
  };
}

export function layoutChildGroup(parent, nodes, {
  rootIds,
  parentX = numberOrZero(parent?.x),
  parentCenterY = numberOrZero(parent?.y) + defaultHeight(parent) / 2,
  getHeight = defaultHeight,
  ...options
} = {}) {
  const roots = new Set(rootIds || []);
  const syntheticId = `__layout_parent__${stringValue(parent?.id)}`;
  const synthetic = { ...parent, id: syntheticId, parentId: null };
  const cloned = (nodes || []).map(node => roots.has(node.id) ? { ...node, parentId: syntheticId } : { ...node });
  const result = layoutTree([synthetic, ...cloned], {
    ...options,
    rootId: syntheticId,
    rootX: parentX,
    rootCenterY: parentCenterY,
    getHeight
  });
  result.positions.delete(syntheticId);
  result.nodeIds = result.nodeIds.filter(id => id !== syntheticId);
  result.bounds = computeBounds(cloned.filter(node => result.positions.has(node.id)), result.positions, { getHeight });
  return result;
}

export function computeBounds(nodes, positions, { nodeWidth = NODE_W, getHeight = defaultHeight } = {}) {
  const placed = (nodes || []).filter(node => positions?.has(node.id));
  if (!placed.length) return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
  const minX = Math.min(...placed.map(node => positions.get(node.id).x));
  const minY = Math.min(...placed.map(node => positions.get(node.id).y));
  const maxX = Math.max(...placed.map(node => positions.get(node.id).x + nodeWidth));
  const maxY = Math.max(...placed.map(node => positions.get(node.id).y + getHeight(node)));
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

export function translatePositions(positions, dx = 0, dy = 0) {
  return new Map([...positions].map(([id, position]) => [id, {
    ...position,
    x: position.x + dx,
    y: position.y + dy,
    centerY: Number.isFinite(position.centerY) ? position.centerY + dy : position.centerY
  }]));
}

function mergeIntervals(intervals) {
  const ordered = intervals
    .filter(interval => Number.isFinite(interval.start) && Number.isFinite(interval.end) && interval.end > interval.start)
    .sort((a, b) => a.start - b.start || a.end - b.end);
  const merged = [];
  for (const interval of ordered) {
    const previous = merged.at(-1);
    if (!previous || interval.start > previous.end) merged.push({ ...interval });
    else previous.end = Math.max(previous.end, interval.end);
  }
  return merged;
}

export function nearestVerticalTranslation({
  positions,
  nodes,
  occupied = [],
  preferredDy = 0,
  minY = 20,
  nodeWidth = NODE_W,
  gap = NODE_GAP,
  getHeight = defaultHeight
} = {}) {
  const active = (nodes || []).filter(node => positions?.has(node.id));
  if (!active.length) return 0;
  const bounds = computeBounds(active, positions, { nodeWidth, getHeight });
  const minimumDy = minY - bounds.minY;
  const intervals = [];
  for (const node of active) {
    const placed = positions.get(node.id);
    const height = getHeight(node);
    for (const other of occupied) {
      const otherNode = other.node || other;
      const otherX = numberOrZero(other.x ?? other.position?.x ?? otherNode.x);
      const otherY = numberOrZero(other.y ?? other.position?.y ?? otherNode.y);
      const otherHeight = getHeight(otherNode);
      const xOverlaps = placed.x < otherX + nodeWidth + gap
        && placed.x + nodeWidth + gap > otherX;
      if (!xOverlaps) continue;
      intervals.push({
        start: otherY - (placed.y + height) - gap,
        end: otherY + otherHeight + gap - placed.y
      });
    }
  }
  const forbidden = mergeIntervals(intervals);
  const preferred = Math.max(preferredDy, minimumDy);
  const candidates = [preferred, minimumDy];
  forbidden.forEach(interval => {
    if (interval.start >= minimumDy) candidates.push(interval.start);
    if (interval.end >= minimumDy) candidates.push(interval.end);
  });
  const legal = value => value >= minimumDy - 1e-9
    && !forbidden.some(interval => value > interval.start + 1e-9 && value < interval.end - 1e-9);
  const ordered = [...new Set(candidates.filter(Number.isFinite))]
    .filter(legal)
    .sort((a, b) => Math.abs(a - preferredDy) - Math.abs(b - preferredDy) || b - a);
  return ordered[0] ?? minimumDy;
}

function rectanglesOverlap(a, b, nodeWidth, getHeight) {
  return a.position.x < b.position.x + nodeWidth
    && a.position.x + nodeWidth > b.position.x
    && a.position.y < b.position.y + getHeight(b.node)
    && a.position.y + getHeight(a.node) > b.position.y;
}

export function validateLayoutInvariants(nodes, positions, {
  columnGap = COLUMN_GAP,
  nodeGap = NODE_GAP,
  nodeWidth = NODE_W,
  getHeight = defaultHeight,
  checkParentColumns = true,
  checkSiblingCentering = true,
  occupied = [],
  manualPositions = null
} = {}) {
  const active = (nodes || []).filter(node => node && node.status !== 'archived' && positions?.has(node.id));
  const byId = new Map(active.map(node => [node.id, node]));
  const errors = [];
  const center = node => positions.get(node.id).y + getHeight(node) / 2;
  const normalChild = node => !['merge', 'merge_summary', 'annotation'].includes(node.kind);

  if (checkParentColumns) {
    active.forEach(node => {
      const parent = byId.get(node.parentId);
      if (!parent || !normalChild(node)) return;
      const delta = positions.get(node.id).x - positions.get(parent.id).x;
      if (Math.abs(delta - columnGap) > 1e-9) errors.push(`parent-column:${node.id}:${delta}`);
    });
  }

  const childrenByParent = new Map();
  active.forEach(node => {
    if (!node.parentId || !byId.has(node.parentId) || !normalChild(node)) return;
    if (!childrenByParent.has(node.parentId)) childrenByParent.set(node.parentId, []);
    childrenByParent.get(node.parentId).push(node);
  });
  childrenByParent.forEach((children, parentId) => {
    const ordered = [...children].sort(stableLayoutComparator);
    if (checkSiblingCentering) {
      const midpoint = (center(ordered[0]) + center(ordered.at(-1))) / 2;
      if (Math.abs(midpoint - center(byId.get(parentId))) > 1e-9) errors.push(`sibling-centering:${parentId}`);
    }
    const decompositionGroups = new Map();
    ordered.forEach(child => {
      if (!stringValue(child.groupId).startsWith('decomposition:')) return;
      if (!decompositionGroups.has(child.groupId)) decompositionGroups.set(child.groupId, []);
      decompositionGroups.get(child.groupId).push(child);
    });
    decompositionGroups.forEach(group => {
      const semantic = [...group].sort(stableLayoutComparator);
      const visual = [...group].sort((a, b) => positions.get(a.id).y - positions.get(b.id).y || stableLayoutComparator(a, b));
      if (new Set(group.map(node => positions.get(node.id).x)).size !== 1) errors.push(`decomposition-column:${parentId}:${group[0].groupId}`);
      if (semantic.some((node, index) => node.id !== visual[index]?.id)) errors.push(`decomposition-order:${parentId}:${group[0].groupId}`);
      for (let index = 1; index < semantic.length; index += 1) {
        const previous = semantic[index - 1];
        const current = semantic[index];
        const gap = positions.get(current.id).y - positions.get(previous.id).y - getHeight(previous);
        if (gap < nodeGap - 1e-9) errors.push(`decomposition-gap:${previous.id}:${current.id}:${gap}`);
      }
    });
  });

  const placed = active.map(node => ({ node, position: positions.get(node.id) }));
  for (let index = 0; index < placed.length; index += 1) {
    for (let otherIndex = index + 1; otherIndex < placed.length; otherIndex += 1) {
      if (rectanglesOverlap(placed[index], placed[otherIndex], nodeWidth, getHeight)) {
        errors.push(`overlap:${placed[index].node.id}:${placed[otherIndex].node.id}`);
      }
    }
  }
  for (const item of placed) {
    for (const other of occupied) {
      const otherNode = other.node || other;
      const otherPosition = { x: numberOrZero(other.x ?? otherNode.x), y: numberOrZero(other.y ?? otherNode.y) };
      if (rectanglesOverlap(item, { node: otherNode, position: otherPosition }, nodeWidth, getHeight)) errors.push(`occupied-overlap:${item.node.id}:${otherNode.id || 'occupied'}`);
    }
  }
  if (manualPositions) {
    manualPositions.forEach((expected, id) => {
      const actual = positions.get(id);
      if (actual && (actual.x !== expected.x || actual.y !== expected.y)) errors.push(`manual-position:${id}`);
    });
  }
  return errors;
}
