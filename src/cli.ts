#!/usr/bin/env node

import { Command } from 'commander';
import { gpuInfoCommand } from './commands/gpu-info';
import { routeCommand } from './commands/route';
import { hardenCommand } from './commands/harden';

const program = new Command();

program
  .name('hybrid-ai-workbench')
  .description('Hybrid AI workstation manager for RTX 5090 - intelligent routing between local models and cloud APIs')
  .version('0.1.0');

// GPU detection and monitoring command
program
  .command('gpu-info')
  .description('Display GPU metrics and detection information')
  .option('--json', 'Output in JSON format')
  .option('--watch', 'Continuously monitor GPU metrics')
  .action(gpuInfoCommand);

// Model routing command
program
  .command('route')
  .description('Route an inference request to optimal model/API')
  .argument('<prompt>', 'The prompt or task to route')
  .option('--dry-run', 'Estimate cost without executing')
  .option('--explain', 'Show detailed routing rationale and alternatives')
  .option('--router <name>', 'Specify router to use (simple, cost-aware, api-first)', 'cost-aware')
  .option('--config <path>', 'Path to routing configuration file')
  .action(routeCommand);

// Security hardening commands
const harden = program
  .command('harden')
  .description('Security hardening audit and remediation for RTX 5090 workstation');

harden
  .command('audit')
  .description('Audit current system against hardening checklist')
  .option('--json', 'Output in JSON format')
  .option('--interactive', 'Interactive mode with explanations')
  .action(hardenCommand.audit);

harden
  .command('generate')
  .description('Generate remediation scripts')
  .option('--format <type>', 'Output format (bash, ansible, terraform)', 'bash')
  .option('--output <path>', 'Output file path (default: stdout)')
  .action(hardenCommand.generate);

harden
  .command('verify')
  .description('Verify hardening controls after application')
  .action(hardenCommand.verify);

// Parse and execute
program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
