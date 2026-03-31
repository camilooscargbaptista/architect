import { join } from 'path';
import { existsSync } from 'fs';
import { FrameworkInfo } from '@girardelli/architect-agents/src/core/agent-generator/types/stack.js';
import { BaseDetector } from './base-detector.js';
import { FRAMEWORK_MAP } from './framework-registry.js';

export class JavaDetector extends BaseDetector {
public detect(projectPath: string, out: FrameworkInfo[]): void {
    // pom.xml
    const pomPath = join(projectPath, 'pom.xml');
    if (existsSync(pomPath)) {
      const content = this.safeReadFile(pomPath);
      const deps = content.match(/<artifactId>([^<]+)<\/artifactId>/gi) || [];
      for (const dep of deps) {
        const match = dep.match(/<artifactId>([^<]+)<\/artifactId>/i);
        if (match) {
          const artifact = match[1].toLowerCase();
          const fwInfo = FRAMEWORK_MAP[artifact];
          if (fwInfo) {
            out.push({ name: fwInfo.name, version: null, category: fwInfo.category, confidence: 0.85 });
          }
        }
      }
    }

    // build.gradle / build.gradle.kts
    for (const gradleFile of ['build.gradle', 'build.gradle.kts']) {
      const gradlePath = join(projectPath, gradleFile);
      if (existsSync(gradlePath)) {
        const content = this.safeReadFile(gradlePath);
        if (content.includes('spring-boot')) {
          out.push({ name: 'Spring Boot', version: null, category: 'web', confidence: 0.9 });
        }
        if (content.includes('quarkus')) {
          out.push({ name: 'Quarkus', version: null, category: 'web', confidence: 0.9 });
        }
        if (content.includes('micronaut')) {
          out.push({ name: 'Micronaut', version: null, category: 'web', confidence: 0.9 });
        }
        if (content.includes('ktor')) {
          out.push({ name: 'Ktor', version: null, category: 'web', confidence: 0.9 });
        }
      }
    }
  }
}
