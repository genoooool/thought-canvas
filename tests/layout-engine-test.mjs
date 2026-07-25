import assert from 'node:assert/strict';
import {
  COLUMN_GAP,
  NODE_GAP,
  computeBounds,
  layoutChildGroup,
  layoutTree,
  nearestVerticalTranslation,
  stableLayoutComparator,
  translatePositions,
  validateLayoutInvariants
} from '../layout-engine.js';

const makeNode = (id, parentId = null, overrides = {}) => ({
  id,
  parentId,
  kind: id === 'root' ? 'root' : 'answer_branch',
  groupId: '',
  layoutOrder: 0,
  sectionOrder: 0,
  createdAt: `2026-07-25T00:00:${String(overrides.order ?? 0).padStart(2, '0')}.000Z`,
  height: 170,
  status: 'open',
  ...overrides
});
const heightOf = node => node.height;
const options = { getHeight: heightOf };
const position = (layout, id) => layout.positions.get(id);
const centerY = (layout, node) => position(layout, node.id).y + node.height / 2;
const assertNoErrors = (nodes, positions, extra = {}) => {
  const errors = validateLayoutInvariants(nodes, positions, { getHeight: heightOf, ...extra });
  assert.deepEqual(errors, [], errors.join('\n'));
};

// Fixture A: one decomposition group is one vertical column in stable order.
{
  const root = makeNode('root', null, { height: 190 });
  const children = Array.from({ length: 6 }, (_, index) => makeNode(`section-${index}`, root.id, {
    kind: 'content_section',
    groupId: 'decomposition:root:message:group',
    layoutOrder: 100 + index,
    sectionOrder: index,
    order: index,
    height: 162 + index * 11
  }));
  const nodes = [root, ...children].reverse();
  const layout = layoutTree(nodes, { rootId: root.id, rootX: 180, rootCenterY: 480, ...options });
  const ordered = [...children].sort(stableLayoutComparator);
  assert.equal(new Set(ordered.map(node => position(layout, node.id).x)).size, 1);
  assert.equal(position(layout, ordered[0].id).x, position(layout, root.id).x + COLUMN_GAP);
  assert.deepEqual([...ordered].sort((a, b) => position(layout, a.id).y - position(layout, b.id).y).map(node => node.id), ordered.map(node => node.id));
  for (let index = 1; index < ordered.length; index += 1) {
    const previous = ordered[index - 1];
    const current = ordered[index];
    assert.ok(position(layout, current.id).y - (position(layout, previous.id).y + previous.height) >= NODE_GAP - 1e-9);
  }
  assert.equal((centerY(layout, ordered[0]) + centerY(layout, ordered.at(-1))) / 2, centerY(layout, root));
  assertNoErrors([root, ...children], layout.positions);
}

// Fixture B: each decomposed module owns a horizontal, parent-relative chain.
{
  const root = makeNode('root');
  const nodes = [root];
  for (let index = 0; index < 4; index += 1) {
    let parent = makeNode(`module-${index}`, root.id, {
      kind: 'content_section', groupId: 'decomposition:root:m:g', layoutOrder: index, sectionOrder: index, order: index, height: 174 + index * 7
    });
    nodes.push(parent);
    for (let depth = 1; depth <= 3; depth += 1) {
      const child = makeNode(`module-${index}-step-${depth}`, parent.id, { layoutOrder: depth, order: depth, height: 165 + depth * 8 });
      nodes.push(child);
      parent = child;
    }
  }
  const layout = layoutTree(nodes, { rootId: root.id, rootX: 180, rootCenterY: 620, ...options });
  nodes.filter(node => node.parentId).forEach(node => {
    const parent = nodes.find(item => item.id === node.parentId);
    assert.equal(position(layout, node.id).x, position(layout, parent.id).x + COLUMN_GAP);
  });
  nodes.forEach(parent => {
    const children = nodes.filter(node => node.parentId === parent.id);
    if (children.length === 1) assert.equal(centerY(layout, children[0]), centerY(layout, parent));
  });
  assertNoErrors(nodes, layout.positions);
}

