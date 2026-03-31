/**
 * Interface for Abstract Syntax Tree-based code parsers.
 * Replaces regex-based static analysis to improve deterministic import resolution
 * without compiling the project.
 */
export interface ASTParser {
  /**
   * Initializes the parser engine and loads required language parsers.
   * Can throw an error if the native bindings fail.
   */
  initialize(): Promise<void>;

  /**
   * Parses the file content and extracts the imported/required module paths.
   *
   * @param content Raw file string content
   * @param filePath Absolute path to the file
   * @returns List of internal dependencies (import paths)
   */
  parseImports(content: string, filePath: string): string[];
}
