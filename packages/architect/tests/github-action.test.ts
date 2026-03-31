import { jest } from '@jest/globals';
import { AnalysisReport } from '@girardelli/architect-core/src/core/types/core.js';
import { ValidationResult } from '@girardelli/architect-core/src/core/types/architect-rules.js';

// Mock dependencies
jest.unstable_mockModule('@actions/core', () => ({
  info: jest.fn(),
  error: jest.fn(),
}));

  // @ts-ignore
  const createCommentMock = jest.fn().mockResolvedValue({});
  jest.unstable_mockModule('@actions/github', () => ({
    context: {
      repo: { owner: 'test', repo: 'test-repo' },
      payload: {
        pull_request: {
          number: 42,
          base: { ref: 'main' }
        }
      }
    },
    getOctokit: jest.fn().mockReturnValue({
      rest: {
        issues: {
          createComment: createCommentMock
        }
      }
    })
  }));

describe('GithubActionAdapter', () => {
  let adapter: any;
  let mockHeadReport: AnalysisReport;
  let mockBaseReport: AnalysisReport;
  let mockValidation: ValidationResult;

  beforeAll(async () => {
    const { GithubActionAdapter } = await import('../src/adapters/github-action.js');
    adapter = new GithubActionAdapter('fake-token');
  });

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockHeadReport = {
      timestamp: new Date().toISOString(),
      projectInfo: { path: '.', name: 'Test', frameworks: [], primaryLanguages: [], totalFiles: 10, totalLines: 100 },
      score: {
        overall: 80,
        components: [],
        breakdown: { modularity: 80, coupling: 80, cohesion: 80, layering: 80 },
      },
      antiPatterns: [
        { name: 'God Class', severity: 'HIGH', location: 'file.ts', description: 'desc', suggestion: 'sugg' }
      ],
      layers: [],
      dependencyGraph: { nodes: [], edges: [] },
      suggestions: [],
      diagram: { mermaid: '', type: 'component' }
    };

    mockBaseReport = JSON.parse(JSON.stringify(mockHeadReport));
    mockBaseReport.score.overall = 85;

    mockValidation = {
      success: false,
      violations: [
        { level: 'error', rule: 'min_overall_score', message: 'Score too low', actual: 80, expected: 90 }
      ]
    };
  });

  it('should post comment with positive delta', async () => {
    mockBaseReport.score.overall = 75; // improved by 5
    await adapter.postComment(mockHeadReport, mockBaseReport);
    
    expect(createCommentMock).toHaveBeenCalledWith(expect.objectContaining({
      issue_number: 42,
      body: expect.stringContaining('📈 **+5** (Improved from 75)')
    }));
  });

  it('should post comment with negative delta', async () => {
    mockBaseReport.score.overall = 85; // dropped by 5
    await adapter.postComment(mockHeadReport, mockBaseReport);
    
    expect(createCommentMock).toHaveBeenCalledWith(expect.objectContaining({
      issue_number: 42,
      body: expect.stringContaining('📉 **-5** (Regressed from 85)')
    }));
  });

  it('should output validation errors in the comment', async () => {
    await adapter.postComment(mockHeadReport, mockBaseReport, mockValidation);
    
    const callArgs = createCommentMock.mock.calls[0][0] as any;
    expect(callArgs.body).toContain('❌ **Quality Gates Failed!**');
    expect(callArgs.body).toContain('`min_overall_score`');
  });

  it('should list anti-patterns in the report', async () => {
    await adapter.postComment(mockHeadReport, null);
    
    const callArgs = createCommentMock.mock.calls[0][0] as any;
    expect(callArgs.body).toContain('### ⚠️ Anti-Patterns Detected');
    expect(callArgs.body).toContain('God Class');
  });
});
