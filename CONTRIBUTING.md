# Contributing to Architect

Thank you for considering a contribution to Architect! This document provides guidelines and instructions for contributing.

## Code of Conduct

- Be respectful and inclusive
- Welcome people of all backgrounds and experience levels
- Focus on constructive feedback
- Assume good intent

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/yourusername/architect.git`
3. Install dependencies: `npm install`
4. Create a feature branch: `git checkout -b feature/your-feature-name`

## Development

### Build

```bash
npm run build
```

### Test

```bash
npm test
npm run test:watch
```

### Linting

```bash
npm run lint
```

## Commit Guidelines

- Use clear, descriptive commit messages
- Reference issues when applicable: "Fixes #123"
- Keep commits focused on a single change
- Use present tense: "Add feature" not "Added feature"

## Pull Request Process

1. Update documentation for any new features
2. Add or update tests for your changes
3. Ensure all tests pass: `npm test`
4. Ensure linting passes: `npm run lint`
5. Write a clear PR description:
   - What problem does this solve?
   - How does it solve the problem?
   - Are there any breaking changes?

## Architecture Guidelines

The codebase follows a modular architecture with clear separation of concerns:

- **Scanner**: Project discovery and analysis
- **Analyzer**: Dependency and layer analysis
- **Anti-Pattern Detector**: Code quality issues
- **Scorer**: Quantitative evaluation
- **Diagram Generator**: Visualization
- **Reporter**: Output formatting

Maintain these boundaries when adding new features.

## Adding New Anti-Patterns

To add a new anti-pattern detector:

1. Add detection logic to `src/anti-patterns.ts`
2. Add unit tests in `tests/anti-patterns.test.ts`
3. Update README.md with the new pattern
4. Update sample report if needed

Example:

```typescript
private detectNewPattern(node: FileNode): AntiPattern[] {
  const patterns: AntiPattern[] = [];
  // Detection logic
  return patterns;
}
```

## Reporting Bugs

Use GitHub Issues with:

- Clear title describing the bug
- Steps to reproduce
- Expected vs actual behavior
- TypeScript/Node version
- Operating system

## Feature Requests

Describe:

- Problem statement (what is missing?)
- Proposed solution
- Alternative solutions considered
- Examples or use cases

## Documentation

- Update README.md for user-facing changes
- Add JSDoc comments to new functions
- Include examples for new features
- Keep comments current with code changes

## Areas for Contribution

- New anti-pattern detectors
- Improved dependency graph analysis
- Additional diagram types
- Better framework detection
- Performance optimizations
- Test coverage expansion
- Documentation improvements
- Example projects

## Questions?

- Open a GitHub Discussion
- Check existing issues
- Read the documentation
- Contact the maintainers

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for helping make Architect better!
