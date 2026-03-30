import { greet } from '../../core/src/index';

export function startServer(port: number): void {
  const message = greet('World');
  console.log(`Server on port ${port}: ${message}`);
}
