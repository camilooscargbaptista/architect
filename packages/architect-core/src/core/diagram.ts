import { DependencyEdge, Layer } from './types/core.js';

const LAYER_THEME: Record<string, { color: string; style: string }> = {
  API: { color: '#FFB6C1', style: 'apiStyle' },
  Service: { color: '#87CEEB', style: 'serviceStyle' },
  Data: { color: '#90EE90', style: 'dataStyle' },
  UI: { color: '#FFD700', style: 'uiStyle' },
  Infrastructure: { color: '#D3D3D3', style: 'infraStyle' },
};

export class DiagramGenerator {
  generateComponentDiagram(
    edges: DependencyEdge[],
    layers: Layer[]
  ): string {
    const nodes = new Set<string>();
    edges.forEach((e) => {
      nodes.add(e.from);
      nodes.add(e.to);
    });

    const nodeColors: Record<string, string> = {};
    for (const layer of layers) {
      for (const file of layer.files) {
        const moduleName = file.split('/').pop() || file;
        nodeColors[moduleName] = LAYER_THEME[layer.name]?.color || '#FFFFFF';
      }
    }

    let mermaid = 'graph TB\n';

    for (const node of Array.from(nodes).slice(0, 20)) {
      const moduleName = node.split('/').pop() || node;
      const color = nodeColors[moduleName] || '#FFFFFF';
      mermaid += `  ${this.sanitizeNodeName(node)}["${moduleName}"]:::${this.getStyleClass(color)}\n`;
    }

    mermaid += '\n';

    for (const edge of edges.slice(0, 30)) {
      mermaid += `  ${this.sanitizeNodeName(edge.from)} --> ${this.sanitizeNodeName(edge.to)}\n`;
    }

    return this.appendCommonClassDefs(mermaid);
  }

  generateLayerDiagram(layers: Layer[]): string {
    let mermaid = 'graph LR\n';

    const layerOrder = ['UI', 'API', 'Service', 'Data', 'Infrastructure'];

    for (const layerName of layerOrder) {
      const layer = layers.find((l) => l.name === layerName);
      if (layer && layer.files.length > 0) {
        const nodeId = layerName.replace(/\s+/g, '_');
        const fileCount = layer.files.length;
        const style = LAYER_THEME[layerName]?.style || 'defaultStyle';
        mermaid += `  ${nodeId}["${layerName}<br/>(${fileCount} files)"]:::${style}\n`;
      }
    }

    for (let i = 0; i < layerOrder.length - 1; i++) {
      const from = layerOrder[i].replace(/\s+/g, '_');
      const to = layerOrder[i + 1].replace(/\s+/g, '_');
      mermaid += `  ${from} --> ${to}\n`;
    }

    return this.appendCommonClassDefs(mermaid);
  }

  generateDependencyFlowDiagram(edges: DependencyEdge[]): string {
    const flowMap: Record<string, number> = {};

    for (const edge of edges) {
      const flowKey = `${edge.from} -> ${edge.to}`;
      flowMap[flowKey] = (flowMap[flowKey] || 0) + edge.weight;
    }

    const topFlows = Object.entries(flowMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15);

    let mermaid = 'graph LR\n';

    const nodes = new Set<string>();
    for (const [flow] of topFlows) {
      const [from, _, to] = flow.split(' ');
      nodes.add(from);
      nodes.add(to);
    }

    for (const node of nodes) {
      const moduleName = node.split('/').pop() || node;
      mermaid += `  ${this.sanitizeNodeName(node)}["${moduleName}"]\n`;
    }

    mermaid += '\n';

    for (const [flow, weight] of topFlows) {
      const [from, _, to] = flow.split(' ');
      const label = weight > 1 ? ` | ${weight}` : '';
      mermaid += `  ${this.sanitizeNodeName(from)} -->|${label}| ${this.sanitizeNodeName(to)}\n`;
    }

    return mermaid; // specific diagram that doesn't use standard classDefs
  }

  private sanitizeNodeName(path: string): string {
    return path
      .replace(/[^a-zA-Z0-9]/g, '_')
      .replace(/_+/g, '_')
      .toLowerCase();
  }

  private getStyleClass(color: string): string {
    const match = Object.values(LAYER_THEME).find(t => t.color === color);
    return match ? match.style : 'defaultStyle';
  }

  private appendCommonClassDefs(mermaid: string): string {
    let result = mermaid + '\n';
    result += '  classDef apiStyle fill:#FFB6C1,stroke:#333,color:#000\n';
    result += '  classDef serviceStyle fill:#87CEEB,stroke:#333,color:#000\n';
    result += '  classDef dataStyle fill:#90EE90,stroke:#333,color:#000\n';
    result += '  classDef uiStyle fill:#FFD700,stroke:#333,color:#000\n';
    result += '  classDef infraStyle fill:#D3D3D3,stroke:#333,color:#000\n';
    return result;
  }
}
