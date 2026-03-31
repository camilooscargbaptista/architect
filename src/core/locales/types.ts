export interface TranslationDictionary {
  // Common
  common: {
    generatedBy: string;
    mandatory: string;
    yes: string;
    no: string;
    action: string;
  };
  
  // Scanners / Progress
  progress: {
    scan: string;
    dependencies: string;
    layers: string;
    antipatterns: string;
    scoring: string;
    normalize: string;
    summarize: string;
    
    // Verbs
    scanningSystem: string;
    mappingGraph: string;
    classifyingArch: string;
    detectingAntiPatterns: string;
    computingMetrics: string;
    normalizingPaths: string;
    generatingSummary: string;
  };

  // Agents
  agents: {
    backend: {
      description: string;
      title: string;
      specialistIn: string;
      stack: string;
      principles: string;
      projectStructure: string;
      implementationRules: string;
      rulesBody: string;
      afterImplementation: string;
      afterBody: string;
    };
    frontend: {
      description: string;
      title: string;
      specialistIn: string;
      stack: string;
      prerequisites: string;
      prerequisitesBody: string;
      implementationRules: string;
      rulesBody: string;
    };
    security: {
      description: string;
      title: string;
      analysisFor: string;
      checklist: string;
      checklistBody: string;
      whenToActivate: string;
      whenBody: string;
      expectedOutput: string;
      outputBody: string;
    };
    qa: {
      description: string;
      title: string;
      qualityFor: string;
      nonNegotiable: string;
      nonNegotiableBody: (min: number) => string;
      pyramid: string;
      process: string;
      processBody: string;
    };
    techDebt: {
      description: string;
      title: string;
      controlFor: string;
      currentState: string;
      roadmap: string;
      targets: string;
      rules: string;
    };
  };

  // Domain & Enriched
  enriched: {
    modules: string;
    endpoints: string;
    domainContext: string;
    untestedModules: string;
    untestedModulesBody: (count: number) => string;
  };
}
