import { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import * as d3 from 'd3';
import { useFilteredData } from '../hooks/useFilteredData';
import { useFilters } from '../contexts/FilterContext';

const TIER_SHAPES = { 'a-list': 'diamond', 'regional': 'circle', 'specialist': 'square', 'emerging': 'triangle' };
const TIER_COLORS = { 'a-list': '#f59e0b', 'regional': '#3b82f6', 'specialist': '#8b5cf6', 'emerging': '#94a3b8' };

function drawNodeShape(ctx, x, y, r, tier) {
  const shape = TIER_SHAPES[tier] || 'circle';
  ctx.beginPath();
  if (shape === 'diamond') {
    ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y);
  } else if (shape === 'square') {
    const h = r * 0.8; ctx.rect(x - h, y - h, h * 2, h * 2);
  } else if (shape === 'triangle') {
    ctx.moveTo(x, y - r); ctx.lineTo(x + r, y + r * 0.6); ctx.lineTo(x - r, y + r * 0.6);
  } else {
    ctx.arc(x, y, r, 0, Math.PI * 2);
  }
  ctx.closePath();
}

export default function NetworkTab() {
  const canvasRef = useRef(null);
  const simRef = useRef(null);
  const [tooltip, setTooltip] = useState(null);
  const [hoveredNode, setHoveredNode] = useState(null);
  const { filteredNetwork } = useFilteredData();
  const { filters } = useFilters();

  const { nodes, edges } = useMemo(() => {
    if (!filteredNetwork) return { nodes: [], edges: [] };
    return { nodes: filteredNetwork.nodes, edges: filteredNetwork.edges };
  }, [filteredNetwork]);

  // Size scale
  const sizeScale = useMemo(() => {
    if (nodes.length === 0) return () => 4;
    const maxFilms = d3.max(nodes, n => n.film_count) || 1;
    return d3.scaleSqrt().domain([1, maxFilms]).range([3, 18]);
  }, [nodes]);

  // Initialize simulation
  useEffect(() => {
    if (nodes.length === 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const width = canvas.parentElement.clientWidth;
    const height = Math.max(500, canvas.parentElement.clientHeight - 40);
    canvas.width = width * 2;
    canvas.height = height * 2;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';

    const ctx = canvas.getContext('2d');
    ctx.scale(2, 2);

    // Create simulation nodes/links copies
    const simNodes = nodes.map(n => ({ ...n }));
    const nodeMap = {};
    simNodes.forEach(n => { nodeMap[n.id] = n; });

    const simLinks = edges
      .filter(e => nodeMap[e.source] && nodeMap[e.target])
      .map(e => ({ source: nodeMap[e.source], target: nodeMap[e.target], weight: e.weight }));

    const sim = d3.forceSimulation(simNodes)
      .force('link', d3.forceLink(simLinks).id(d => d.id).distance(d => 60 / Math.sqrt(d.weight || 1)))
      .force('charge', d3.forceManyBody().strength(-40))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collide', d3.forceCollide(d => sizeScale(d.film_count) + 2))
      .alpha(0.8)
      .alphaDecay(0.02);

    simRef.current = { sim, simNodes, simLinks, width, height, ctx, nodeMap };

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Edges
      ctx.globalAlpha = 0.15;
      ctx.strokeStyle = '#94a3b8';
      simLinks.forEach(l => {
        ctx.lineWidth = Math.max(0.3, Math.min(2, l.weight / 5));
        ctx.beginPath();
        ctx.moveTo(l.source.x, l.source.y);
        ctx.lineTo(l.target.x, l.target.y);
        ctx.stroke();
      });

      // Highlighted edges for hovered node
      if (hoveredNode) {
        ctx.globalAlpha = 0.6;
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 1.5;
        simLinks.forEach(l => {
          if (l.source.id === hoveredNode || l.target.id === hoveredNode) {
            ctx.beginPath();
            ctx.moveTo(l.source.x, l.source.y);
            ctx.lineTo(l.target.x, l.target.y);
            ctx.stroke();
          }
        });
      }

      // Nodes
      ctx.globalAlpha = 1;
      simNodes.forEach(n => {
        const r = sizeScale(n.film_count);
        const color = n.id === hoveredNode ? '#1e40af' : (TIER_COLORS[n.tier] || '#94a3b8');
        ctx.fillStyle = color;
        drawNodeShape(ctx, n.x, n.y, r, n.tier);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.6)';
        ctx.lineWidth = 0.5;
        ctx.stroke();
      });

      // Labels for large nodes
      ctx.fillStyle = '#1e293b';
      ctx.font = '9px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      simNodes.forEach(n => {
        if (n.film_count > 20 || n.id === hoveredNode) {
          const r = sizeScale(n.film_count);
          const label = n.id.length > 25 ? n.id.substring(0, 22) + '...' : n.id;
          ctx.fillText(label, n.x, n.y + r + 10);
        }
      });
    };

    sim.on('tick', render);

    // Interaction
    const getNode = (mx, my) => {
      const rect = canvas.getBoundingClientRect();
      const x = mx - rect.left, y = my - rect.top;
      for (let i = simNodes.length - 1; i >= 0; i--) {
        const n = simNodes[i];
        const r = sizeScale(n.film_count) + 3;
        if (Math.hypot(n.x - x, n.y - y) < r) return n;
      }
      return null;
    };

    const handleMove = (e) => {
      const n = getNode(e.clientX, e.clientY);
      if (n) {
        setHoveredNode(n.id);
        const rect = canvas.getBoundingClientRect();
        setTooltip({
          x: e.clientX - rect.left + 12,
          y: e.clientY - rect.top - 10,
          node: n,
        });
      } else {
        setHoveredNode(null);
        setTooltip(null);
      }
    };

    canvas.addEventListener('mousemove', handleMove);

    // Drag
    let dragNode = null;
    canvas.addEventListener('mousedown', (e) => {
      const n = getNode(e.clientX, e.clientY);
      if (n) { dragNode = n; n.fx = n.x; n.fy = n.y; sim.alphaTarget(0.1).restart(); }
    });
    canvas.addEventListener('mousemove', (e) => {
      if (dragNode) {
        const rect = canvas.getBoundingClientRect();
        dragNode.fx = e.clientX - rect.left;
        dragNode.fy = e.clientY - rect.top;
      }
    });
    const handleUp = () => {
      if (dragNode) { dragNode.fx = null; dragNode.fy = null; dragNode = null; sim.alphaTarget(0); }
    };
    canvas.addEventListener('mouseup', handleUp);
    canvas.addEventListener('mouseleave', handleUp);

    return () => {
      sim.stop();
      canvas.removeEventListener('mousemove', handleMove);
    };
  }, [nodes, edges, sizeScale, hoveredNode]);

  if (!filteredNetwork || nodes.length === 0) {
    return <div className="tab-empty">No network data matches current filters.</div>;
  }

  return (
    <div className="network-tab">
      <div className="viz-toolbar">
        <span className="viz-info">{nodes.length} festivals, {edges.length} connections</span>
        <div className="viz-legend">
          {Object.entries(TIER_COLORS).map(([tier, color]) => (
            <span key={tier} className="legend-item">
              <span className="legend-dot" style={{ background: color }} />
              {tier}
            </span>
          ))}
        </div>
      </div>
      <div className="canvas-container">
        <canvas ref={canvasRef} />
        {tooltip && (
          <div className="canvas-tooltip" style={{ left: tooltip.x, top: tooltip.y }}>
            <div className="tt-title">{tooltip.node.id}</div>
            <div className="tt-row">Films: {tooltip.node.film_count} | Tier: {tooltip.node.tier}</div>
            <div className="tt-row">Degree: {tooltip.node.weighted_degree} | Community: {tooltip.node.community}</div>
            {tooltip.node.genre_circuit && <div className="tt-row">Circuit: {tooltip.node.genre_circuit}</div>}
          </div>
        )}
      </div>
    </div>
  );
}
