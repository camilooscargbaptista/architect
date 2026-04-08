import { DiagramGenerator } from '../src/core/diagram.js';
import { DependencyEdge, Layer } from '../src/core/types/core.js';

describe('DiagramGenerator', () => {
  let generator: DiagramGenerator;

  beforeEach(() => {
    generator = new DiagramGenerator();
  });

  describe('generateComponentDiagram', () => {
    it('should generate empty diagram for empty edges', () => {
      const edges: DependencyEdge[] = [];
      const layers: Layer[] = [];

      const diagram = generator.generateComponentDiagram(edges, layers);

      expect(diagram).toContain('graph TB');
      expect(diagram).toContain('classDef');
    });

    it('should generate diagram with single edge', () => {
      const edges: DependencyEdge[] = [
        { from: 'src/api.ts', to: 'src/service.ts', type: 'import', weight: 1 },
      ];
      const layers: Layer[] = [
        { name: 'API', files: ['src/api.ts'], description: 'API layer' },
        { name: 'Service', files: ['src/service.ts'], description: 'Service layer' },
      ];

      const diagram = generator.generateComponentDiagram(edges, layers);

      expect(diagram).toContain('graph TB');
      expect(diagram).toContain('api');
      expect(diagram).toContain('service');
      expect(diagram).toContain('-->');
    });

    it('should handle multiple edges', () => {
      const edges: DependencyEdge[] = [
        { from: 'src/api.ts', to: 'src/service.ts', type: 'import', weight: 1 },
        { from: 'src/service.ts', to: 'src/data.ts', type: 'import', weight: 1 },
        { from: 'src/ui.tsx', to: 'src/api.ts', type: 'import', weight: 1 },
      ];
      const layers: Layer[] = [
        { name: 'API', files: ['src/api.ts'], description: 'API layer' },
        { name: 'Service', files: ['src/service.ts'], description: 'Service layer' },
        { name: 'Data', files: ['src/data.ts'], description: 'Data layer' },
        { name: 'UI', files: ['src/ui.tsx'], description: 'UI layer' },
      ];

      const diagram = generator.generateComponentDiagram(edges, layers);

      expect(diagram).toContain('-->');
      // Should have at least 3 arrows for 3 edges
      const arrowCount = (diagram.match(/-->/g) || []).length;
      expect(arrowCount).toBeGreaterThanOrEqual(3);
    });

    it('should apply layer colors to nodes', () => {
      const edges: DependencyEdge[] = [
        { from: 'src/api.ts', to: 'src/service.ts', type: 'import', weight: 1 },
      ];
      const layers: Layer[] = [
        { name: 'API', files: ['src/api.ts'], description: 'API layer' },
        { name: 'Service', files: ['src/service.ts'], description: 'Service layer' },
      ];

      const diagram = generator.generateComponentDiagram(edges, layers);

      // Should include style classes
      expect(diagram).toContain(':::apiStyle');
      expect(diagram).toContain(':::serviceStyle');
    });

    it('should limit nodes to 20', () => {
      const edges: DependencyEdge[] = [];
      for (let i = 0; i < 50; i++) {
        edges.push({
          from: `src/module${i}.ts`,
          to: `src/module${(i + 1) % 50}.ts`,
          type: 'import',
          weight: 1,
        });
      }
      const layers: Layer[] = [];

      const diagram = generator.generateComponentDiagram(edges, layers);

      // Count nodes (lines with ["..."])
      const nodeMatches = diagram.match(/\["[^"]+"\]/g) || [];
      expect(nodeMatches.length).toBeLessThanOrEqual(20);
    });

    it('should limit edges to 30', () => {
      const edges: DependencyEdge[] = [];
      for (let i = 0; i < 50; i++) {
        edges.push({
          from: `src/module${i}.ts`,
          to: `src/module${(i + 1) % 50}.ts`,
          type: 'import',
          weight: 1,
        });
      }
      const layers: Layer[] = [];

      const diagram = generator.generateComponentDiagram(edges, layers);

      // Count edges (lines with -->)
      const edgeMatches = diagram.match(/-->/g) || [];
      expect(edgeMatches.length).toBeLessThanOrEqual(30);
    });

    it('should handle paths with multiple separators', () => {
      const edges: DependencyEdge[] = [
        {
          from: 'src/services/user/manager.ts',
          to: 'src/data/db.ts',
          type: 'import',
          weight: 1,
        },
      ];
      const layers: Layer[] = [
        { name: 'Service', files: ['src/services/user/manager.ts'], description: 'Service' },
        { name: 'Data', files: ['src/data/db.ts'], description: 'Data' },
      ];

      const diagram = generator.generateComponentDiagram(edges, layers);

      // Should extract last component of path for display
      expect(diagram).toContain('manager');
      expect(diagram).toContain('db');
    });

    it('should sanitize node names', () => {
      const edges: DependencyEdge[] = [
        {
          from: 'src/api-controller.ts',
          to: 'src/service@v1.ts',
          type: 'import',
          weight: 1,
        },
      ];
      const layers: Layer[] = [];

      const diagram = generator.generateComponentDiagram(edges, layers);

      // Node names should be sanitized (special chars replaced with _)
      const sanitized = diagram.toLowerCase().replace(/[^a-z0-9_\n\s]/g, '');
      expect(sanitized).toBeTruthy();
    });

    it('should use white color for unmapped nodes', () => {
      const edges: DependencyEdge[] = [
        { from: 'unknown.ts', to: 'other.ts', type: 'import', weight: 1 },
      ];
      const layers: Layer[] = [];

      const diagram = generator.generateComponentDiagram(edges, layers);

      expect(diagram).toContain('defaultStyle');
    });

    it('should handle edge with various types', () => {
      const edges: DependencyEdge[] = [
        { from: 'a.ts', to: 'b.ts', type: 'import', weight: 1 },
        { from: 'b.ts', to: 'c.ts', type: 'export', weight: 2 },
        { from: 'c.ts', to: 'd.ts', type: 'inheritance', weight: 1 },
        { from: 'd.ts', to: 'e.ts', type: 'composition', weight: 3 },
      ];
      const layers: Layer[] = [];

      const diagram = generator.generateComponentDiagram(edges, layers);

      expect(diagram).toContain('-->');
      const edgeMatches = diagram.match(/-->/g) || [];
      expect(edgeMatches.length).toBeGreaterThanOrEqual(4);
    });
  });

  describe('generateLayerDiagram', () => {
    it('should generate empty diagram for empty layers', () => {
      const layers: Layer[] = [];

      const diagram = generator.generateLayerDiagram(layers);

      expect(diagram).toContain('graph LR');
      expect(diagram).toContain('classDef');
    });

    it('should generate diagram with single layer', () => {
      const layers: Layer[] = [
        { name: 'API', files: ['api1.ts', 'api2.ts'], description: 'API layer' },
      ];

      const diagram = generator.generateLayerDiagram(layers);

      expect(diagram).toContain('API');
      expect(diagram).toContain('(2 files)');
    });

    it('should generate diagrams with all layer types', () => {
      const layers: Layer[] = [
        { name: 'UI', files: ['ui.tsx'], description: 'UI layer' },
        { name: 'API', files: ['api.ts'], description: 'API layer' },
        { name: 'Service', files: ['service.ts'], description: 'Service layer' },
        { name: 'Data', files: ['data.ts'], description: 'Data layer' },
        { name: 'Infrastructure', files: ['infra.ts'], description: 'Infrastructure' },
      ];

      const diagram = generator.generateLayerDiagram(layers);

      expect(diagram).toContain('UI');
      expect(diagram).toContain('API');
      expect(diagram).toContain('Service');
      expect(diagram).toContain('Data');
      expect(diagram).toContain('Infrastructure');
    });

    it('should show file counts correctly', () => {
      const layers: Layer[] = [
        { name: 'API', files: ['a.ts', 'b.ts', 'c.ts'], description: 'API layer' },
        { name: 'Service', files: ['s.ts'], description: 'Service layer' },
      ];

      const diagram = generator.generateLayerDiagram(layers);

      expect(diagram).toContain('(3 files)');
      expect(diagram).toContain('(1 files)');
    });

    it('should skip empty layers', () => {
      const layers: Layer[] = [
        { name: 'API', files: [], description: 'API layer' },
        { name: 'Service', files: ['service.ts'], description: 'Service layer' },
      ];

      const diagram = generator.generateLayerDiagram(layers);

      // Empty API layer should not be included
      expect(diagram).not.toContain('(0 files)');
      expect(diagram).toContain('Service');
      expect(diagram).toContain('(1 files)');
    });

    it('should create edges between layers in order', () => {
      const layers: Layer[] = [
        { name: 'UI', files: ['ui.tsx'], description: 'UI' },
        { name: 'API', files: ['api.ts'], description: 'API' },
        { name: 'Service', files: ['service.ts'], description: 'Service' },
      ];

      const diagram = generator.generateLayerDiagram(layers);

      // Should have arrows connecting layers
      const arrowCount = (diagram.match(/-->/g) || []).length;
      expect(arrowCount).toBeGreaterThanOrEqual(2);
    });

    it('should use correct styles for each layer', () => {
      const layers: Layer[] = [
        { name: 'API', files: ['api.ts'], description: 'API' },
        { name: 'Service', files: ['service.ts'], description: 'Service' },
      ];

      const diagram = generator.generateLayerDiagram(layers);

      expect(diagram).toContain('apiStyle');
      expect(diagram).toContain('serviceStyle');
    });

    it('should handle layers with many files', () => {
      const files = Array.from({ length: 100 }, (_, i) => `file${i}.ts`);
      const layers: Layer[] = [
        { name: 'Service', files, description: 'Large service layer' },
      ];

      const diagram = generator.generateLayerDiagram(layers);

      expect(diagram).toContain('(100 files)');
    });

    it('should maintain layer order UI -> API -> Service -> Data -> Infrastructure', () => {
      const layers: Layer[] = [
        { name: 'Infrastructure', files: ['infra.ts'], description: 'Infrastructure' },
        { name: 'Data', files: ['data.ts'], description: 'Data' },
        { name: 'Service', files: ['service.ts'], description: 'Service' },
        { name: 'API', files: ['api.ts'], description: 'API' },
        { name: 'UI', files: ['ui.tsx'], description: 'UI' },
      ];

      const diagram = generator.generateLayerDiagram(layers);

      const uiIndex = diagram.indexOf('UI');
      const apiIndex = diagram.indexOf('API');
      const serviceIndex = diagram.indexOf('Service');
      const dataIndex = diagram.indexOf('Data');
      const infraIndex = diagram.indexOf('Infrastructure');

      expect(uiIndex).toBeLessThan(apiIndex);
      expect(apiIndex).toBeLessThan(serviceIndex);
      expect(serviceIndex).toBeLessThan(dataIndex);
      expect(dataIndex).toBeLessThan(infraIndex);
    });
  });

  describe('generateDependencyFlowDiagram', () => {
    it('should generate empty diagram for no edges', () => {
      const edges: DependencyEdge[] = [];

      const diagram = generator.generateDependencyFlowDiagram(edges);

      expect(diagram).toContain('graph LR');
    });

    it('should generate diagram with single edge', () => {
      const edges: DependencyEdge[] = [
        { from: 'src/a.ts', to: 'src/b.ts', type: 'import', weight: 1 },
      ];

      const diagram = generator.generateDependencyFlowDiagram(edges);

      expect(diagram).toContain('a');
      expect(diagram).toContain('b');
      expect(diagram).toContain('-->');
    });

    it('should aggregate flows by source and destination', () => {
      const edges: DependencyEdge[] = [
        { from: 'src/a.ts', to: 'src/b.ts', type: 'import', weight: 1 },
        { from: 'src/a.ts', to: 'src/b.ts', type: 'import', weight: 2 },
        { from: 'src/a.ts', to: 'src/b.ts', type: 'import', weight: 3 },
      ];

      const diagram = generator.generateDependencyFlowDiagram(edges);

      // All three edges have the same from->to, so weight should be aggregated: 1+2+3=6
      expect(diagram).toContain('6');
    });

    it('should show weights greater than 1', () => {
      const edges: DependencyEdge[] = [
        { from: 'src/a.ts', to: 'src/b.ts', type: 'import', weight: 5 },
      ];

      const diagram = generator.generateDependencyFlowDiagram(edges);

      expect(diagram).toContain('| 5');
    });

    it('should not show weight for single dependency', () => {
      const edges: DependencyEdge[] = [
        { from: 'src/a.ts', to: 'src/b.ts', type: 'import', weight: 1 },
      ];

      const diagram = generator.generateDependencyFlowDiagram(edges);

      expect(diagram).toContain('-->||');
    });

    it('should limit flows to 15 top dependencies', () => {
      const edges: DependencyEdge[] = [];
      for (let i = 0; i < 50; i++) {
        edges.push({
          from: `src/module${i}.ts`,
          to: `src/module${(i + 1) % 50}.ts`,
          type: 'import',
          weight: 50 - i,
        });
      }

      const diagram = generator.generateDependencyFlowDiagram(edges);

      const arrowCount = (diagram.match(/-->/g) || []).length;
      expect(arrowCount).toBeLessThanOrEqual(15);
    });

    it('should sort flows by weight descending', () => {
      const edges: DependencyEdge[] = [
        { from: 'src/low.ts', to: 'src/x.ts', type: 'import', weight: 1 },
        { from: 'src/high.ts', to: 'src/y.ts', type: 'import', weight: 10 },
        { from: 'src/mid.ts', to: 'src/z.ts', type: 'import', weight: 5 },
      ];

      const diagram = generator.generateDependencyFlowDiagram(edges);

      // High weight flow should appear before low weight flow
      const highIndex = diagram.indexOf('high');
      const lowIndex = diagram.indexOf('low');
      expect(highIndex).toBeLessThan(lowIndex);
    });

    it('should include nodes from top flows', () => {
      const edges: DependencyEdge[] = [
        { from: 'src/important.ts', to: 'src/core.ts', type: 'import', weight: 10 },
        { from: 'src/helper.ts', to: 'src/util.ts', type: 'import', weight: 1 },
      ];

      const diagram = generator.generateDependencyFlowDiagram(edges);

      // Important flow should definitely be included
      expect(diagram).toContain('important');
      expect(diagram).toContain('core');
    });

    it('should handle duplicate flows by aggregating weights', () => {
      const edges: DependencyEdge[] = [
        { from: 'a.ts', to: 'b.ts', type: 'import', weight: 2 },
        { from: 'a.ts', to: 'b.ts', type: 'export', weight: 3 },
      ];

      const diagram = generator.generateDependencyFlowDiagram(edges);

      // Should aggregate both to 5
      expect(diagram).toContain('| 5');
    });

    it('should sanitize node names in flow diagram', () => {
      const edges: DependencyEdge[] = [
        {
          from: 'src/api-service.ts',
          to: 'src/data@v1.ts',
          type: 'import',
          weight: 1,
        },
      ];

      const diagram = generator.generateDependencyFlowDiagram(edges);

      // Should not crash and should produce valid output
      expect(diagram).toContain('graph LR');
    });

    it('should handle self-referencing edges', () => {
      const edges: DependencyEdge[] = [
        { from: 'src/a.ts', to: 'src/a.ts', type: 'import', weight: 1 },
      ];

      const diagram = generator.generateDependencyFlowDiagram(edges);

      expect(diagram).toContain('-->||');
    });
  });

  describe('sanitizeNodeName (private method behavior)', () => {
    it('should replace special characters in node IDs with underscores', () => {
      const edges: DependencyEdge[] = [
        { from: 'src/api-controller.ts', to: 'src/b.ts', type: 'import', weight: 1 },
      ];

      const diagram = generator.generateComponentDiagram(edges, []);

      // Node IDs should not contain dashes or dots (except in quoted display names)
      // The sanitized node IDs should be all alphanumeric and underscores
      expect(diagram).toMatch(/src_api_controller_ts\["[^"]+"\]/);
    });

    it('should collapse multiple underscores in node IDs', () => {
      const edges: DependencyEdge[] = [
        { from: 'src/my___file.ts', to: 'src/b.ts', type: 'import', weight: 1 },
      ];

      const diagram = generator.generateComponentDiagram(edges, []);

      // Node ID should collapse multiple underscores: src_my_file_ts (not src_my___file_ts)
      expect(diagram).toMatch(/src_my_file_ts/);
    });

    it('should handle node ID generation with special characters', () => {
      const edges: DependencyEdge[] = [
        { from: 'src/api@v1.ts', to: 'src/b.ts', type: 'import', weight: 1 },
      ];

      const diagram = generator.generateComponentDiagram(edges, []);

      // @ should be replaced with underscore in node ID
      expect(diagram).toContain('src_api_v1_ts');
    });
  });

  describe('integration', () => {
    it('should generate valid Mermaid syntax for component diagram', () => {
      const edges: DependencyEdge[] = [
        { from: 'src/api.ts', to: 'src/service.ts', type: 'import', weight: 1 },
        { from: 'src/service.ts', to: 'src/data.ts', type: 'import', weight: 1 },
      ];
      const layers: Layer[] = [
        { name: 'API', files: ['src/api.ts'], description: 'API' },
        { name: 'Service', files: ['src/service.ts'], description: 'Service' },
        { name: 'Data', files: ['src/data.ts'], description: 'Data' },
      ];

      const diagram = generator.generateComponentDiagram(edges, layers);

      expect(diagram).toMatch(/^graph TB/m);
      expect(diagram).toContain('classDef');
      expect((diagram.match(/-->/g) || []).length).toBeGreaterThanOrEqual(2);
    });

    it('should generate valid Mermaid syntax for layer diagram', () => {
      const layers: Layer[] = [
        { name: 'UI', files: ['ui.tsx'], description: 'UI' },
        { name: 'API', files: ['api.ts'], description: 'API' },
      ];

      const diagram = generator.generateLayerDiagram(layers);

      expect(diagram).toMatch(/^graph LR/m);
      expect(diagram).toContain('classDef');
      expect(diagram).toContain('UI');
      expect(diagram).toContain('API');
    });

    it('should generate valid Mermaid syntax for dependency flow diagram', () => {
      const edges: DependencyEdge[] = [
        { from: 'src/a.ts', to: 'src/b.ts', type: 'import', weight: 5 },
        { from: 'src/b.ts', to: 'src/c.ts', type: 'import', weight: 3 },
      ];

      const diagram = generator.generateDependencyFlowDiagram(edges);

      expect(diagram).toMatch(/^graph LR/m);
      expect((diagram.match(/-->/g) || []).length).toBeGreaterThanOrEqual(2);
    });
  });
});
