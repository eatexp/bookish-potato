interface RouteOptions {
  dryRun?: boolean;
  explain?: boolean;
  router?: string;
  config?: string;
}

export async function routeCommand(prompt: string, options: RouteOptions): Promise<void> {
  // TODO: Implement model routing logic
  // This will use the ModelRouter from core/model-router.ts
  console.log('Route command - to be implemented');
  console.log('Prompt:', prompt);
  console.log('Options:', options);
}
