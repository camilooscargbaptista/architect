import { existsSync } from 'fs';
import { join } from 'path';
import { AnalysisReport } from '@girardelli/architect-core/src/core/types/core.js';
import { FrameworkInfo, DetectedToolchain } from '@girardelli/architect-agents/src/core/agent-generator/types/stack.js';

export class ToolchainDetector {
public detectToolchain(
    projectPath: string,
    report: AnalysisReport,
    primaryFw: FrameworkInfo | null,
    allFrameworks: FrameworkInfo[],
  ): DetectedToolchain {
    const lang = report.projectInfo.primaryLanguages[0] || 'Unknown';
    const hasMakefile = existsSync(join(projectPath, 'Makefile'));
    // @ts-ignore - Audit cleanup unused variable
    const hasDockerCompose = existsSync(join(projectPath, 'docker-compose.yml')) || existsSync(join(projectPath, 'docker-compose.yaml'));

    const hasTest = (name: string) => allFrameworks.some(f => f.name === name);
    const hasLint = (name: string) => allFrameworks.some(f => f.name === name && f.category === 'lint');

    // Python
    if (lang === 'Python') {
      const fwName = primaryFw?.name || 'Python';
      const hasPytest = hasTest('pytest');
      const hasRuff = hasLint('Ruff');
      const hasPoetry = existsSync(join(projectPath, 'poetry.lock'));
      const hasPipenv = existsSync(join(projectPath, 'Pipfile.lock'));

      let runCmd = 'python -m main';
      if (fwName === 'FastAPI') runCmd = 'uvicorn app.main:app --reload';
      else if (fwName === 'Django') runCmd = 'python manage.py runserver';
      else if (fwName === 'Flask') runCmd = 'flask run --debug';

      let installCmd = 'pip install -r requirements.txt';
      if (hasPoetry) installCmd = 'poetry install';
      else if (hasPipenv) installCmd = 'pipenv install';

      return {
        buildCmd: hasMakefile ? 'make build' : (fwName === 'Django' ? 'python manage.py check' : 'python -m py_compile main.py'),
        testCmd: hasPytest ? 'pytest' : 'python -m unittest discover',
        lintCmd: hasRuff ? 'ruff check .' : (hasLint('Flake8') ? 'flake8 .' : (hasLint('Pylint') ? 'pylint src/' : 'ruff check .')),
        runCmd,
        coverageCmd: hasPytest ? 'pytest --cov' : 'coverage run -m pytest',
        installCmd,
        migrateCmd: fwName === 'Django' ? 'python manage.py migrate' : (fwName === 'FastAPI' ? 'alembic upgrade head' : null),
        depsFile: hasPoetry ? 'pyproject.toml' : (hasPipenv ? 'Pipfile' : 'requirements.txt'),
      };
    }

    // TypeScript / JavaScript
    if (lang === 'TypeScript' || lang === 'JavaScript') {
      const hasYarn = existsSync(join(projectPath, 'yarn.lock'));
      const hasPnpm = existsSync(join(projectPath, 'pnpm-lock.yaml'));
      const pm = hasPnpm ? 'pnpm' : (hasYarn ? 'yarn' : 'npm');

      return {
        buildCmd: `${pm} run build`,
        testCmd: hasTest('Vitest') ? `${pm} run test` : (hasTest('Jest') ? `${pm} test` : `${pm} test`),
        lintCmd: hasLint('Biome') ? `${pm} run lint` : (hasLint('ESLint') ? `${pm} run lint` : 'npx eslint .'),
        runCmd: `${pm} run dev`,
        coverageCmd: `${pm} run test -- --coverage`,
        installCmd: `${pm} install`,
        migrateCmd: primaryFw?.name === 'NestJS' ? 'npx typeorm migration:run' : null,
        depsFile: 'package.json',
      };
    }

    // Java / Kotlin
    if (lang === 'Java' || lang === 'Kotlin') {
      const hasMaven = existsSync(join(projectPath, 'pom.xml'));
      const hasGradle = existsSync(join(projectPath, 'build.gradle')) || existsSync(join(projectPath, 'build.gradle.kts'));

      if (hasMaven) {
        return {
          buildCmd: 'mvn clean package',
          testCmd: 'mvn test',
          lintCmd: 'mvn checkstyle:check',
          runCmd: 'mvn spring-boot:run',
          coverageCmd: 'mvn jacoco:report',
          installCmd: 'mvn install',
          migrateCmd: 'mvn flyway:migrate',
          depsFile: 'pom.xml',
        };
      }
      if (hasGradle) {
        return {
          buildCmd: './gradlew build',
          testCmd: './gradlew test',
          lintCmd: './gradlew check',
          runCmd: './gradlew bootRun',
          coverageCmd: './gradlew jacocoTestReport',
          installCmd: './gradlew dependencies',
          migrateCmd: './gradlew flywayMigrate',
          depsFile: existsSync(join(projectPath, 'build.gradle.kts')) ? 'build.gradle.kts' : 'build.gradle',
        };
      }
    }

    // PHP
    if (lang === 'PHP') {
      return {
        buildCmd: 'composer install --no-dev',
        testCmd: primaryFw?.name === 'Laravel' ? 'php artisan test' : 'vendor/bin/phpunit',
        lintCmd: 'vendor/bin/phpstan analyse',
        runCmd: primaryFw?.name === 'Laravel' ? 'php artisan serve' : 'php -S localhost:8000',
        coverageCmd: 'vendor/bin/phpunit --coverage-text',
        installCmd: 'composer install',
        migrateCmd: primaryFw?.name === 'Laravel' ? 'php artisan migrate' : null,
        depsFile: 'composer.json',
      };
    }

    // Go
    if (lang === 'Go') {
      return {
        buildCmd: 'go build ./...',
        testCmd: 'go test ./...',
        lintCmd: 'golangci-lint run',
        runCmd: 'go run .',
        coverageCmd: 'go test -coverprofile=coverage.out ./...',
        installCmd: 'go mod download',
        migrateCmd: null,
        depsFile: 'go.mod',
      };
    }

    // Ruby
    if (lang === 'Ruby') {
      return {
        buildCmd: 'bundle exec rake build',
        testCmd: hasTest('RSpec') ? 'bundle exec rspec' : 'bundle exec rake test',
        lintCmd: 'bundle exec rubocop',
        runCmd: primaryFw?.name === 'Ruby on Rails' ? 'rails server' : 'ruby app.rb',
        coverageCmd: 'bundle exec rspec --format documentation',
        installCmd: 'bundle install',
        migrateCmd: primaryFw?.name === 'Ruby on Rails' ? 'rails db:migrate' : null,
        depsFile: 'Gemfile',
      };
    }

    // Dart
    if (lang === 'Dart') {
      return {
        buildCmd: 'flutter build',
        testCmd: 'flutter test',
        lintCmd: 'dart analyze',
        runCmd: 'flutter run',
        coverageCmd: 'flutter test --coverage',
        installCmd: 'flutter pub get',
        migrateCmd: null,
        depsFile: 'pubspec.yaml',
      };
    }

    // Rust
    if (lang === 'Rust') {
      return {
        buildCmd: 'cargo build',
        testCmd: 'cargo test',
        lintCmd: 'cargo clippy',
        runCmd: 'cargo run',
        coverageCmd: 'cargo tarpaulin',
        installCmd: 'cargo build',
        migrateCmd: null,
        depsFile: 'Cargo.toml',
      };
    }

    // Fallback
    return {
      buildCmd: hasMakefile ? 'make build' : 'echo "No build command detected"',
      testCmd: hasMakefile ? 'make test' : 'echo "No test command detected"',
      lintCmd: hasMakefile ? 'make lint' : 'echo "No lint command detected"',
      runCmd: hasMakefile ? 'make run' : 'echo "No run command detected"',
      coverageCmd: 'echo "No coverage command detected"',
      installCmd: 'echo "No install command detected"',
      migrateCmd: null,
      depsFile: 'unknown',
    };
  }
}