// Fixture C: nested decomposition and uneven subtrees stay compact and never fold back.
{
  const root = makeNode('root', null, { height: 205 });
  const modules = Array.from({ length: 7 }, (_, index) => makeNode(`top-${index}`, root.id, {
    kind: 'content_section', groupId: 'decomposition:root:top', layoutOrder: index, sectionOrder: index, order: index, height: 160 + (index % 3) * 24
  }));
  const nodes = [root, ...modules];
  nodes.push(makeNode('branch-a', 'top-1', { order: 10, height: 205 }));
  nodes.push(makeNode('branch-b', 'top-1', { order: 11, height: 171 }));
  const nested = Array.from({ length: 4 }, (_, index) => makeNode(`nested-${index}`, 'top-4', {
    kind: 'content_section', groupId: 'decomposition:top-4:nested', layoutOrder: index, sectionOrder: index, order: 20 + index, height: 166 + index * 9
  }));
  nodes.push(...nested, makeNode('nested-leaf', 'nested-2', { order: 30, height: 214 }));
  const layout = layoutTree(nodes, { rootId: root.id, rootX: 180, rootCenterY: 900, ...options });
  assertNoErrors(nodes, layout.positions);
  const bounds = computeBounds(nodes, layout.positions, options);
  const maxDepth = Math.max(...nodes.map(node => {
    let depth = 0;
    let current = node;
    while (current.parentId) { depth += 1; current = nodes.find(item => item.id === current.parentId); }
    return depth;
  }));
  assert.equal(bounds.maxX, 180 + maxDepth * COLUMN_GAP + 308);
}

// Fixture D: identical input is exactly deterministic, not approximately stable.
{
  const nodes = [makeNode('root'), ...Array.from({ length: 5 }, (_, index) => makeNode(`d-${index}`, 'root', {
    kind: 'content_section', groupId: 'decomposition:root:d', layoutOrder: index, sectionOrder: index, order: index, height: 170 + index * 5
  }))];
  const first = layoutTree(nodes, { rootId: 'root', rootX: 180, rootCenterY: 500, ...options });
  const second = layoutTree(nodes, { rootId: 'root', rootX: 180, rootCenterY: 500, ...options });
  assert.deepEqual([...second.positions], [...first.positions]);
}

// Fixture E: pending siblings move only vertically around stable occupied nodes.
{
  const parent = makeNode('stable-parent', null, { x: 610, y: 400, height: 190 });
  const pending = Array.from({ length: 3 }, (_, index) => makeNode(`pending-${index}`, parent.id, {
    kind: 'content_section', groupId: 'decomposition:stable-parent:new', layoutOrder: index, sectionOrder: index, order: index, height: 170 + index * 10
  }));
  const local = layoutChildGroup(parent, pending, { rootIds: pending.map(node => node.id), parentX: parent.x, parentCenterY: parent.y + parent.height / 2, ...options });
  const blocker = makeNode('stable-blocker', null, { height: 224 });
  const occupied = [{ node: blocker, x: parent.x + COLUMN_GAP, y: 350 }];
  const dy = nearestVerticalTranslation({ positions: local.positions, nodes: pending, occupied, preferredDy: 0, minY: 20, ...options });
  const placed = translatePositions(local.positions, 0, dy);
  assert.notEqual(dy, 0);
  pending.forEach(node => assert.equal(placed.get(node.id).x, parent.x + COLUMN_GAP));
  assert.equal(parent.x, 610);
  assert.equal(parent.y, 400);
  assertNoErrors(pending, placed, { checkParentColumns: false, checkSiblingCentering: false, occupied });
}

// Fixture F: detached roots keep their exact anchor while descendants extend right.
{
  const merge = makeNode('merge', null, { kind: 'merge_summary', height: 210 });
  const mergeChild = makeNode('merge-child', merge.id, { height: 180 });
  const mergeLayout = layoutTree([merge, mergeChild], { rootId: merge.id, rootX: 2330, rootCenterY: 740, ...options });
  assert.deepEqual(position(mergeLayout, merge.id), { x: 2330, y: 635, centerY: 740, depth: 0 });
  assert.equal(position(mergeLayout, mergeChild.id).x, 2330 + COLUMN_GAP);
  const annotation = makeNode('annotation', null, { kind: 'annotation', annotationManualPosition: true, height: 188, x: 990, y: 315 });
  const annotationChild = makeNode('annotation-child', annotation.id, { height: 172 });
  const annotationLayout = layoutTree([annotation, annotationChild], { rootId: annotation.id, rootX: annotation.x, rootCenterY: annotation.y + annotation.height / 2, ...options });
  assert.equal(position(annotationLayout, annotation.id).x, annotation.x);
  assert.equal(position(annotationLayout, annotation.id).y, annotation.y);
  assert.equal(position(annotationLayout, annotationChild.id).x, annotation.x + COLUMN_GAP);
}

console.log('PASS: deterministic contour layout, vertical decomposition, parent-relative branches, incremental vertical avoidance, merge and annotation anchors.');
